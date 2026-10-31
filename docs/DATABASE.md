# Database

PostgreSQL 16 via Prisma (`server/prisma/schema.prisma`). Prisma runs with `engineType = "client"` and `@prisma/adapter-pg` (no Rust query engine binary).

## Models
`User`, `Session`, `PasswordResetToken`, `EmailVerificationToken`, `Category`, `Item`, `ItemImage`, `Favorite`, `BorrowRequest`, `Transaction`, `Conversation`, `Message`, `Notification`, `NotificationPreference`, `Review`, `Report`, `ModerationAction`.

Key relations: Item → owner (User); BorrowRequest → item, borrower, owner; Transaction is 1‑1 with an **approved** BorrowRequest; Review → Transaction + reviewer + reviewed user; Conversation holds two participants and an optional item.

## Integrity rules enforced in the database
Migration `20261029000100_reservation_exclusion` adds (beyond Prisma's schema language):

- `btree_gist` extension and an **EXCLUDE USING gist** constraint on `BorrowRequest(itemId, daterange(startDate, endDate, '[]'))` `WHERE status = 'APPROVED'` — two approved bookings for the same item can never overlap, even under concurrent approvals. Adjacent ranges are allowed only when they do not share a day.
- CHECK constraints: `endDate >= startDate`; `rating BETWEEN 1 AND 5`; reviewer ≠ reviewed user; borrower ≠ owner.
- Unique indexes: `User.email`, `Session.tokenHash`, token hashes, `Favorite(userId,itemId)`, `Review(transactionId,reviewerId)`, `Conversation.key`, `Message(conversationId,senderId,clientId)`, `Notification.dedupeKey`.

## Concurrency
Request creation and approval run in a transaction that takes `SELECT … FOR UPDATE` on the Item row, then re-checks overlap; state transitions use conditional `updateMany` claims so a double click or two tabs cannot apply a transition twice. The exclusion constraint is the last line of defence.

## Security-relevant storage
Session cookies, verification tokens and reset tokens are stored only as hashes. Passwords are argon2id. Exact coordinates are never returned by the API.

## Indexes
Listing search: `(status, createdAt)`, `(categorySlug, status)`, `community`, `city`, `(latitude, longitude)`; requests by `(itemId,status)`, `(borrowerId,status)`, `(ownerId,status)`; notifications `(recipientId, readAt, createdAt)`; messages `(conversationId, createdAt)`.

## Migrations & seed
```bash
npm run db:deploy        # apply committed migrations (production / CI)
npm run db:migrate       # create+apply a new migration in development
npm run db:seed          # idempotent demo data (refuses to run when NODE_ENV=production)
```
Seeded dev accounts (`*@borrowbox.test`): `aditi`, `sarah`, `rahul`, `priya` — password `Password123!`; `admin@` uses `SEED_ADMIN_PASSWORD`.

> **Verification note:** in the sandbox where this project was built the Prisma schema-engine download was blocked, so `prisma migrate deploy/dev` itself was **not** executed there. The two SQL migration files were applied with `psql`/`pg` and every constraint was verified. Run `npm run db:deploy` once on your machine to confirm Prisma accepts the migration history.
