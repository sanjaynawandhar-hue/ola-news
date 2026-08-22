import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaPg } from '@prisma/adapter-pg';
import path from 'node:path';

/**
 * Prisma 7 connects through a driver adapter. The adapter is chosen from the
 * DATABASE_URL scheme, so switching between the zero-config SQLite dev database
 * and a production PostgreSQL instance needs only an environment change plus
 * `npm run db:use-postgres` to flip the schema provider.
 */
const databaseUrl = process.env.DATABASE_URL ?? 'file:./dev.db';

/**
 * SQLite paths are resolved against the process working directory, which is not
 * guaranteed to be the project root once the app is built and deployed. The URL
 * is normalised to an absolute path so the same DATABASE_URL works from `next
 * dev`, `next start`, the seed script and the test runner alike.
 */
function resolveSqliteUrl(url: string): string {
  const filePath = url.replace(/^file:/, '');
  if (filePath === ':memory:' || path.isAbsolute(filePath)) return `file:${filePath}`;
  // turbopackIgnore keeps the bundler from tracing the whole project for
  // this runtime-only path resolution.
  return `file:${path.resolve(/*turbopackIgnore: true*/ process.cwd(), filePath)}`;
}

/**
 * The Prisma schema bakes its provider in at generate time, while the adapter
 * here is chosen from DATABASE_URL at runtime. If the two disagree Prisma fails
 * with a message that does not say how to fix it, so the mismatch is checked
 * first — it happens whenever the schema was switched for a deploy and not
 * switched back.
 */
function assertProviderMatches(expected: 'postgresql' | 'sqlite') {
  // The generated client records the provider it was built for.
  const actual = (Prisma as { datamodel?: { provider?: string } }).datamodel?.provider;
  if (!actual || actual === expected) return;
  throw new Error(
    `DATABASE_URL points at ${expected}, but the Prisma client was generated for ` +
      `${actual}. Run \`npm run db:sync-provider && npm run db:generate\` to realign them ` +
      `(the provider is switched automatically during a deploy build).`,
  );
}

function createAdapter() {
  if (/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    assertProviderMatches('postgresql');
    return new PrismaPg({ connectionString: databaseUrl });
  }
  assertProviderMatches('sqlite');
  return new PrismaBetterSqlite3({ url: resolveSqliteUrl(databaseUrl) });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: createAdapter(),
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
