import { withApi, ok, fail } from '@/lib/api';
import { prisma } from '@/lib/db';
import { parseJson } from '@/lib/utils';
import type { RefreshSummary, SourceProgress } from '@/types';

export const dynamic = 'force-dynamic';

/**
 * Polled by the refresh panel while a job runs. Returns the live per-source
 * progress written by the pipeline, including failures — a failed source is
 * reported, never hidden or replaced with fabricated results.
 */
export const GET = withApi(
  async (request) => {
    const jobId = new URL(request.url).searchParams.get('jobId');

    const job = jobId
      ? await prisma.refreshJob.findUnique({ where: { id: jobId } })
      : await prisma.refreshJob.findFirst({ orderBy: { startedAt: 'desc' } });

    if (!job) return fail('Refresh job not found.', 'NOT_FOUND', 404);

    const failures = await prisma.sourceFailure.findMany({
      where: { refreshJobId: job.id },
      include: { source: { select: { key: true, name: true } } },
      orderBy: { occurredAt: 'desc' },
      take: 40,
    });

    const summary: RefreshSummary = {
      jobId: job.id,
      status: job.status,
      startedAt: job.startedAt.toISOString(),
      finishedAt: job.finishedAt?.toISOString() ?? null,
      sourcesTotal: job.sourcesTotal,
      sourcesCompleted: job.sourcesCompleted,
      sourcesOk: job.sourcesOk,
      sourcesFailed: job.sourcesFailed,
      itemsFetched: job.itemsFetched,
      itemsNew: job.itemsNew,
      duplicatesRemoved: job.duplicatesRemoved,
      alertsRaised: job.alertsRaised,
      progress: parseJson<SourceProgress[]>(job.progress, []),
      error: job.error,
    };

    return ok({
      job: summary,
      failures: failures.map((f) => ({
        sourceKey: f.source.key,
        sourceName: f.source.name,
        stage: f.stage,
        message: f.message,
        statusCode: f.statusCode,
        occurredAt: f.occurredAt.toISOString(),
      })),
    });
  },
  { limit: 600, bucket: 'refresh-status' },
);
