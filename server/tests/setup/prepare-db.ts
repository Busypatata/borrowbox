/**
 * Creates (if needed) and migrates the dedicated TEST database by applying the committed
 * Prisma migration SQL files in order. Safe to run repeatedly; never touches DATABASE_URL.
 */
import fs from 'node:fs';
import path from 'node:path';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
const testUrl = new URL(process.env.TEST_DATABASE_URL ?? 'postgresql://borrowbox:borrowbox@localhost:5432/borrowbox_test');
const dbName = testUrl.pathname.slice(1);
if (!/test/i.test(dbName)) throw new Error(`TEST_DATABASE_URL database name must contain "test" (got "${dbName}")`);

const admin = new URL(testUrl.toString());
admin.pathname = '/postgres';

async function main() {
  const a = new pg.Client({ connectionString: admin.toString() });
  await a.connect();
  const exists = await a.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName]);
  if (exists.rowCount === 0) await a.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
  await a.end();

  const c = new pg.Client({ connectionString: testUrl.toString() });
  await c.connect();
  await c.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;'); // test DB only
  const dir = path.resolve(process.cwd(), 'prisma/migrations');
  const folders = fs.readdirSync(dir).filter((f) => fs.statSync(path.join(dir, f)).isDirectory()).sort();
  for (const f of folders) await c.query(fs.readFileSync(path.join(dir, f, 'migration.sql'), 'utf8'));
  await c.end();
  console.log(`Test database "${dbName}" ready (${folders.length} migrations applied).`);
}
main().catch((e) => { console.error(e); process.exit(1); });
