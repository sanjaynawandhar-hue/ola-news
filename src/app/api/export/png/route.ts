import { withApi, fail, parseQuery } from '@/lib/api';
import { pngExportSchema } from '@/lib/validation';
import { getArticleById } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { renderNewsCard } from '@/lib/export/png-card';
import { prisma } from '@/lib/db';
import { PNG_PRESETS, type PngPresetKey } from '@/lib/constants';
import { slugify } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Renders a branded PNG news card server-side.
 * `?download=true` sets a Content-Disposition attachment header; without it the
 * same URL is used as the live preview image in the export dialog.
 */
export const GET = withApi(
  async (request) => {
    const url = new URL(request.url);
    const { articleId, preset } = parseQuery(request, pngExportSchema);
    const download = url.searchParams.get('download') === 'true';

    const article = await getArticleById(articleId);
    if (!article) return fail('Story not found.', 'NOT_FOUND', 404);

    const settings = await getSettings();
    const buffer = await renderNewsCard(article, {
      preset: preset as PngPresetKey,
      personalName: settings.personalName,
      showPersonalBranding: settings.showPersonalBranding,
      logoPath: settings.logoPath,
      timezone: settings.timezone,
    });

    const filename = `ola-news-${slugify(article.title).slice(0, 48) || 'story'}-${preset}.png`;

    if (download) {
      await prisma.exportRecord.create({
        data: {
          kind: 'PNG', filename, preset, articleId: article.id,
          sizeBytes: buffer.length,
          params: JSON.stringify({ preset, dimensions: PNG_PRESETS[preset as PngPresetKey] }),
        },
      });
    }

    return new Response(new Uint8Array(buffer), {
      headers: {
        'content-type': 'image/png',
        'content-length': String(buffer.length),
        'cache-control': 'no-store',
        ...(download ? { 'content-disposition': `attachment; filename="${filename}"` } : {}),
      },
    });
  },
  { limit: 40, bucket: 'export-png' },
);
