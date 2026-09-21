import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RefreshToken } from "../src/models/index.js";
import { app, cookieValue, latestLinkToken, login, makeUser, setCookieHeader, useTestDatabase } from "./helpers.js";

useTestDatabase();
afterEach(() => vi.useRealTimers());

const refreshWith = (token: string) =>
  request(app).post("/api/v1/auth/refresh").set("Cookie", `refresh_token=${token}`);

describe("signup and email verification", () => {
  it("requires a verified email before login, and links work once", async () => {
    await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: "A", email: "a@test.dev", password: "Passw0rd" })
      .expect(201);

    const blocked = await request(app).post("/api/v1/auth/login").send({ email: "a@test.dev", password: "Passw0rd" });
    expect(blocked.status).toBe(403);
    expect(blocked.body.detail.code).toBe("email_not_verified");

    const token = await latestLinkToken("a@test.dev");
    await request(app).post("/api/v1/auth/verify-email").send({ token }).expect(200);
    await request(app).post("/api/v1/auth/verify-email").send({ token }).expect(400); // single use
    await login(request.agent(app), "a@test.dev", "Passw0rd");
  });

  it("rejects duplicate emails (case-insensitively) and weak passwords", async () => {
    await makeUser();
    const dup = await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: "B", email: "VIEWER@test.dev", password: "Passw0rd" });
    expect(dup.status).toBe(409);
    expect(dup.body.detail.code).toBe("email_taken");

    const weak = await request(app)
      .post("/api/v1/auth/signup")
      .send({ name: "B", email: "b@test.dev", password: "password" })
      .expect(422);
    // Validation errors name each field in `loc`, so the form can highlight it.
    expect(weak.body.detail[0].loc).toEqual(["body", "password"]);
    expect(weak.body.detail[0].msg).toMatch(/letter and one number/);
  });
});

describe("login and cookies", () => {
  it("sets httpOnly cookies, scoping the refresh token to the auth routes", async () => {
    const { email, password } = await makeUser();
    const agent = request.agent(app);
    const res = await agent.post("/api/v1/auth/login").send({ email, password }).expect(200);

    const access = setCookieHeader(res, "access_token")!;
    const refresh = setCookieHeader(res, "refresh_token")!;
    const hint = setCookieHeader(res, "session_hint")!;
    expect(access).toMatch(/HttpOnly/);
    expect(access).toMatch(/Path=\/;/);
    expect(refresh).toMatch(/HttpOnly/);
    expect(refresh).toMatch(/Path=\/api\/v1\/auth/);
    expect(refresh).toMatch(/Max-Age=604800/);
    expect(hint).not.toMatch(/HttpOnly/); // readable by the SPA, holds no secret
    expect(res.body).not.toHaveProperty("accessToken");

    // The access token inside lives 15 minutes.
    const expiresIn = new Date(res.body.accessTokenExpiresAt).getTime() - Date.now();
    expect(expiresIn).toBeGreaterThan(14 * 60_000);
    expect(expiresIn).toBeLessThanOrEqual(15 * 60_000);

    expect((await agent.get("/api/v1/auth/me").expect(200)).body.email).toBe(email);
  });

  it("answers a wrong password and an unknown email identically", async () => {
    const { email } = await makeUser();
    const wrong = await request(app).post("/api/v1/auth/login").send({ email, password: "Nope12345" });
    const ghost = await request(app).post("/api/v1/auth/login").send({ email: "ghost@test.dev", password: "Nope12345" });
    expect(wrong.status).toBe(401);
    expect(wrong.body.detail.code).toBe("invalid_credentials");
    expect(ghost.body).toEqual(wrong.body);
  });
});

describe("token rotation", () => {
  it("rotates the refresh token and revokes the family when an old one is replayed", async () => {
    const { email, password } = await makeUser();
    const loginRes = await request(app).post("/api/v1/auth/login").send({ email, password });
    const oldRefresh = cookieValue(loginRes, "refresh_token")!;

    const rotated = await refreshWith(oldRefresh).expect(200);
    const newRefresh = cookieValue(rotated, "refresh_token")!;
    expect(newRefresh).toBeTruthy();
    expect(newRefresh).not.toBe(oldRefresh);

    // Replay the rotated token after the grace window → the whole family is revoked.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 60_000);
    const replay = await refreshWith(oldRefresh).expect(401);
    expect(replay.body.detail.code).toBe("refresh_reuse_detected");
    expect(setCookieHeader(replay, "refresh_token")).toMatch(/Expires=Thu, 01 Jan 1970/);

    // The legitimate newer token is dead too.
    await refreshWith(newRefresh).expect(401);
  });

  it("treats two tabs refreshing at the same moment as a race, not theft", async () => {
    const { email, password } = await makeUser();
    const agent = request.agent(app);
    const loginRes = await agent.post("/api/v1/auth/login").send({ email, password });
    const first = cookieValue(loginRes, "refresh_token")!;

    const [a, b] = await Promise.all([refreshWith(first), refreshWith(first)]);
    expect([a.status, b.status]).toEqual([200, 200]);
    // And a sequential replay inside the grace window also succeeds.
    await refreshWith(first).expect(200);
    await agent.get("/api/v1/auth/me").expect(200);
  });

  it("rejects an expired access token with token_expired, and a refresh recovers", async () => {
    const { email, password } = await makeUser();
    const agent = request.agent(app);
    await login(agent, email, password);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 16 * 60_000);
    const res = await agent.get("/api/v1/auth/me").expect(401);
    expect(res.body.detail.code).toBe("token_expired");
    await agent.post("/api/v1/auth/refresh").expect(200);
    await agent.get("/api/v1/auth/me").expect(200);
  });

  it("never accepts a refresh token as an access token", async () => {
    const { email, password } = await makeUser();
    const loginRes = await request(app).post("/api/v1/auth/login").send({ email, password });
    const refresh = cookieValue(loginRes, "refresh_token")!;
    await request(app).get("/api/v1/auth/me").set("Authorization", `Bearer ${refresh}`).expect(401);
    await request(app).get("/api/v1/auth/me").set("Cookie", `access_token=${refresh}`).expect(401);
  });

  it("rejects tokens signed with another secret", async () => {
    const forged = jwt.sign({ role: "admin", tv: 0 }, "not-the-real-secret-but-long-enough-anyway", {
      subject: "64b7f0c2a1b2c3d4e5f60718",
      audience: "access",
      issuer: "changelog-hub",
    });
    const res = await request(app).get("/api/v1/admin/entries").set("Authorization", `Bearer ${forged}`).expect(401);
    expect(res.body.detail.code).toBe("invalid_token");
  });

  it("logout revokes the session", async () => {
    const { email, password } = await makeUser();
    const agent = request.agent(app);
    const loginRes = await agent.post("/api/v1/auth/login").send({ email, password });
    const refresh = cookieValue(loginRes, "refresh_token")!;
    await agent.post("/api/v1/auth/logout").expect(204);
    await refreshWith(refresh).expect(401);
    expect(await RefreshToken.countDocuments({ revokedAt: null })).toBe(0);
  });
});

describe("password recovery", () => {
  it("resets the password and ends every session", async () => {
    const { email, password } = await makeUser();
    const agent = request.agent(app);
    const loginRes = await agent.post("/api/v1/auth/login").send({ email, password });
    const oldRefresh = cookieValue(loginRes, "refresh_token")!;

    // Unknown emails get the same answer.
    const ghost = await request(app).post("/api/v1/auth/forgot-password").send({ email: "ghost@test.dev" });
    const real = await request(app).post("/api/v1/auth/forgot-password").send({ email });
    expect(ghost.status).toBe(200);
    expect(ghost.body).toEqual(real.body);

    const token = await latestLinkToken(email);
    await request(app).post("/api/v1/auth/reset-password").send({ token, password: "BrandNew99" }).expect(200);
    await request(app).post("/api/v1/auth/reset-password").send({ token, password: "Again1234" }).expect(400);

    // Old sessions are gone (access and refresh), the old password fails, the new one works.
    expect((await agent.get("/api/v1/auth/me").expect(401)).body.detail.code).toBe("token_revoked");
    await refreshWith(oldRefresh).expect(401);
    await request(app).post("/api/v1/auth/login").send({ email, password }).expect(401);
    await login(request.agent(app), email, "BrandNew99");
  });

  it("only the latest reset link works", async () => {
    const { email } = await makeUser();
    await request(app).post("/api/v1/auth/forgot-password").send({ email });
    const first = await latestLinkToken(email);
    await request(app).post("/api/v1/auth/forgot-password").send({ email });
    await request(app).post("/api/v1/auth/reset-password").send({ token: first, password: "BrandNew99" }).expect(400);
  });
});

describe("CSRF origin guard", () => {
  it("blocks state-changing requests from other websites", async () => {
    const { email, password } = await makeUser();
    const agent = request.agent(app);
    await login(agent, email, password);
    const res = await agent.post("/api/v1/changelog/mark-read").set("Origin", "https://evil.example").expect(403);
    expect(res.body.detail.code).toBe("bad_origin");
    await agent.post("/api/v1/changelog/mark-read").set("Origin", "http://localhost:5173").expect(200);
  });
});
