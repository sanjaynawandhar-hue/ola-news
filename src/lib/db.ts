import { PrismaClient } from '@/generated/prisma/client';
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

function createAdapter() {
  if (/^postgres(ql)?:\/\//i.test(databaseUrl)) {
    return new PrismaPg({ connectionString: databaseUrl });
  }
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
