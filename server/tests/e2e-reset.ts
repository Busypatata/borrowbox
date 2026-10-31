// Used by the Playwright global setup: empty the test DB and seed categories only.
import { prisma } from '../src/config/prisma';
import { CATEGORIES } from '@borrowbox/shared';

if (!/test/i.test(new URL(process.env.DATABASE_URL ?? '').pathname)) throw new Error('Refusing: not a test database');
const tables = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename::text FROM pg_tables WHERE schemaname='public' AND tablename NOT LIKE '\_prisma%'`;
await prisma.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(',')} RESTART IDENTITY CASCADE`);
for (const [i, c] of CATEGORIES.entries()) await prisma.category.create({ data: { slug: c.slug, label: c.label, sortOrder: i } });
await prisma.$disconnect();
