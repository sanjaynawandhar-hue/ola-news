#!/usr/bin/env node
/**
 * Aligns the Prisma datasource provider with whatever DATABASE_URL points at.
 *
 * Prisma requires the provider to be written into schema.prisma — it cannot be
 * read from an environment variable. This project runs SQLite locally (zero
 * setup) and PostgreSQL in production (serverless filesystems are ephemeral),
 * so the committed schema would otherwise be wrong in one of the two places.
 *
 * Running this before `prisma generate` makes the build self-configuring:
 * set DATABASE_URL and the schema follows. It is idempotent and it never
 * touches migrations — unlike `set-db-provider.mjs`, which is the deliberate,
 * destructive switch used when changing a project's database for good.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const url = process.env.DATABASE_URL ?? '';
const provider = /^postgres(ql)?:\/\//i.test(url) ? 'postgresql' : 'sqlite';

const schemaPath = path.join(process.cwd(), 'prisma', 'schema.prisma');
const schema = readFileSync(schemaPath, 'utf8');

const current = /datasource db \{[\s\S]*?provider\s*=\s*"(\w+)"/.exec(schema)?.[1];

if (current === provider) {
  console.log(`[db-provider] schema already targets ${provider}`);
} else {
  const updated = schema.replace(
    /(datasource db \{[\s\S]*?provider\s*=\s*)"(?:sqlite|postgresql)"/,
    `$1"${provider}"`,
  );
  if (updated === schema) {
    console.error('[db-provider] could not locate the datasource provider in prisma/schema.prisma');
    process.exit(1);
  }
  writeFileSync(schemaPath, updated);
  console.log(`[db-provider] ${current ?? 'unknown'} -> ${provider} (from DATABASE_URL)`);
}

if (provider === 'sqlite' && process.env.VERCEL) {
  console.error('');
  console.error('[db-provider] REFUSING TO BUILD: DATABASE_URL points at SQLite on Vercel.');
  console.error('  Serverless filesystems are ephemeral — every deploy would wipe your data,');
  console.error('  and instances do not share a disk. Set DATABASE_URL to a hosted PostgreSQL');
  console.error('  connection string (Neon, Supabase, Prisma Postgres…) in the project settings.');
  console.error('');
  process.exit(1);
}
