# BorrowBox — Borrow more. Buy less.

A community item-lending marketplace: list things you can lend, find things nearby, request dates, agree pickup by message, hand over / return with confirmations, and build trust through reviews.

**Stack** — React 19 + Vite + TypeScript + Tailwind · Node.js + Express + TypeScript · PostgreSQL + Prisma · cookie-based sessions · Cloudinary images · Vitest + Supertest + Playwright · Vercel + Render + Neon.

```
borrowbox/
├─ shared/   Zod schemas, DTO types, state machines & date rules (used by server AND client)
├─ server/   Express API, Prisma schema + migrations + seed, tests
├─ client/   React app, Vitest component tests, Playwright e2e
├─ docs/     API.md · DATABASE.md · TESTING.md
├─ docker-compose.yml   local Postgres
└─ render.yaml          Render blueprint for the API
```

## Quick start

Prerequisites: Node ≥ 20, npm ≥ 10, Docker (or any PostgreSQL 14+).

```bash
npm install                      # installs all workspaces
cp .env.example .env             # then edit secrets (see below)
npm run db:up                    # start Postgres in Docker
npm run db:generate              # generate Prisma client
npm run db:deploy                # apply migrations
npm run db:seed                  # reference data only (categories) — adds NO demo content
npm run dev                      # API :4000 + web :5173
```
Open http://localhost:5173 and **sign up** — the app starts completely empty: no sample members, listings, requests, messages or notifications. Everything you see is created by real accounts. To try the full flow yourself, sign up two accounts (one normal window, one private window).

Because email is not configured locally, the verification link is **printed in the terminal** running `npm run dev`; copy it into the browser.

**First administrator (optional, for the Moderation page):**
```bash
ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-long-strong-password' npm run db:seed
```
(or promote an account you already signed up with: `UPDATE "User" SET role='ADMIN' WHERE email='you@example.com';`)

### Already ran an earlier version and see sample data?
Older builds shipped a demo seed (Priya Sharma, Sarah Khan, "Canon EOS 200D", …). Remove exactly those records, and nothing else, with:
```bash
npm run db:cleanup-demo                 # dry run: lists what would be removed
npm run db:cleanup-demo -- --apply      # removes it (one transaction)
```
It only matches the old seed's fixed IDs + `@borrowbox.test` emails, so real accounts cannot match. It stops and tells you if a real member's request/conversation/review points at demo records (`--include-real-dependents` to override), and keeps the old `admin@borrowbox.test` account unless you add `--remove-admin` (change that account's password or remove it — its old default password was public).

Generate real secrets: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` (use different values for `SESSION_SECRET` and `CSRF_SECRET`).

In development with no SMTP configured, verification / reset emails are printed in the server console. To test uploads without Cloudinary set `STORAGE_PROVIDER=local` (files go to `server/uploads`, dev only).

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | API + client with reload |
| `npm run typecheck` / `npm run lint` | TypeScript and ESLint, all workspaces |
| `npm test` | server unit+integration, then client unit |
| `npm run test:integration` | server integration against `TEST_DATABASE_URL` |
| `npm run test:e2e` | Playwright (needs `npx playwright install chromium`) |
| `npm run build` | production builds |
| `npm run db:migrate` / `db:deploy` / `db:seed` | Prisma migrations / seed |

See [docs/TESTING.md](docs/TESTING.md) for test prerequisites.

## External services you must configure
| Service | Needed for | Variables |
|---|---|---|
| **Neon** (PostgreSQL) | production DB | `DATABASE_URL` — use the *direct* (non-pooled) connection string so migrations work |
| **Cloudinary** | listing + avatar images | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| **SMTP provider** (Resend, Brevo, SES, …) | verification, reset and notification emails | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `EMAIL_FROM` |
| **Vercel** | web hosting | `VITE_SUPPORT_EMAIL` (optional); edit the destination in `client/vercel.json` |
| **Render** | API hosting | all server variables, see `render.yaml` |

Without Cloudinary the upload endpoints return a 503 "Image uploads are not available" error and the rest of the app still works. Without SMTP in production, emails cannot be delivered, so verification (and therefore listing/borrowing) will not work — configure it before launch.

## Deployment
1. **Neon**: create a project, copy the direct connection string.
2. **Render**: New → Blueprint from this repo (`render.yaml`). Fill the `sync: false` variables. `CLIENT_URL` = your Vercel URL. Migrations run automatically (`preDeployCommand`).
3. **Vercel**: import the repo, set *Root Directory* to `client`. Edit `client/vercel.json` so the `/api/:path*` rewrite points at your Render URL. Because the browser then only talks to your Vercel domain, the session cookie is first-party and `SameSite=Lax` works. (If you prefer calling Render directly, set `VITE_API_BASE_URL` to it, `COOKIE_SAMESITE=none` and `CLIENT_URL` to the Vercel origin; this requires HTTPS and third-party cookies, which some browsers block — the rewrite is recommended.)
4. Set `VITE_API_BASE_URL=/api/v1` in Vercel when using the rewrite.
5. Create an admin: run the seed locally against a **non-production** DB, or promote a user in SQL: `UPDATE "User" SET role='ADMIN' WHERE email='you@example.com';`.
6. Render's free tier sleeps when idle; the first request after a pause can take ~30 s.

## Security summary
Argon2id passwords; opaque HTTP-only `Secure` session cookies stored hashed; per-session CSRF token + Origin check; rate limiting on auth, messaging, reports and uploads; Helmet headers and strict CORS allow-list; all inputs validated with Zod on the server; ownership/participant checks on every private resource (404 instead of 403 where existence would leak); generic responses for register / forgot-password; uploads sniffed by magic bytes and size-limited; exact coordinates and emails never exposed; DB-level exclusion constraint prevents double booking.

## Known limitations (MVP)
- An **approved** booking cannot be cancelled through the API (owner and borrower agree changes by message). Adding cancellation with penalties/notifications is the most obvious next feature.
- Messaging and notifications use **polling** (5–15 s), not WebSockets.
- No payments, deposits, delivery or identity verification.
- Terms and Privacy pages are **starter templates** — have them reviewed by a lawyer before launch.
- Email verification is required to list items, request, or review; unverified users can browse.
- Colour: muted blue `#6F9BCB` fails WCAG AA for white text, so filled blue buttons use the darker `mist-700` (`#44729F`); `#6F9BCB` is used for accents/borders.
- Dates are calendar days in UTC; users far from UTC may see "today" shift by a day near midnight.

## Troubleshooting
- **`prisma generate` fails downloading binaries** (restricted/offline network, 403 from binaries.prisma.sh): the app uses the Rust-free `engineType = "client"` + `@prisma/adapter-pg`, so no engine binary is needed at runtime. Skip the download with `PRISMA_QUERY_ENGINE_LIBRARY=/bin/true PRISMA_SCHEMA_ENGINE_BINARY=/bin/true PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npm run db:generate`. (`prisma migrate` still needs the schema engine, so run migrations on a machine with normal internet access.)
- **Tests refuse to run**: `TEST_DATABASE_URL` must point at a database whose name contains `test`.
- **Login works but requests fail with 403 CSRF**: `CLIENT_URL` must exactly equal the browser origin (scheme + host + port).
- **Cookies not sent in production**: use the Vercel rewrite (above) or `COOKIE_SAMESITE=none` over HTTPS.

## Documentation
[docs/API.md](docs/API.md) · [docs/DATABASE.md](docs/DATABASE.md) · [docs/TESTING.md](docs/TESTING.md)
