import { execSync } from 'node:child_process';
import path from 'node:path';

// Brings the TEST database to a known state: migrations applied, tables truncated, categories seeded.
export default function globalSetup() {
  const server = path.resolve(process.cwd(), '../server');
  const DB = process.env.TEST_DATABASE_URL ?? 'postgresql://borrowbox:borrowbox@localhost:5432/borrowbox_test';
  const env = { ...process.env, DATABASE_URL: DB, TEST_DATABASE_URL: DB, NODE_ENV: 'test', SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e-secret', CSRF_SECRET: 'e2e-csrf-e2e-csrf-e2e-csrf-e2e-csrf', CLIENT_URL: 'http://localhost:5173' };
  execSync('npx tsx tests/setup/prepare-db.ts', { cwd: server, env, stdio: 'inherit' });
  execSync('npx tsx tests/e2e-reset.ts', { cwd: server, env, stdio: 'inherit' });
}
