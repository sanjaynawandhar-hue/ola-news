import { z } from 'zod';
import { withApi, ok, fail, parseBody } from '@/lib/api';
import { alertSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { NOTIFIERS } from '@/lib/alerts';
import { parseJson, stringifyJson } from '@/lib/utils';
import type { AlertCriteria } from '@/types';

export const dynamic = 'force-dynamic';

export const GET = withApi(async () => {
  const alerts = await prisma.alert.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { events: true } } },
  });
  return ok({
    items: alerts.map((alert) => ({
      id: alert.id,
      name: alert.name,
      description: alert.description,
      enabled: alert.enabled,
      throttleMins: alert.throttleMins,
      channels: parseJson<string[]>(alert.channels, ['inapp']),
      criteria: parseJson<AlertCriteria>(alert.criteria, {}),
      lastTriggeredAt: alert.lastTriggeredAt?.toISOString() ?? null,
      eventCount: alert._count.events,
      createdAt: alert.createdAt.toISOString(),
    })),
    // Email and Slack are registered but disabled; the UI shows them greyed out
    // rather than pretending delivery will happen.
    channels: NOTIFIERS.map((n) => ({ channel: n.channel, enabled: n.enabled })),
  });
});

export const POST = withApi(async (request) => {
  const data = await parseBody(request, alertSchema);
  const created = await prisma.alert.create({
    data: {
      name: data.name,
      description: data.description ?? null,
      enabled: data.enabled,
      throttleMins: data.throttleMins,
      channels: stringifyJson(data.channels),
      criteria: stringifyJson(data.criteria),
    },
  });
  return ok({ id: created.id }, { status: 201 });
});

const patchSchema = alertSchema.partial().extend({ id: z.string().min(1).max(60) });

export const PATCH = withApi(async (request) => {
  const { id, ...patch } = await parseBody(request, patchSchema);
  const alert = await prisma.alert.findUnique({ where: { id } });
  if (!alert) return fail('Alert not found.', 'NOT_FOUND', 404);

  const updated = await prisma.alert.update({
    where: { id },
    data: {
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
      ...(patch.throttleMins !== undefined ? { throttleMins: patch.throttleMins } : {}),
      ...(patch.channels !== undefined ? { channels: stringifyJson(patch.channels) } : {}),
      ...(patch.criteria !== undefined ? { criteria: stringifyJson(patch.criteria) } : {}),
    },
  });
  return ok({ id: updated.id, enabled: updated.enabled });
});

export const DELETE = withApi(async (request) => {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return fail('id is required.', 'BAD_REQUEST', 400);
  await prisma.alert.deleteMany({ where: { id } });
  return ok({ deleted: true });
});
