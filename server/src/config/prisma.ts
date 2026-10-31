import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from './env';

/**
 * Prisma runs with the Rust-free query compiler (`engineType = "client"`) and the
 * `pg` driver adapter, so no native query-engine binary is needed at runtime.
 */
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({
  adapter,
  log: env.isProd ? ['error'] : ['error', 'warn'],
});

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
export type Db = typeof prisma | Tx;
