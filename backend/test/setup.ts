import { beforeAll, beforeEach, afterAll } from 'vitest';

process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET ??= 'plunt-test-secret';
process.env.DATABASE_URL ??= 'postgresql://plunt:plunt_dev@localhost:5432/plunt_test';

// Refuse to run against any database whose URL doesn't look like a test DB —
// the setup truncates users/sessions/auth_tokens, which would nuke real data.
if (!/test/i.test(process.env.DATABASE_URL) && process.env.ALLOW_DESTRUCTIVE_TESTS !== '1') {
  throw new Error(
    `Refusing to run tests: DATABASE_URL does not contain "test" (got ${process.env.DATABASE_URL}).`,
  );
}

// Imported after env is set so prisma initializes with the test connection string.
const { getPrisma } = await import('../src/lib/prisma');

beforeAll(async () => {
  await getPrisma().$connect();
});

beforeEach(async () => {
  // Cascade deletes clean up sessions + auth_tokens via FK onDelete: Cascade.
  await getPrisma().$executeRawUnsafe(
    'TRUNCATE TABLE "users", "sessions", "auth_tokens" RESTART IDENTITY CASCADE',
  );
});

afterAll(async () => {
  await getPrisma().$disconnect();
});
