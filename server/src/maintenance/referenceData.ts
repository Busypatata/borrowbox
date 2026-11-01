import { CATEGORIES } from '@borrowbox/shared';
import type { PrismaClient } from '@prisma/client';

/** Reference data the app cannot work without (listing categories). Idempotent; never touches user data. */
export async function ensureCategories(db: Pick<PrismaClient, 'category'>) {
  for (const [i, c] of CATEGORIES.entries()) {
    await db.category.upsert({
      where: { slug: c.slug },
      update: { label: c.label, sortOrder: i },
      create: { slug: c.slug, label: c.label, sortOrder: i },
    });
  }
}
