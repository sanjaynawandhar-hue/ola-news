import { withApi, ok, parseBody } from '@/lib/api';
import { refreshRequestSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { runRefresh } from '@/lib/ingest/pipeline';
import { serverEnv } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

/**
 * Starts a refresh. Only one may run at a time — a second request while a job
 * is in flight returns the running job rather than starting a duplicate, which
 * is what keeps the Refresh button idempotent under repeated clicks.
 */
export const POST = withApi(
  async (request) => {
    const body = await parseBody(request, refreshRequestSchema).catch(() => ({
      sourceKeys: undefined,
      trigger: 'manual' as const,
    }));

    const running = await prisma.refreshJob.findFirst({
      where: { status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
    });

    if (running) {
      // Guard against a job orphaned by a server restart.
      const ageMs = Date.now() - running.startedAt.getTime();
      if (ageMs < 15 * 60000) {
        return ok({ jobId: running.id, alreadyRunning: true }, { status: 202 });
      }
      await prisma.refreshJob.update({
        where: { id: running.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: 'Job did not complete and was superseded by a new refresh.',
        },
      });
    }

    const jobId = await runRefresh({
      trigger: body.trigger ?? 'manual',
      sourceKeys: body.sourceKeys,
    });
    return ok({ jobId, alreadyRunning: false }, { status: 202 });
  },
  { limit: serverEnv.rateLimit.refreshMax, bucket: 'refresh' },
);

/** Last completed refresh, used to populate "last successful refresh". */
export const GET = withApi(async () => {
  const [last, running] = await Promise.all([
    prisma.refreshJob.findFirst({
      where: { status: { in: ['COMPLETED', 'COMPLETED_WITH_ERRORS'] } },
      orderBy: { finishedAt: 'desc' },
    }),
    prisma.refreshJob.findFirst({ where: { status: 'RUNNING' }, orderBy: { startedAt: 'desc' } }),
  ]);
  // A dashboard that has never refreshed is a normal state, not an error.
  return ok({
    lastSuccessAt: last?.finishedAt?.toISOString() ?? null,
    lastJobId: last?.id ?? null,
    runningJobId: running?.id ?? null,
  });
});
