import { randomUUID } from "node:crypto";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import request, { type Response } from "supertest";
import { afterAll, afterEach, beforeAll, beforeEach, expect } from "vitest";
import { createApp } from "../src/app.js";
import "../src/models/index.js";
import { ensureAdmin } from "../src/services/auth.service.js";

export const app = createApp();
export type Agent = ReturnType<typeof request.agent>;

let mongo: MongoMemoryServer | undefined;

/**
 * Gives each test a clean database with just the bootstrap admin. Uses an in-memory MongoDB;
 * set TEST_MONGODB_URI to run against an existing server (a throwaway database is used).
 */
export function useTestDatabase(): void {
  beforeAll(async () => {
    if (process.env.TEST_MONGODB_URI) {
      // Always a throwaway database whose name marks it as one: the afterAll hook drops it,
      // so it must never be able to point at real data.
      await mongoose.connect(process.env.TEST_MONGODB_URI, { dbName: `changelog_test_${randomUUID().slice(0, 8)}` });
      if (!mongoose.connection.name.startsWith("changelog_test_")) {
        throw new Error(`Refusing to run tests against database "${mongoose.connection.name}".`);
      }
    } else {
      mongo = await MongoMemoryServer.create();
      await mongoose.connect(mongo.getUri());
    }
    await Promise.all(mongoose.modelNames().map((name) => mongoose.model(name).init()));
  });
  beforeEach(async () => {
    await ensureAdmin();
  });
  afterEach(async () => {
    await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  });
  afterAll(async () => {
    if (process.env.TEST_MONGODB_URI) await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
    await mongo?.stop();
  });
}

export async function latestLinkToken(email: string): Promise<string> {
  const res = await request(app).get("/api/v1/dev/mailbox").query({ email }).expect(200);
  const url: string = res.body[0].actionUrl;
  return url.split("token=")[1]!;
}

/** Signs up (and by default verifies) a viewer through the real API. */
export async function makeUser(email = "viewer@test.dev", password = "Viewer123", verify = true) {
  const res = await request(app).post("/api/v1/auth/signup").send({ name: "Viewer", email, password });
  expect(res.status, res.text).toBe(201);
  if (verify) {
    const token = await latestLinkToken(email);
    await request(app).post("/api/v1/auth/verify-email").send({ token }).expect(200);
  }
  return { email, password };
}

export async function login(agent: Agent, email: string, password: string) {
  const res = await agent.post("/api/v1/auth/login").send({ email, password });
  expect(res.status, res.text).toBe(200);
  return res.body as { user: { id: string } };
}

export async function adminAgent(): Promise<Agent> {
  const agent = request.agent(app);
  await login(agent, "admin@test.dev", "Admin@12345");
  return agent;
}

export async function viewerAgent(email = "viewer@test.dev"): Promise<Agent> {
  const { password } = await makeUser(email);
  const agent = request.agent(app);
  await login(agent, email, password);
  return agent;
}

export async function createEntry(agent: Agent, overrides: Record<string, unknown> = {}) {
  const res = await agent
    .post("/api/v1/admin/entries")
    .send({ title: "Hello", contentMarkdown: "Body", category: "new", status: "published", ...overrides });
  expect(res.status, res.text).toBe(201);
  return res.body as { id: string; slug: string; publishedAt: string | null; status: string };
}

export function setCookieHeader(res: Response, name: string): string | undefined {
  const header = res.headers["set-cookie"] as unknown as string[] | string | undefined;
  const all = Array.isArray(header) ? header : header ? [header] : [];
  return all.find((c) => c.startsWith(`${name}=`));
}

export const cookieValue = (res: Response, name: string) => setCookieHeader(res, name)?.slice(name.length + 1).split(";")[0];

export const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000).toISOString();
