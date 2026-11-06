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

