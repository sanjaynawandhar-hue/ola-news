import { withApi, ok, fail, parseBody } from '@/lib/api';
import { sourceCreateSchema, sourceUpdateSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { serverEnv, hasCredential } from '@/lib/env';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

/**
 * Source health. `effectiveMode` reflects reality rather than configuration:
 * a source declared LIVE but missing its credential is reported as
 * AWAITING_CREDENTIALS, so the page never overstates what is actually running.
 */
export const GET = withApi(async () => {
  const sources = await prisma.source.findMany({ orderBy: { sortOrder: 'asc' } });
  const counts = await prisma.article.groupBy({ by: ['sourceId'], _count: { _all: true } });
  const countBySource = new Map(counts.map((c) => [c.sourceId, c._count._all]));

  const recentFailures = await prisma.sourceFailure.findMany({
    orderBy: { occurredAt: 'desc' },
    take: 100,
    select: { sourceId: true, message: true, statusCode: true, occurredAt: true },
  });

  return ok({
    items: sources.map((source) => {
      const credentialMissing = source.requiresCredential && !hasCredential(source.credentialEnvVar);
      return {
        id: source.id,
        key: source.key,
        name: source.name,
        homepage: source.homepage,
        endpoint: source.endpoint,
        adapter: source.adapter,
        sourceType: source.sourceType,
        group: source.group,
        country: source.country,
        language: source.language,
        credibility: source.credibility,
        mode: source.mode,
        effectiveMode: credentialMissing ? 'AWAITING_CREDENTIALS' : source.mode,
        enabled: source.enabled,
        requiresCredential: source.requiresCredential,
        credentialEnvVar: source.credentialEnvVar,
        credentialPresent: !credentialMissing && source.requiresCredential,
        isRegulatory: source.isRegulatory,
        authority: source.authority,
        termsUrl: source.termsUrl,
        complianceNote: source.complianceNote,
        rateLimitMs: source.rateLimitMs,
        timeoutMs: source.timeoutMs,
        maxItems: source.maxItems,
        articleCount: countBySource.get(source.id) ?? 0,
        lastCheckedAt: source.lastCheckedAt?.toISOString() ?? null,
        lastSuccessAt: source.lastSuccessAt?.toISOString() ?? null,
        lastErrorAt: source.lastErrorAt?.toISOString() ?? null,
        lastError: source.lastError,
        consecutiveFailures: source.consecutiveFailures,
        recentFailures: recentFailures
          .filter((f) => f.sourceId === source.id)
          .slice(0, 5)
          .map((f) => ({
            message: f.message,
            statusCode: f.statusCode,
            occurredAt: f.occurredAt.toISOString(),
          })),
      };
    }),
    credentials: Object.entries(serverEnv.credentials).map(([key, value]) => ({
      envVar: key,
      configured: !!value,
    })),
  });
});

export const POST = withApi(async (request) => {
  const data = await parseBody(request, sourceCreateSchema);
  const existing = await prisma.source.findUnique({ where: { key: data.key } });
  if (existing) return fail('A source with that key already exists.', 'CONFLICT', 409);
  const created = await prisma.source.create({
    data: { ...data, sortOrder: 500, enabled: data.mode === 'LIVE' },
  });
  return ok({ id: created.id, key: created.key }, { status: 201 });
});

const patchSchema = sourceUpdateSchema.extend({ key: z.string().min(1).max(60) });

export const PATCH = withApi(async (request) => {
  const { key, ...patch } = await parseBody(request, patchSchema);
  const source = await prisma.source.findUnique({ where: { key } });
  if (!source) return fail('Source not found.', 'NOT_FOUND', 404);

  if (patch.enabled && source.requiresCredential && !hasCredential(source.credentialEnvVar)) {
    return fail(
      `This source cannot be enabled until ${source.credentialEnvVar} is set in the server environment.`,
      'MISSING_CREDENTIAL',
      409,
    );
  }

  // A connector backed by the built-in sample dataset must stay in DEMO mode.
  // Re-labelling it LIVE would present sample records as real news.
  if (patch.mode && patch.mode !== 'DEMO' && source.adapter === 'demo') {
    return fail(
      'This source serves the built-in sample dataset, so it must stay in DEMO mode. ' +
        'Disable it instead, or run `npm run demo:off` to switch to live sources only.',
      'DEMO_SOURCE_MODE',
      409,
    );
  }
  const updated = await prisma.source.update({ where: { key }, data: patch });
  return ok({ key: updated.key, enabled: updated.enabled, mode: updated.mode });
});

export const DELETE = withApi(async (request) => {
  const key = new URL(request.url).searchParams.get('key');
  if (!key) return fail('key is required.', 'BAD_REQUEST', 400);
  await prisma.source.deleteMany({ where: { key } });
  return ok({ deleted: true });
});
