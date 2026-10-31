# BorrowBox API

Base URL: `/api/v1` (dev: `http://localhost:4000/api/v1`). All bodies are JSON unless noted.

## Conventions

- **Auth**: opaque, HTTP-only cookie `bb_sid`. `POST /auth/login` and `GET /auth/me` return `{ user, csrfToken }`.
- **CSRF**: every state-changing request (POST/PATCH/PUT/DELETE) must send header `X-CSRF-Token: <csrfToken>`, and its `Origin` must match `CLIENT_URL`. Otherwise `403 CSRF_INVALID`.
- **Success envelope**: `{ "data": ..., "meta"?: { page, pageSize, total, totalPages } }`.
- **Error envelope**: `{ "error": { "code": "VALIDATION_ERROR", "message": "...", "fields"?: { "email": "..." } } }`.
- **Status codes**: 400/422 validation, 401 unauthenticated, 403 forbidden / unverified email / CSRF, 404 not found (also used to avoid leaking private resources), 409 conflict (overlapping booking, invalid state transition), 413/415 uploads, 429 rate limited.
- **Dates**: booking dates are calendar days `YYYY-MM-DD` (UTC calendar-day policy, inclusive of both ends).
- **Roles**: *Public* = no login; *Auth* = signed in; *Verified* = signed in with verified email; *Admin*.

## Auth — `/auth`
| Method & path | Access | Notes |
|---|---|---|
| POST `/register` | Public | Always `202` with a generic message (does not reveal existing emails). Rate limited. |
| POST `/login` | Public | `{ email, password, rememberMe? }`. 12 h session, 30 days with `rememberMe`. 10 attempts / 15 min. |
| POST `/logout` | Auth | Revokes current session. |
| POST `/logout-all` | Auth | Revokes every session. |
| GET `/me` | Public | `{ user: null }` when signed out. Returns CSRF token when signed in. |
| POST `/verify-email` | Public | `{ token }`, single use, 24 h. |
| POST `/resend-verification` | Auth | 3 / hour. |
| POST `/forgot-password` | Public | Always generic success. 30-minute single-use token. |
| POST `/reset-password` | Public | `{ token, password, confirmPassword }`. Revokes all sessions. |
| POST `/change-password` | Auth | Revokes other sessions. |

## Users — `/users`
| Method & path | Access | Notes |
|---|---|---|
| GET `/me/stats` | Auth | Dashboard counters. |
| PATCH `/me` | Auth | name, bio, city, community, latitude/longitude. |
| POST `/me/avatar` | Auth | multipart field `image` (JPEG/PNG/WebP, ≤ 5 MB, content-sniffed). |
| DELETE `/me/avatar` | Auth | |
| GET/PATCH `/me/notification-preferences` | Auth | `requestUpdates, messages, reviews, emailEnabled`. Security alerts cannot be disabled. |
| DELETE `/me` | Auth | `{ password, confirm: "DELETE" }`. Anonymises account, archives items. |
| GET `/:userId` | Public | Public profile (no email, no coordinates). |
| GET `/:userId/reviews` | Public | Paginated. |

## Items — `/items`, `/categories`
| Method & path | Access | Notes |
|---|---|---|
| GET `/categories` | Public | |
| GET `/items` | Public | Query: `q, category, condition, community, city, availableFrom, availableTo, lat, lng, radiusKm, sort (newest\|distance\|title), page, pageSize, ownerId`. Excludes items with approved bookings overlapping the range. Distances rounded to 0.5 km. |
| GET `/items/mine` | Auth | Includes archived/hidden. |
| POST `/items` | Verified | Create. |
| GET `/items/:id` | Public | `pickupInstructions` only for owner / borrower of an approved request. Hidden/archived items return 404 to others. |
| GET `/items/:id/similar` | Public | |
| PATCH `/items/:id` | Owner | |
| DELETE `/items/:id` | Owner | Archives (soft delete); refused while loans are active. |
| POST `/items/:id/reactivate` | Owner | |
| POST `/items/:id/images` | Owner | multipart `images` (≤ 5 per item). |
| DELETE `/items/:id/images/:imageId` | Owner | |

## Favourites — `/favorites`
GET `/`, POST `/:itemId`, DELETE `/:itemId` (Auth, idempotent).

## Requests — `/requests`
| Method & path | Access | Notes |
|---|---|---|
| POST `/` | Verified | `{ itemId, startDate, endDate, message? }`. Rejects own item, past dates, > max days, overlap with approved bookings, duplicate pending request. |
| GET `/incoming`, `/outgoing` | Auth | `?status=&page=` |
| GET `/:id` | Participants | |
| POST `/:id/approve` | Owner | Row-locks the item, creates the Transaction, auto-declines overlapping pending requests. `409` on conflict. |
| POST `/:id/decline` | Owner | `{ reason? }` |
| POST `/:id/cancel` | Borrower | Pending requests only. |

## Transactions — `/transactions`
GET `/` (`?role=&status=&page=`), GET `/:id`, POST `/:id/confirm-handover` (owner), `/:id/request-return` (borrower), `/:id/confirm-return` (owner), POST `/:id/reviews` (Verified; `{ rating 1–5, comment? }`, one per participant per completed loan).

State machine: `AWAITING_HANDOVER —owner confirms→ BORROWED —borrower requests return→ RETURN_REQUESTED —owner confirms→ COMPLETED` (owner may also confirm directly from `BORROWED`).

## Conversations — `/conversations`
GET `/`, GET `/unread-count`, POST `/` (`{ recipientId, itemId?, requestId?, body? }` — find-or-create), GET `/:id`, GET `/:id/messages?cursor=`, POST `/:id/messages` (`{ body, clientId? }`, idempotent on `clientId`, 60/min), POST `/:id/read`.

## Notifications — `/notifications`
GET `/`, GET `/unread-count`, POST `/read-all`, POST `/:id/read`.

## Reports & moderation
| Method & path | Access |
|---|---|
| POST `/reports` | Auth — `{ itemId \| reportedUserId, reason, details? }`; 10 / hour; a second open report on the same target returns `409`. |
| GET `/admin/reports?status=` | Admin |
| GET `/admin/reports/:id` | Admin |
| POST `/admin/reports/:id/resolve` | Admin — `{ status, note?, hideItem? }`; writes a ModerationAction. |
| POST `/admin/items/:id/hide` · `/restore` | Admin |

## Operational
`GET /health` (liveness), `GET /ready` (checks the database). `GET/POST /__test/outbox*` exist **only** when `NODE_ENV=test` or `ENABLE_TEST_ENDPOINTS=true` and are never mounted in production.

## Rate limits
Global 300 / min / IP · login 10 / 15 min · register 10 / h · password reset 5 / h · verification 5 / h · resend 3 / h · messages 60 / min · reports 10 / h · uploads 30 / 10 min.
