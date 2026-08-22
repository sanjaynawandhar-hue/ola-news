#!/usr/bin/env node
/**
 * Switches the Prisma datasource provider between sqlite (zero-config local
 * development) and postgresql (recommended for production).
 *
 *   npm run db:use-postgres
 *   npm run db:use-sqlite
 *
 * After switching, set DATABASE_URL and run `npx prisma migrate dev --name init`
 * against the new database (existing migrations are provider-specific).
 */
import { readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import path from 'node:path';

const provider = process.argv[2];
if (!['sqlite', 'postgresql'].includes(provider)) {
  console.error('Usage: node scripts/set-db-provider.mjs <sqlite|postgresql>');
  process.exit(1);
}

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');
const updated = schema.replace(
  /(datasource db \{[\s\S]*?provider\s*=\s*)"(sqlite|postgresql)"/,
  `$1"${provider}"`,
);

if (updated === schema && !schema.includes(`provider = "${provider}"`)) {
  console.error('Could not locate the datasource provider in prisma/schema.prisma.');
  process.exit(1);
}
writeFileSync(schemaPath, updated);

const migrationsDir = path.join(process.cwd(), 'prisma', 'migrations');
if (existsSync(migrationsDir)) {
  rmSync(migrationsDir, { recursive: true, force: true });
  console.log('Removed provider-specific migrations in prisma/migrations.');
}

console.log(`Datasource provider set to "${provider}".`);
console.log('Next steps:');
console.log('  1. Set DATABASE_URL in .env');
console.log('  2. npx prisma migrate dev --name init');
console.log('  3. npm run db:seed');
