import { after } from 'next/server';
import { withApi, ok, fail } from '@/lib/api';
import { prisma } from '@/lib/db';
import { runRefresh } from '@/lib/ingest/pipeline';
import { isAdminRequest } from '@/lib/access';
import { createLogger } from '@/lib/logger';
import { timingSafeEqual } from 'node:crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

const log = createLogger('cron');

/** A refresh still RUNNING beyond this is treated as abandoned. */
const STALE_JOB_MS = 6 * 60_000;

/**
 * Scheduled refresh endpoint.
 *
 * Vercel Cron can only issue a plain GET — it cannot attach the admin token
 * header. Instead it sends `Authorization: Bearer $CRON_SECRET` whenever that
 * environment variable is set, which is what this route verifies.
 *
 * It is a GET, so the read-only guard in `withApi` lets it through; without the
 * check below the whole dashboard could be refreshed by anyone who guessed the
 * URL, draining the shared source rate limits. The admin token is also accepted
 * so the same endpoint can be triggered by hand.
 */
function isAuthorised(request: Request): boolean {
  if (isAdminRequest(request)) return true;

  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const supplied = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!supplied) return false;

  const a = Buffer.from(supplied);
  const b = Buffer.from(secret);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const GET = withApi(
  async (request) => {
    if (!isAuthorised(request)) {
      // Deliberately vague: this endpoint is unauthenticated-by-URL, so it must
      // not confirm whether a secret is configured.
      return fail('Not authorised.', 'UNAUTHORISED', 401);
    }

    if (!process.env.CRON_SECRET && !isAdminRequest(request)) {
      return fail(
        'CRON_SECRET is not configured on the server, so scheduled refreshes are disabled.',
        'CRON_NOT_CONFIGURED',
        503,
      );
    }

    const running = await prisma.refreshJob.findFirst({
      where: { status: 'RUNNING' },
      orderBy: { startedAt: 'desc' },
    });

    if (running) {
      const ageMs = Date.now() - running.startedAt.getTime();
      if (ageMs < STALE_JOB_MS) {
        // Never stack refreshes: a second run would fight the first for the
        // same per-host rate limits and finish neither.
        log.info('cron skipped — refresh already running', { jobId: running.id });
        return ok({ skipped: true, reason: 'A refresh is already running.', jobId: running.id });
      }
      await prisma.refreshJob.update({
        where: { id: running.id },
        data: {
          status: 'FAILED',
          finishedAt: new Date(),
          error: 'Job did not complete and was superseded by a scheduled refresh.',
        },
      });
    }

    const { jobId, run } = await runRefresh({ trigger: 'cron' });
    after(run);

    log.info('cron refresh started', { jobId });
    return ok({ started: true, jobId }, { status: 202 });
  },
  // Generous limit: the schedule controls the real cadence, and a blocked cron
  // run would simply skip a cycle.
  { limit: 30, bucket: 'cron-refresh' },
);
