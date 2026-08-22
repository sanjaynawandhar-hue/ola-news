import { z } from 'zod';
import { withApi, ok, parseBody } from '@/lib/api';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export const GET = withApi(async (request) => {
  const unreadOnly = new URL(request.url).searchParams.get('unreadOnly') === 'true';
  const [events, unreadCount] = await Promise.all([
    prisma.alertEvent.findMany({
      where: unreadOnly ? { readAt: null } : {},
      include: {
        alert: { select: { name: true } },
        article: { select: { id: true, title: true, publisher: true, url: true, publishedAt: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 60,
    }),
    prisma.alertEvent.count({ where: { readAt: null } }),
  ]);

  return ok({
    items: events.map((event) => ({
      id: event.id,
      alertName: event.alert.name,
      title: event.title,
      message: event.message,
      severity: event.severity,
      readAt: event.readAt?.toISOString() ?? null,
      createdAt: event.createdAt.toISOString(),
      article: event.article
        ? { ...event.article, publishedAt: event.article.publishedAt.toISOString() }
        : null,
    })),
    unreadCount,
  });
});

const markSchema = z.object({ ids: z.array(z.string()).optional(), all: z.boolean().optional() });

export const PATCH = withApi(async (request) => {
  const { ids, all } = await parseBody(request, markSchema);
  const result = await prisma.alertEvent.updateMany({
    where: all ? { readAt: null } : { id: { in: ids ?? [] } },
    data: { readAt: new Date() },
  });
  return ok({ marked: result.count });
});
