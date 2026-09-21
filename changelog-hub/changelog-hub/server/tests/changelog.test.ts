import request from "supertest";
import { describe, expect, it } from "vitest";
import {
  adminAgent,
  app,
  createEntry,
  login,
  makeUser,
  minutesFromNow,
  useTestDatabase,
  viewerAgent,
} from "./helpers.js";

useTestDatabase();

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const DAY = 24 * 60;

describe("admin publishing studio", () => {
  it("protects admin routes (401 anonymous, 403 viewers)", async () => {
    await request(app).get("/api/v1/admin/entries").expect(401);
    const viewer = await viewerAgent();
    const res = await viewer.post("/api/v1/admin/entries").send({ title: "x" }).expect(403);
    expect(res.body.detail.code).toBe("forbidden");
  });

  it("creates, edits, publishes and deletes, generating unique slugs", async () => {
    const admin = await adminAgent();
    const a = await createEntry(admin, { title: "Dark mode!", status: "draft" });
    expect(a.slug).toBe("dark-mode");
    expect(a.publishedAt).toBeNull();
    const b = await createEntry(admin, { title: "Dark mode" });
    expect(b.slug).toBe("dark-mode-2");
    expect(b.publishedAt).not.toBeNull();

    const clash = await admin.patch(`/api/v1/admin/entries/${a.id}`).send({ slug: "dark-mode-2" }).expect(409);
    expect(clash.body.detail.code).toBe("slug_taken");

    const published = await admin.post(`/api/v1/admin/entries/${a.id}/publish`).expect(200);
    expect(published.body.status).toBe("published");
    expect(published.body.publishedAt).toBeTruthy();

    const edited = await admin
      .patch(`/api/v1/admin/entries/${a.id}`)
      .send({ category: "fixed", coverImage: null })
      .expect(200);
    expect(edited.body.category).toBe("fixed");
    expect(edited.body.title).toBe("Dark mode!"); // omitted fields are untouched

    const listing = await admin.get("/api/v1/admin/entries").expect(200);
    expect(listing.body.counts).toEqual({ all: 2, draft: 0, published: 2 });

    await admin.post(`/api/v1/admin/entries/${a.id}/unpublish`).expect(200);
    await admin.delete(`/api/v1/admin/entries/${a.id}`).expect(204);
    await admin.get(`/api/v1/admin/entries/${a.id}`).expect(404);
    await admin.get("/api/v1/admin/entries/not-an-id").expect(404);
  });

  it("lists drafts first, then published newest first", async () => {
    const admin = await adminAgent();
    await createEntry(admin, { title: "Older", publishedAt: minutesFromNow(-DAY) });
    await createEntry(admin, { title: "Draft", status: "draft" });
    await createEntry(admin, { title: "Newer", publishedAt: minutesFromNow(-5) });
    const titles = (await admin.get("/api/v1/admin/entries").expect(200)).body.items.map((e: { title: string }) => e.title);
    expect(titles).toEqual(["Draft", "Newer", "Older"]);
  });

  it("validates input with field-level errors", async () => {
    const admin = await adminAgent();
    const bad = await admin
      .post("/api/v1/admin/entries")
      .send({ title: "x", coverImage: "javascript:alert(1)", category: "misc", slug: "Not A Slug" })
      .expect(422);
    const fields = bad.body.detail.map((d: { loc: string[] }) => d.loc.at(-1));
    expect(fields).toEqual(expect.arrayContaining(["coverImage", "category", "slug"]));
  });

  it("accepts real images and rejects disguised files", async () => {
    const admin = await adminAgent();
    const ok = await admin.post("/api/v1/admin/uploads").attach("file", PNG, "a.png").expect(201);
    expect(ok.body.url).toMatch(/^\/uploads\/[a-f0-9]+\.png$/);
    expect(ok.body.contentType).toBe("image/png");
    await request(app).get(ok.body.url).expect(200).expect("content-type", /image\/png/);

    // Lying about the file name / type doesn't help: the bytes are checked.
    const bad = await admin
      .post("/api/v1/admin/uploads")
      .attach("file", Buffer.from("<svg onload=alert(1)>"), { filename: "x.png", contentType: "image/png" })
      .expect(415);
    expect(bad.body.detail.code).toBe("unsupported_media_type");

    await request(app).post("/api/v1/admin/uploads").attach("file", PNG, "a.png").expect(401);
  });
});

describe("public timeline", () => {
  it("hides drafts and scheduled entries, newest first", async () => {
    const admin = await adminAgent();
    await createEntry(admin, { title: "Old", publishedAt: minutesFromNow(-3 * DAY) });
    await createEntry(admin, { title: "Newest", publishedAt: minutesFromNow(-60) });
    await createEntry(admin, { title: "Draft", status: "draft" });
    await createEntry(admin, { title: "Future", publishedAt: minutesFromNow(DAY) });

    const items = (await request(app).get("/api/v1/changelog").expect(200)).body.items;
    expect(items.map((i: { title: string }) => i.title)).toEqual(["Newest", "Old"]);
    await request(app).get("/api/v1/changelog/draft").expect(404);
    await request(app).get("/api/v1/changelog/future").expect(404);
  });

  it("filters by category and searches title and body", async () => {
    const admin = await adminAgent();
    await createEntry(admin, { title: "Faster exports", category: "improved", contentMarkdown: "CSV speedups" });
    await createEntry(admin, { title: "Crash on login", category: "fixed", contentMarkdown: "Fixed a null pointer" });
    await createEntry(admin, { title: "100% coverage", category: "new", contentMarkdown: "Wildcard test (.*)" });

    const fixed = await request(app).get("/api/v1/changelog").query({ category: "fixed" });
    expect(fixed.body.items.map((i: { title: string }) => i.title)).toEqual(["Crash on login"]);

    const total = async (q: string) => (await request(app).get("/api/v1/changelog").query({ q })).body.total;
    expect(await total("csv")).toBe(1); // body match, case-insensitive
    expect(await total("CRASH login")).toBe(1); // every term must match
    expect(await total("crash exports")).toBe(0);
    expect(await total("%")).toBe(1); // special characters are literal
    expect(await total(".*")).toBe(1);
    expect(await total("nothing-here")).toBe(0);
  });

  it("paginates", async () => {
    const admin = await adminAgent();
    for (let i = 0; i < 5; i++) await createEntry(admin, { title: `Entry ${i}`, publishedAt: minutesFromNow(-i - 1) });
    const page = (await request(app).get("/api/v1/changelog").query({ pageSize: 2, page: 3 })).body;
    expect(page).toMatchObject({ total: 5, page: 3, pageSize: 2, hasMore: false });
    expect(page.items).toHaveLength(1);
  });
});

describe("unread tracker", () => {
  it("compares lastViewedChangelogDate with publication dates", async () => {
    const admin = await adminAgent();
    await createEntry(admin, { title: "One", publishedAt: minutesFromNow(-2 * DAY) });
    await createEntry(admin, { title: "Two", publishedAt: minutesFromNow(-5) });

    // Anonymous widgets pass their own timestamp.
    expect((await request(app).get("/api/v1/changelog/unread-count")).body.unread).toBe(2);
    const since = minutesFromNow(-DAY);
    expect((await request(app).get("/api/v1/changelog/unread-count").query({ since })).body.unread).toBe(1);

    const viewer = await viewerAgent();
    expect((await viewer.get("/api/v1/changelog/unread-count")).body.unread).toBe(2);
    const marked = await viewer.post("/api/v1/changelog/mark-read").expect(200);
    expect(marked.body.unread).toBe(0);
    expect((await viewer.get("/api/v1/auth/me")).body.lastViewedChangelogDate).not.toBeNull();
    expect((await viewer.get("/api/v1/changelog/unread-count")).body.unread).toBe(0);

    // A new release brings the badge back.
    await createEntry(admin, { title: "Three" });
    expect((await viewer.get("/api/v1/changelog/unread-count")).body.unread).toBe(1);
  });

  it("marking as read requires a session", async () => {
    await request(app).post("/api/v1/changelog/mark-read").expect(401);
  });
});

describe("reactions", () => {
  it("allows one of each reaction per user, toggling on a second click", async () => {
    const admin = await adminAgent();
    const entry = await createEntry(admin);
    const url = `/api/v1/changelog/${entry.id}/reactions`;
    await request(app).post(url).send({ reaction: "heart" }).expect(401);

    const u1 = await viewerAgent("u1@test.dev");
    const u2 = await viewerAgent("u2@test.dev");

    let res = await u1.post(url).send({ reaction: "heart" }).expect(200);
    expect(res.body.reactions.heart).toBe(1);
    expect(res.body.viewerReactions).toEqual(["heart"]);
    await u1.post(url).send({ reaction: "rocket" }).expect(200);

    res = await u2.post(url).send({ reaction: "heart" }).expect(200);
    expect(res.body.reactions).toEqual({ heart: 2, tada: 0, rocket: 1 });
    expect(res.body.viewerReactions).toEqual(["heart"]);

    res = await u2.post(url).send({ reaction: "heart" }).expect(200); // toggles off
    expect(res.body.reactions.heart).toBe(1);
    expect(res.body.viewerReactions).toEqual([]);

    const item = (await u1.get(`/api/v1/changelog/${entry.slug}`).expect(200)).body;
    expect(item.reactions.heart).toBe(1);
    expect(item.viewerReactions).toEqual(["heart", "rocket"]);

    await u1.post(url).send({ reaction: "poop" }).expect(422);
  });

  it("keeps the count right when the same click races itself", async () => {
    const admin = await adminAgent();
    const entry = await createEntry(admin);
    const viewer = await viewerAgent();
    await Promise.all(
      Array.from({ length: 10 }, () => viewer.post(`/api/v1/changelog/${entry.id}/reactions`).send({ reaction: "tada" })),
    );
    const item = (await viewer.get(`/api/v1/changelog/${entry.slug}`)).body;
    expect(item.reactions.tada).toBeLessThanOrEqual(1); // never double-counted
  });

  it("hides reactions on drafts", async () => {
    const admin = await adminAgent();
    const draft = await createEntry(admin, { status: "draft" });
    const viewer = await viewerAgent();
    await viewer.post(`/api/v1/changelog/${draft.id}/reactions`).send({ reaction: "heart" }).expect(404);
  });
});

describe("JSON feed", () => {
  it("publishes sanitized HTML with absolute URLs, open to any origin", async () => {
    const admin = await adminAgent();
    await createEntry(admin, {
      title: "Code",
      contentMarkdown: "```js\nalert(1)\n```\n\n<script>x</script>\n\n[bad](javascript:alert(1))\n\n![s](/uploads/a.png)",
      coverImage: "/uploads/a.png",
    });
    await createEntry(admin, { title: "Hidden", status: "draft" });

    const res = await request(app).get("/api/v1/changelog/feed").set("Origin", "https://someone-else.example").expect(200);
    expect(res.headers["access-control-allow-origin"]).toBe("*");
    expect(res.headers["cache-control"]).toMatch(/max-age=60/);
    expect(res.body.version).toMatch(/1\.1$/);
    expect(res.body.items).toHaveLength(1);

    const item = res.body.items[0];
    expect(item.content_html).not.toContain("<script>");
    expect(item.content_html).not.toContain("javascript:");
    expect(item.content_html).toContain("<pre>");
    expect(item.content_html).toContain('src="http://localhost:8000/uploads/a.png"');
    expect(item.image).toBe("http://localhost:8000/uploads/a.png");
    expect(item.tags).toEqual(["#New"]);
  });
});

describe("dev mailbox", () => {
  it("shows simulated emails, newest first", async () => {
    const { email } = await makeUser("mail@test.dev", "Viewer123", false);
    await request(app).post("/api/v1/auth/resend-verification").send({ email });
    const mail = (await request(app).get("/api/v1/dev/mailbox").query({ email }).expect(200)).body;
    expect(mail).toHaveLength(2);
    expect(mail[0]).toMatchObject({ toEmail: email, subject: "Confirm your email address" });
    expect(mail[0].actionUrl).toMatch(/^http:\/\/localhost:5173\/verify-email\?token=/);
  });

  it("signed-in users see their session through /me", async () => {
    const { email, password } = await makeUser();
    const agent = request.agent(app);
    await login(agent, email, password);
    expect((await agent.get("/api/v1/auth/me")).body).toMatchObject({ email, role: "user", isVerified: true });
  });
});
