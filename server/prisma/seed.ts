/**
 * Reference-data seed. Safe to run any number of times, in any environment.
 *
 * It inserts ONLY what the application needs to function: the listing categories.
 * It creates no demo members, listings, requests, messages, notifications or reviews.
 *
 * Optional: create the first administrator by setting BOTH variables for this one command, e.g.
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='a-strong-password' npm run db:seed
 * (or promote an existing account:  UPDATE "User" SET role = 'ADMIN' WHERE email = 'you@example.com';)
 */
import { prisma } from '../src/config/prisma';
import { ensureCategories } from '../src/maintenance/referenceData';
import { hashPassword } from '../src/utils/crypto';

async function main() {
  await ensureCategories(prisma);
  console.log('Reference data ready (categories).');

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email && !password) return;
  if (!email || !password) throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to create an administrator.');
  if (password.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { role: 'ADMIN' } });
    console.log(`Existing account ${email} promoted to administrator (password unchanged).`);
    return;
  }
  await prisma.user.create({
    data: {
      name: 'Administrator', email, passwordHash: await hashPassword(password), role: 'ADMIN',
      emailVerifiedAt: new Date(), notificationPref: { create: {} },
    },
  });
  console.log(`Administrator ${email} created.`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(() => prisma.$disconnect());
