/**
 * Loads demo content.   npm run seed            (only when there are no entries yet)
 *                       npm run seed -- --reset (replace all entries)
 *
 * Creates:
 *   admin → ADMIN_EMAIL / ADMIN_PASSWORD from server/.env (default admin@changelog.dev / Admin@12345)
 *   user  → demo@changelog.dev / Demo@12345, who last opened the drawer 20 days ago (4 unread)
 *   8 changelog entries: 7 published over the last ~2 months and 1 draft
 */
import { env } from "../config/env.js";
import { connectDatabase, disconnectDatabase } from "../db.js";
import { slugify } from "../lib/text.js";
import { Entry, Reaction, User } from "../models/index.js";
import { ensureAdmin, hashPassword } from "../services/auth.service.js";

const DEMO_EMAIL = "demo@changelog.dev";
const DEMO_PASSWORD = "Demo@12345";
const DAY = 24 * 60 * 60_000;

const ENTRIES: { daysAgo: number | null; title: string; category: "new" | "improved" | "fixed"; body: string }[] = [
  {
    daysAgo: 1,
    title: "Keyboard shortcuts everywhere",
    category: "new",
    body: `Press **?** on any screen to see every shortcut available there.

| Action | Shortcut |
| --- | --- |
| Start / stop timer | \`S\` |
| New project | \`N\` then \`P\` |
| Search | \`/\` |

Shortcuts respect your keyboard layout, so they work on AZERTY and QWERTZ too.`,
  },
  {
    daysAgo: 6,
    title: "Webhooks for finished time entries",
    category: "new",
    body: `You can now subscribe to \`time_entry.finished\` and receive a signed POST the moment a timer stops.

\`\`\`json
{
  "event": "time_entry.finished",
  "data": {
    "id": "te_81f2",
    "project": "Website redesign",
    "duration_seconds": 5400
  }
}
\`\`\`

Verify the \`X-Signature\` header with your signing secret before trusting the payload.
Set it up under **Settings → Integrations → Webhooks**.`,
  },
  {
    daysAgo: 11,
    title: "Reports load 4× faster",
    category: "improved",
    body: `We rewrote the aggregation layer behind weekly and monthly reports.

- Median load time dropped from **2.4 s to 0.6 s**
- Exports over 10,000 rows no longer time out
- Filters now apply without reloading the page`,
  },
  {
    daysAgo: 17,
    title: "Timers no longer drift after sleep",
    category: "fixed",
    body: `On some laptops, a running timer lost a few minutes after the machine woke from sleep.
Timers now read elapsed time from the server clock instead of counting ticks locally, so the number you see always matches the saved entry.`,
  },
  {
    daysAgo: 26,
    title: "Invoice drafts from tracked time",
    category: "new",
    body: `Select any range in a report and choose **Create invoice draft**.
Rates come from each project's billing settings, and you can edit every line before sending.

> Drafts stay private until you press *Send*.`,
  },
  {
    daysAgo: 38,
    title: "Calmer notification emails",
    category: "improved",
    body: `Daily summaries now group activity by project and skip days with nothing new.
If you preferred one email per event, switch back under **Settings → Notifications**.`,
  },
  {
    daysAgo: 51,
    title: "CSV import handles semicolons",
    category: "fixed",
    body: "Files exported from European spreadsheet apps use `;` as a separator. The importer now detects the delimiter automatically, and shows a preview of the first five rows before anything is saved.",
  },
  {
    daysAgo: null, // draft
    title: "Team capacity planning (draft)",
    category: "new",
    body: `_Work in progress — not visible on the public timeline._

Plan next week's hours per person and see who is over capacity before it happens.`,
  },
];

async function main() {
  const reset = process.argv.includes("--reset");
  await connectDatabase(env.MONGODB_URI);
  await ensureAdmin();

  if (reset) {
    await Promise.all([Reaction.deleteMany({}), Entry.deleteMany({})]);
    console.log("Removed existing entries and reactions.");
  }

  const admin = await User.findOne({ email: env.ADMIN_EMAIL.toLowerCase() });
  let demo = await User.findOne({ email: DEMO_EMAIL });
  demo ??= await User.create({
    email: DEMO_EMAIL,
    name: "Demo Viewer",
    passwordHash: await hashPassword(DEMO_PASSWORD),
    isVerified: true,
  });

  if (await Entry.exists({})) {
    console.log("Entries already exist — run `npm run seed:reset` to replace them.");
    await disconnectDatabase();
    return;
  }

  const now = Date.now();
  const created = [];
  for (const [i, item] of ENTRIES.entries()) {
    const published = item.daysAgo !== null;
    created.push(
      await Entry.create({
        title: item.title,
        slug: slugify(item.title),
        contentMarkdown: item.body,
        category: item.category,
        status: published ? "published" : "draft",
        publishedAt: published ? new Date(now - item.daysAgo! * DAY - i * 60 * 60_000) : null,
        author: admin?._id ?? null,
      }),
    );
  }

  // A few reactions so the timeline doesn't look empty.
  const reactions: [number, ("heart" | "tada" | "rocket")[]][] = [
    [0, ["heart", "tada"]],
    [1, ["rocket"]],
    [2, ["heart"]],
  ];
  for (const [index, keys] of reactions) {
    for (const emoji of keys) await Reaction.create({ entry: created[index]!._id, user: demo._id, emoji });
  }

  // The demo viewer last opened the drawer 20 days ago → 4 unread updates.
  demo.lastViewedChangelogAt = new Date(now - 20 * DAY);
  await demo.save();

  console.log(`Seeded ${created.length} entries. Demo login: ${DEMO_EMAIL} / ${DEMO_PASSWORD}`);
  await disconnectDatabase();
}

main().catch(async (err) => {
  console.error("Seeding failed:", err);
  await disconnectDatabase().catch(() => undefined);
  process.exit(1);
});
