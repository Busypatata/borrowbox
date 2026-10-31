// Runs before every test file. Forces the TEST database and refuses anything that doesn't look like one.
const url =
  process.env.TEST_DATABASE_URL ?? 'postgresql://borrowbox:borrowbox@localhost:5432/borrowbox_test';
if (!/test/i.test(new URL(url).pathname)) {
  throw new Error(`Refusing to run tests against a database whose name does not contain "test": ${url}`);
}
process.env.DATABASE_URL = url;
process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET ??= 'integration-test-secret-integration-test-secret';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.DISABLE_RATE_LIMIT = 'true';
process.env.STORAGE_PROVIDER = 'local';
process.env.LOG_LEVEL = 'silent';
