import { withApi, fail, parseBody } from '@/lib/api';
import { briefingSchema } from '@/lib/validation';
import { prisma } from '@/lib/db';
import { getArticlesByIds, getOverview, getRegulatory } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { buildBriefing } from '@/lib/export/pptx';
import { slugify, stringifyJson } from '@/lib/utils';
import { REGULATORY_DOC_TYPE_LABELS, type RegulatoryDocType } from '@/lib/constants';
import { parseJson } from '@/lib/utils';
import type { PptxThemeKey } from '@/lib/export/theme';
import type { RegulatoryItem } from '@/types';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/** Builds and returns a real .pptx file. */
export const POST = withApi(
  async (request) => {
    const body = await parseBody(request, briefingSchema);
    const settings = await getSettings();

    let articleIds = body.articleIds;

    // "Auto-select top stories" pulls the highest automatic importance scores.
    if (body.autoSelectTop && body.autoSelectTop > 0) {
      const windowDays = body.type === 'WEEKLY' ? 7 : 1;
      const auto = await prisma.article.findMany({
        where: {
          processingStatus: 'PROCESSED',
          publishedAt: { gte: new Date(Date.now() - windowDays * 86400000) },
          ...(body.type === 'RISK' ? { risk: { is: { level: { in: ['HIGH', 'CRITICAL'] } } } } : {}),
        },
        select: { id: true },
        orderBy: [{ analysis: { importanceScore: 'desc' } }, { publishedAt: 'desc' }],
        take: body.autoSelectTop,
      });
      articleIds = Array.from(new Set([...articleIds, ...auto.map((a) => a.id)]));
    }

    const articles = await getArticlesByIds(articleIds);

    let regulatory: RegulatoryItem[] = [];
    if (body.regulatoryIds.length > 0) {
      const rows = await prisma.regulatoryDocument.findMany({
        where: { id: { in: body.regulatoryIds } },
        include: { source: { select: { name: true, mode: true } } },
      });
      regulatory = rows.map((row) => ({
        id: row.id,
        authority: row.authority,
        companyKeys: parseJson<string[]>(row.companyKeys, []),
        docType: row.docType as RegulatoryDocType,
        docTypeLabel: REGULATORY_DOC_TYPE_LABELS[row.docType as RegulatoryDocType] ?? row.docType,
        title: row.title,
        summary: row.summary,
        whyItMatters: row.whyItMatters,
        issueDate: row.issueDate.toISOString(),
        effectiveDate: row.effectiveDate?.toISOString() ?? null,
        responseDeadline: row.responseDeadline?.toISOString() ?? null,
        severity: row.severity as RegulatoryItem['severity'],
        status: row.status,
        documentUrl: row.documentUrl,
        isPrimaryDocument: row.isPrimaryDocument,
        isDemo: row.isDemo,
        sourceName: row.source.name,
        sourceMode: row.source.mode as RegulatoryItem['sourceMode'],
      }));
    } else if (body.type === 'REGULATORY') {
      const page = await getRegulatory({ pageSize: 12, page: 1 });
      regulatory = page.items;
    }

    if (articles.length === 0 && regulatory.length === 0) {
      return fail(
        'Select at least one story or regulatory item before generating a briefing.',
        'EMPTY_BRIEFING',
        400,
      );
    }

    const overview =
      body.includeTrendSlide || body.includeComparisonSlide
        ? await getOverview({ days: body.type === 'WEEKLY' ? 30 : 14, timezone: settings.timezone })
        : null;

    const { buffer, slideCount } = await buildBriefing({
      articles,
      regulatory,
      overview,
      options: {
        title: body.title,
        subtitle: body.subtitle,
        type: body.type,
        theme: body.theme as PptxThemeKey,
        template: body.template,
        personalName: settings.personalName,
        showPersonalBranding: settings.showPersonalBranding,
        logoPath: settings.logoPath,
        timezone: settings.timezone,
        includeExecutiveSummary: body.includeExecutiveSummary,
        includeTrendSlide: body.includeTrendSlide,
        includeComparisonSlide: body.includeComparisonSlide,
      },
    });

    const filename = `${slugify(body.title).slice(0, 60) || 'ola-news-briefing'}.pptx`;

    const briefing = await prisma.briefing.create({
      data: {
        title: body.title,
        type: body.type,
        template: body.template,
        theme: body.theme,
        articleIds: stringifyJson(articles.map((a) => a.id)),
        options: stringifyJson(body),
        slideCount,
      },
    });
    await prisma.exportRecord.create({
      data: {
        kind: 'PPTX', filename, briefingId: briefing.id,
        sizeBytes: buffer.length,
        params: stringifyJson({ slideCount, theme: body.theme, type: body.type }),
      },
    });

    return new Response(new Uint8Array(buffer), {
      headers: {
        'content-type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'content-length': String(buffer.length),
        'content-disposition': `attachment; filename="${filename}"`,
        'cache-control': 'no-store',
        'x-slide-count': String(slideCount),
      },
    });
  },
  { limit: 20, bucket: 'export-pptx' },
);
