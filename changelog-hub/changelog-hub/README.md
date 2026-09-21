# Changelog & Product Updates Widget

A product-update delivery hub (a Headway / Beamer alternative) with three parts: an **admin Markdown publishing
studio**, a **public release timeline**, and an embeddable **"What's new" notification center** with a live unread
badge. It also serves a public JSON feed for other tools to consume.

Built on the **MERN stack**: **MongoDB** (Mongoose) · **Express 5** · **React 19** · **Node.js**, written in
TypeScript end to end. The interface is built from [coss.com/ui](https://coss.com/ui) primitives (Base UI + Tailwind
CSS v4).

![Public timeline](docs/screenshots/timeline.png)

---

## Contents

1. [Run it locally: step-by-step guide](#run-it-locally-step-by-step-guide)
2. [Requirements checklist](#requirements-checklist)
3. [Technology stack](#technology-stack)
4. [Features](#features)
5. [Authentication & security](#authentication--security)
6. [The unread algorithm](#the-unread-algorithm)
7. [API reference](#api-reference)
8. [Environment variables](#environment-variables)
9. [Tests](#tests)
10. [Project layout](#project-layout)
11. [Assumptions and limitations](#assumptions-and-limitations)

---

## Run it locally: step-by-step guide

The whole setup takes about 10 minutes the first time. Commands are shown for **Windows PowerShell**; they are the
same on macOS/Linux unless noted.

### Step 1: Install the tools

| Tool | Version | Download | Check it worked |
| --- | --- | --- | --- |
| Node.js (includes npm) | 20.12 or newer (LTS recommended) | <https://nodejs.org> | `node -v` and `npm -v` |
| MongoDB | 7 or 8 | see Step 3 | — |
| Git (optional) | any | <https://git-scm.com> | `git --version` |

Open a **new** terminal after installing Node.js so `node` and `npm` are on your PATH.

### Step 2: Get the code and install dependencies

Unzip the project (or `git clone` it), then open a terminal **in the `changelog-hub` folder**. All commands below
assume you are there. The folder contains `package.json`, `server/` and `frontend/`.

```powershell
cd C:\path\to\changelog-hub
npm run install:all
```

This installs three sets of packages: the root helper (`concurrently`), the API (`server/`) and the web app
(`frontend/`). The first time takes a few minutes.

> **"npm error enoent Could not read package.json"** means the terminal is not in the `changelog-hub` folder. `cd`
> into it and try again.

### Step 3: Set up MongoDB (pick one)

**Option A: MongoDB Community Server (recommended for beginners)**

1. Download it from <https://www.mongodb.com/try/download/community>. Choose your OS, the `msi` package on Windows.
2. Run the installer and choose **Complete**. Keep **"Install MongoDB as a Service"** ticked, so it starts
   automatically with Windows. You can also keep **MongoDB Compass** ticked (a GUI to browse the data).
3. Check that it is running:
   ```powershell
   Get-Service MongoDB        # Status should be "Running"; if not: Start-Service MongoDB
   ```
   On macOS with Homebrew: `brew services start mongodb-community`.

**Option B: Docker.** If Docker Desktop is installed and running:

```powershell
npm run db:up        # starts MongoDB 8 in a container on port 27017 (stop it with: npm run db:down)
```

If port 27017 is already taken on your machine (another project, or a local MongoDB install), pick a free port
instead: create a `.env` file next to `docker-compose.yml` containing `MONGO_PORT=27019`, run `npm run db:up` again,
and set the same port in `MONGODB_URI` in `server/.env`.

**Option C: MongoDB Atlas (cloud, free tier).** Create a free cluster at <https://www.mongodb.com/atlas>, add your IP
under *Network Access*, create a database user, and copy the `mongodb+srv://…` connection string. You'll paste it into
`server/.env` in the next step.

> Use only one of A and B: both listen on port 27017.

### Step 4: Create the configuration files

```powershell
npm run setup
```

This creates `server/.env` and `frontend/.env` from their `.env.example` templates and generates two strong random JWT
secrets for you. The defaults work as-is with a local MongoDB. **Using Atlas?** Open `server/.env` and replace
`MONGODB_URI` with your connection string (add a database name, e.g. `…mongodb.net/changelog_hub`).

### Step 5: Load the demo data

```powershell
npm run seed
```

You should see `Created admin account admin@changelog.dev` and `Seeded 8 entries`. The database and collections
are created automatically; there is nothing to create by hand. To start over later, run `npm run seed:reset`.

### Step 6: Start the app

```powershell
npm run dev
```

This starts both servers in one terminal (stop them with **Ctrl + C**):

| What | URL |
| --- | --- |
| **Web app** | <http://localhost:5173> |
| API | <http://localhost:8000/api/v1/health> should answer `{"status":"ok"}` |
| Interactive API docs (Swagger) | <http://localhost:8000/docs> |
| JSON feed | <http://localhost:8000/api/v1/changelog/feed> |
| Simulated email inbox | <http://localhost:5173/dev/mailbox> |
| Embeddable widget demo | <http://localhost:5173/widget-demo.html> |

Prefer two terminals? Run `npm run dev:server` in one and `npm run dev:frontend` in the other.

### Step 7: Sign in and explore

| Role | Email | Password |
| --- | --- | --- |
| Admin (publishing studio) | `admin@changelog.dev` | `Admin@12345` |
| Viewer (has 4 unread updates) | `demo@changelog.dev` | `Demo@12345` |

Things to try:

1. **Timeline:** click the `#Fixed` pill, search for `csv`, and watch the URL change so the view can be shared.
2. **Bell:** sign in as the demo viewer. The badge shows **4**. Open the drawer: new items are highlighted and the
   badge clears. Reload the page and it stays cleared.
3. **Reactions:** click ❤️ 🎉 🚀 on an update. A second click removes your reaction.
4. **Studio:** sign in as admin, open *Studio → New update*, and write Markdown. The preview updates live. Drag an
   image into the editor, pick a tag, then **Publish**. The update appears at the top of the timeline, and the
   viewer's badge comes back.
5. **Scheduling:** set a publish date in the future. The update stays off the public timeline until then.
6. **Email flows:** sign up at `/signup`. Sign-in is refused until you confirm your email: open the dev inbox, click
   *Confirm email*, then sign in. *Forgot password* works the same way.

### Troubleshooting

| Problem | Fix |
| --- | --- |
| `Could not connect to MongoDB` | MongoDB isn't running. Start the service (Option A), `npm run db:up` (Option B), or check the Atlas URI and IP allow-list (Option C). |
| The app starts but the timeline is empty | Something else is listening on your MongoDB port, so the app opened a different (empty) database. Check with `Get-NetTCPConnection -LocalPort 27017 -State Listen`, then move this project to a free port with `MONGO_PORT` (see Step 3) and re-run `npm run seed`. |
| `Invalid server configuration … JWT_ACCESS_SECRET is missing` | Run `npm run setup`, or copy `server/.env.example` to `server/.env` and fill in two random strings of 32+ characters. |
| `Port 8000 is already in use` | Stop the other program, or change `PORT` in `server/.env` **and** `VITE_API_PROXY_TARGET` in `frontend/.env`. |
| Web app on port **5174** instead of 5173 | Something else already uses 5173. That's fine: open the URL Vite prints. |
| "Can't reach the server" in the browser | The API isn't running. Check the `api` output in the terminal. |
| Sign-in stops working after many attempts | Rate limiting: 10 attempts per 5 minutes per IP. Wait, restart the API, or set `RATE_LIMIT_ENABLED=false` in `server/.env`. |
| A verification link says it's invalid | Links work once and expire (24 h verification, 30 min reset). Only the newest link works. Request a new one. |

---

## Requirements checklist

How each item in the project brief is implemented.

| Brief requirement | Where / how |
| --- | --- |
| **Pair token auth:** 15 min access JWT + 7 day refresh JWT in httpOnly cookies | `server/src/services/token.service.ts`, `server/src/lib/cookies.ts` |
| Signup with **email verification simulation** | Emails stored in MongoDB + printed to the console; read them at `/dev/mailbox` |
| Login with **token rotation** | Every refresh issues a new pair; a replayed old refresh token revokes the whole session (reuse detection) |
| **Forgot / reset password** | Single-use, 30-minute link; a completed reset ends every session |
| **coss.com/ui** primitives | `frontend/src/components/ui/*` (Sheet drawer, Toggle group pills, Menu, Toast, Field, Card…) |
| Split-screen live **Markdown editor** with **image attachment** and **tag selector** | `frontend/src/pages/admin/entry-editor-page.tsx`: toolbar, paste / drop / button uploads, cover image, #New/#Improved/#Fixed |
| Schema: `title`, `slug`, `contentMarkdown`, `category`, `coverImage`, `publishedAt`, `status` | `server/src/models/entry.model.ts` |
| Full **CRUD dashboard**: draft, edit, publish, delete | `/admin` + `/api/v1/admin/entries` |
| **Reverse-chronological timeline** rendering Markdown, code and media | `frontend/src/pages/timeline-page.tsx`, highlight.js for code |
| **Category filter pills** | `#New` / `#Improved` / `#Fixed`, synced to the URL |
| **Emoji reactions** ❤️ 🎉 🚀 with per-user unique tracking | Unique MongoDB index on (entry, user, emoji); optimistic UI |
| **Slide-over drawer** from a bell icon | coss ui `Sheet`: `frontend/src/components/app/whats-new-drawer.tsx` |
| **Unread tracker** using `lastViewedChangelogDate` | [The unread algorithm](#the-unread-algorithm) |
| Opening the drawer **marks all read** and clears the badge | `POST /api/v1/changelog/mark-read` |
| Public JSON feed at **`/api/v1/changelog/feed`** | JSON Feed 1.1, sanitized HTML, CORS-open |
| **Debounced keyword search** over titles and body | 300 ms debounce in the UI, case-insensitive multi-word search in the API |
| Admin route protection | `requireAdmin` middleware on every `/api/v1/admin` route + a route guard in React |
| Repository: `.env.example`, **Postman collection** | `server/.env.example`, `frontend/.env.example`, `postman/` |

---

## Technology stack

| Layer | Choice | Why |
| --- | --- | --- |
| Runtime | Node.js 20+ with TypeScript | One language across API and UI; types catch contract mistakes at build time |
| API | Express 5 | Minimal and well understood; native async error handling |
| Database | MongoDB + Mongoose 9 | Document model fits changelog entries; schemas, validation and indexes in code |
| Validation | Zod 4 | One schema validates each request and produces field-level error messages |
| Auth | jsonwebtoken + bcryptjs | Signed JWT pair and slow password hashing, no heavyweight auth framework |
| Frontend | React 19 + Vite + TypeScript | Typed components, instant hot reload, small config |
| UI | coss.com/ui (Base UI) + Tailwind CSS v4 | Required by the brief; accessible primitives whose source lives in the repo |
| Data layer | TanStack Query v5 | Caching, background refetch and optimistic updates: exactly what the unread badge and reactions need |
| Routing | React Router v7 | Route-level code splitting and blocking navigation on unsaved work |

**Server libraries:** `helmet` (security headers), `cors`, `cookie-parser`, `express-rate-limit` (brute-force
protection), `multer` (image uploads), `marked` + `sanitize-html` (Markdown → safe HTML for the feed),
`swagger-ui-express` (API docs), `morgan` (request logs). **Tests:** Vitest, Supertest, mongodb-memory-server.

**Frontend libraries:** `react-markdown` (renders Markdown without a raw-HTML escape hatch, so posts can't inject
scripts), `highlight.js` core with hand-picked grammars (the full build is ~3× larger), `lucide-react` icons,
self-hosted `@fontsource` fonts.

---

## Features

### Admin publishing studio

A split-screen Markdown editor with live preview. It has a formatting toolbar (Ctrl/⌘ + B, I, K), and images can be
added by button, paste or drag-and-drop. You can also set a cover image, pick the category tag, edit the slug, and set a
publish date, which doubles as scheduling. Ctrl/⌘ + S saves, and leaving with unsaved changes asks first.

![Publishing studio](docs/screenshots/publishing-studio.png)

The dashboard lists every update, drafts first, with search, status tabs and per-row publish / unpublish / delete.

![Admin dashboard](docs/screenshots/admin-dashboard.png)

### Public timeline

Reverse-chronological, with a sticky date rail and a category-coloured marker per release. Markdown renders with
tables, highlighted code and images. The category pills and the debounced search box both write to the URL, so any
filtered view is shareable. The list scrolls infinitely, with a "Load older updates" fallback.

### "What's new" notification center

A bell in the header opens a slide-over drawer with the latest releases. Its badge shows the unread count, which
refreshes every 60 seconds and when the tab regains focus. Opening the drawer marks everything read and clears the
badge, while still highlighting which items were new on this visit.

![What's new drawer](docs/screenshots/whats-new-drawer.png)

### Embeddable widget

Any website can add the notification center with one script tag:

```html
<script src="https://updates.example.com/widget.js" defer></script>
```

| Attribute | Effect |
| --- | --- |
| `data-trigger` | CSS selector of your own button; the unread count is written to its `data-unread` attribute |
| `data-position` | `right` (default) or `left` |
| `data-origin` | Where the changelog app lives (defaults to the script's own origin) |

`window.ChangelogWidget.open()` / `.close()` control it from your code. The panel is an iframe of `/embed` inside a
shadow root. The host page's CSS can't break the widget and the widget can't read the host page; the two only talk
through origin-checked `postMessage`.

![Embedded widget](docs/screenshots/embedded-widget.png)

### JSON feed

`GET /api/v1/changelog/feed` returns [JSON Feed 1.1](https://jsonfeed.org/version/1.1): sanitized HTML, absolute image
URLs, `#New`/`#Improved`/`#Fixed` tags and reaction counts. It needs no sign-in, is cacheable for 60 s and sends
`Access-Control-Allow-Origin: *`.

---

## Authentication & security

Tokens only ever live in httpOnly cookies, never in JavaScript:

| Token | Lifetime | Cookie path | Notes |
| --- | --- | --- | --- |
| Access | 15 min (JWT `exp`) | `/` | Checked on every request, together with the user's `tokenVersion` |
| Refresh | 7 days | `/api/v1/auth` | Its `jti` is a MongoDB document, so it can be rotated and revoked |

- **Rotation with reuse detection.** Each refresh marks the presented token as rotated and issues a new pair in the
  same *family*. If an already-rotated token shows up again it has probably leaked, so the whole family is revoked and
  everyone holding it must sign in again. Two tabs refreshing at the same moment would look identical to theft, so a
  token rotated less than 10 seconds ago is still honoured. The rotation itself is one atomic MongoDB update, so
  concurrent requests can't both win.
- **Separate secrets and audiences** for access and refresh tokens: a refresh token can never be used as an access
  token.
- **Email verification:** single-use, 24 h link. Login is refused until the link is used.
- **Password reset:** single-use, 30-minute link. Only the newest link works, and the endpoint answers identically
  whether or not the email exists. A completed reset bumps `tokenVersion`, which kills every access token already
  issued, and revokes every refresh token.
- **Timing-safe login:** bcrypt runs even for unknown emails, so response time doesn't reveal who is registered.
- **Only hashes are stored:** link tokens are SHA-256 hashed and passwords bcrypt-hashed (12 rounds).
- **Rate limiting** on login, signup, resend-verification, forgot and reset password: 10 per 5 minutes per IP per
  endpoint.
- **CSRF:** SameSite=Lax cookies, plus an `Origin` check that rejects state-changing requests from other websites.
- **XSS:** the web app renders Markdown with react-markdown (no raw HTML); the feed's HTML goes through sanitize-html.
- **Uploads** are identified by their magic bytes (PNG/JPEG/GIF/WebP), not by name or Content-Type. SVG is refused
  because it can carry scripts. The size limit is 5 MB.
- **Headers:** helmet (CSP, nosniff, frame-deny…) and `Cache-Control: no-store` on API responses.
- **RBAC:** `requireAdmin` on every `/api/v1/admin` route. The React route guard is convenience, not security.

On the client, a `401 token_expired` triggers one silent refresh and a retry. The session is also refreshed a
minute before the token expires, so people rarely see a failed request. A non-secret `session_hint` cookie tells the
app whether a session might exist, so anonymous visitors don't fire requests that are sure to fail.

---

## The unread algorithm

Each user document stores `lastViewedChangelogAt` (returned by the API as `lastViewedChangelogDate`).

```
unread = count of entries where status = "published"
                          and publishedAt <= now            (scheduled posts don't count yet)
                          and publishedAt >  lastViewedChangelogDate
```

A user who has never opened the drawer (`null`) sees every published update as unread. Opening the drawer calls
`POST /mark-read`, which sets the timestamp to *now*, so the badge clears. It comes back as soon as a newer update is
published.

Anonymous visitors (and the embedded widget on other sites) keep their own timestamp in `localStorage` and pass it as
`?since=`, so the badge works without an account.

```
GET  /api/v1/changelog/unread-count    → { unread, lastViewedChangelogDate, latestPublishedAt }
POST /api/v1/changelog/mark-read       → { unread: 0, lastViewedChangelogDate: <now>, latestPublishedAt }
```

---

## API reference

Base URL `http://localhost:8000/api/v1`. Interactive docs: <http://localhost:8000/docs>.

Errors are uniform: `{"detail": {"code": "not_found", "message": "Update not found"}}`. Validation errors (422) list
each field: `{"detail": [{"loc": ["body", "title"], "msg": "Title is required", "type": "too_small"}]}`.

### Auth: `/auth`

| Method | Path | Purpose |
| --- | --- | --- |
| POST | `/signup` | Create account, send verification link |
| POST | `/verify-email` | Confirm the address |
| POST | `/resend-verification` | New link (always 200) |
| POST | `/login` | Set access + refresh cookies |
| POST | `/refresh` | Rotate the token pair |
| POST | `/logout` | Revoke the session, clear cookies |
| POST | `/forgot-password` | Send reset link (always 200) |
| POST | `/reset-password` | Set a new password, end all sessions |
| GET | `/me` | Current user |

### Public: `/changelog`

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/` | Timeline: `category`, `q`, `page`, `pageSize` |
| GET | `/feed` | JSON Feed 1.1: `category`, `limit` |
| GET | `/unread-count` | Unread badge (`since` for anonymous viewers) |
| POST | `/mark-read` | Mark everything read (signed in) |
| GET | `/:slug` | One update |
| POST | `/:id/reactions` | Toggle `heart` / `tada` / `rocket` (signed in) |

### Admin: `/admin` (admin role only)

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/entries` | All entries incl. drafts, with counts |
| POST | `/entries` | Create |
| GET | `/entries/:id` | Read one |
| PATCH | `/entries/:id` | Partial update |
| POST | `/entries/:id/publish` | Publish (or schedule) |
| POST | `/entries/:id/unpublish` | Back to draft |
| DELETE | `/entries/:id` | Delete |
| POST | `/uploads` | Image upload (multipart field `file`) |

`GET /dev/mailbox` lists simulated emails. It returns 404 when `NODE_ENV=production` or `EMAIL_SIMULATION=false`.

### Postman

`postman/changelog-hub.postman_collection.json` walks the whole API in order: signup → verify (the token is read from
the dev mailbox automatically) → login → refresh → reset, then admin CRUD and upload, then the public timeline, feed,
unread tracker and reactions. Import it into Postman and press *Run*, or run it headless while the API is running:

```powershell
npx newman run postman/changelog-hub.postman_collection.json --working-dir postman
# 41 requests, 59 assertions, 0 failures
```

---

## Environment variables

`npm run setup` creates both `.env` files. `.env` files are git-ignored; only the `.env.example` templates are
committed.

### `server/.env`

| Variable | Default | Notes |
| --- | --- | --- |
| `NODE_ENV` | `development` | `production` requires `COOKIE_SECURE=true` and disables the dev inbox |
| `PORT` | `8000` | API port |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/changelog_hub` | Local MongoDB or an Atlas `mongodb+srv://` string. Must match the port your MongoDB actually listens on (see `MONGO_PORT`). |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | — | **Required**, 32+ random characters each, different from each other |
| `ACCESS_TOKEN_TTL_MINUTES` / `REFRESH_TOKEN_TTL_DAYS` | `15` / `7` | Token lifetimes |
| `REFRESH_REUSE_GRACE_SECONDS` | `10` | Tolerates two tabs refreshing at once |
| `COOKIE_SECURE` / `COOKIE_SAMESITE` / `COOKIE_DOMAIN` | `false` / `lax` / empty | Use `true` + `none` when the web app and API are on different sites |
| `CORS_ORIGINS` | `http://localhost:5173` | Comma-separated allowed origins |
| `FRONTEND_URL` / `PUBLIC_API_URL` | localhost defaults | Used in email links and absolute feed URLs |
| `EMAIL_SIMULATION` | `true` | Emails go to MongoDB + console, readable at `/dev/mailbox` |
| `EMAIL_VERIFICATION_TTL_HOURS` / `PASSWORD_RESET_TTL_MINUTES` | `24` / `30` | Link lifetimes |
| `UPLOAD_DIR` / `MAX_UPLOAD_MB` | `uploads` / `5` | Where images are stored, and the size limit |
| `RATE_LIMIT_ENABLED` / `RATE_LIMIT_ATTEMPTS` / `RATE_LIMIT_WINDOW_SECONDS` | `true` / `10` / `300` | Per IP, per auth endpoint |
| `BCRYPT_ROUNDS` | `12` | Password hashing cost |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | demo values | First admin, created on startup. **Change before deploying.** |

### `frontend/.env`

| Variable | Default | Notes |
| --- | --- | --- |
| `VITE_API_PROXY_TARGET` | `http://localhost:8000` | Where the dev server forwards `/api` and `/uploads` |
| `VITE_API_URL` | empty | Set only when the built app is served from a different origin than the API |
| `VITE_PRODUCT_NAME` | `Tempo` | Product name shown in the UI |

---

## Tests

```powershell
npm test                          # 29 API tests (Vitest + Supertest, in-memory MongoDB)
npm run build                     # type-checks and builds the API and the web app
```

The API tests start their own in-memory MongoDB, so they need no database or `.env`. The first run downloads a MongoDB
binary, which takes about a minute. They cover signup/verification, cookie flags, rotation and reuse detection, the
two-tab race, expired and forged tokens, logout, password reset, the CSRF origin check, admin RBAC, CRUD and slugs,
drafts and scheduling, category filter and search (including regex-special characters), pagination, the unread
algorithm, reactions (including a 10-request race), the sanitized JSON feed, upload sniffing and the dev mailbox.

CI (`.github/workflows/ci.yml`) runs the type-check, tests and both builds on every push.

---

## Project layout

```
changelog-hub/
├── package.json            root scripts: install:all, setup, seed, dev, test, build
├── docker-compose.yml      optional local MongoDB
├── scripts/setup-env.mjs   creates the .env files with random secrets
├── server/                 Express API (Node.js + TypeScript)
│   ├── openapi.yaml        API documentation served at /docs
│   ├── src/
│   │   ├── config/         env validation (Zod), constants
│   │   ├── models/         Mongoose schemas: User, ChangelogEntry, Reaction, RefreshToken, OneTimeToken, OutboxEmail
│   │   ├── middleware/     auth + RBAC, CSRF origin guard, rate limit, validation, uploads, errors
│   │   ├── services/       tokens, auth flows, entries/unread/feed, simulated email
│   │   ├── controllers/    request → service → response
│   │   ├── routes/         URL map
│   │   ├── scripts/seed.ts demo data
│   │   ├── app.ts          Express app wiring
│   │   └── server.ts       starts the HTTP server
│   └── tests/              Vitest + Supertest
├── frontend/               React app (Vite + TypeScript)
│   ├── src/
│   │   ├── components/ui/  coss ui primitives
│   │   ├── components/app/ timeline article, drawer, markdown, reactions, header
│   │   ├── features/       TanStack Query hooks (changelog, admin)
│   │   ├── auth/           session context + route guards
│   │   ├── pages/          timeline, entry, auth, dev inbox, admin studio, embed
│   │   └── lib/            API client, types, formatting, Markdown editing
│   └── public/widget.js    embeddable script
├── postman/                API collection + sample image
└── docs/                   screenshots, video script
```

---

## Assumptions and limitations

**Assumptions**

- One product, one changelog. Multi-tenancy would add a `workspace` field and scope every query by it.
- Anyone can sign up as a reader. Admins come from `ADMIN_EMAIL` or the database, not self-service sign-up.
- A brand-new reader has never opened the drawer, so every published update counts as unread.
- Email is simulated on purpose, so reviewers can run verification and reset without SMTP credentials.
  `sendEmail()` in `server/src/services/mail.service.ts` is the single place to plug in SES, Resend or SMTP.

**Known limitations**

- **Rate limiting is in memory.** It's correct for one API process but not behind a load balancer; a Redis store for
  `express-rate-limit` fixes that.
- **Scheduled posts go live lazily.** A future `publishedAt` simply becomes visible when its time comes, because
  visibility is a query filter. There's no background job, so nothing is emailed at that moment.
- **Search uses case-insensitive regex.** That's fine at this size. For tens of thousands of entries, switch to a MongoDB
  text index or Atlas Search; that's a query change, not a redesign.
- **Uploads are stored on local disk.** Use S3 or similar in production; the API already returns URLs, not file
  paths.
- **No frontend unit tests.** The flows were verified in a real browser (Playwright driving Edge through all 18 main
  journeys), but those scripts aren't committed.
