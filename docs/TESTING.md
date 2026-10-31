# Testing

| Layer | Tool | Where | Command |
|---|---|---|---|
| Server unit | Vitest | `server/tests/unit` | `npm run test:unit -w server` |
| Server integration (real Postgres, HTTP via Supertest) | Vitest + Supertest | `server/tests/integration` | `npm run test:integration -w server` |
| Client unit/component | Vitest + Testing Library (jsdom) | `client/tests/unit` | `npm test -w client` |
| End-to-end (real server + DB + Vite) | Playwright | `client/tests/e2e` | `npm run test:e2e -w client` |

## Requirements
- A running PostgreSQL and an empty database whose name contains `test` (default `borrowbox_test`; set `TEST_DATABASE_URL`). Test harnesses **refuse** to run against any other database name.
- `docker compose up -d db`, then create it: `docker compose exec db createdb -U borrowbox borrowbox_test`.
- E2E: `npx playwright install chromium` once. If you have a Chromium that doesn't match the Playwright version, set `PW_CHROMIUM_PATH=/path/to/chrome`.

## What is covered
- **Rules/units**: date-range validation, overlap logic, state machines, rating maths, notification rules, conversation keys, crypto helpers, client formatting utilities.
- **Integration** (109 tests): registration/verification/login/logout/reset/change-password, session revocation, CSRF and Origin enforcement, authorisation (IDOR) on every owner/participant resource, listing CRUD, search filters and availability, image upload validation, request→approve→handover→return→review lifecycle, **concurrent approvals** (exactly one wins), DB exclusion constraint, favourites, messaging (idempotency, read cursors, authorisation), notifications (dedupe, preferences), reports and moderation.
- **Client** (29 tests): route guards, login/signup validation, request-card role-based actions, favourite interaction, borrow-form date validation, navigation landmarks, pagination.
- **E2E** (8 tests): sign-up→verify→sign-in→sign-out; duplicate sign-up privacy; wrong password; password reset; full two-user lending lifecycle (list → search → wish-list → request → approve → pickup info → handover → return → confirm → review → message); overlap/own-item protections; no horizontal overflow on desktop and phone viewports.

## Not covered / honest gaps
- No automated visual-regression or full axe accessibility audit (labels/roles are asserted in a few places only).
- Cloudinary and real SMTP are not exercised (local storage + in-memory outbox are used in tests).
- Load/performance testing was not done.
