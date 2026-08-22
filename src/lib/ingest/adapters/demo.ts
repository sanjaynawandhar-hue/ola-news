import { DEMO_ARTICLES, demoPublishedAt } from '../demo-data';
import type { RawItem } from '@/types';
import type { SourceAdapter } from './types';

/**
 * Serves the labelled demo dataset. Items are marked isDemo at normalisation
 * time and are always rendered with a DEMO badge; they are never presented as
 * live news.
 */
export const demoAdapter: SourceAdapter = {
  key: 'demo',
  description:
    'Built-in sample dataset used when no live credentials are configured. Clearly labelled; never presented as real news.',
  async fetchItems(ctx): Promise<RawItem[]> {
    const now = Date.now();
    return DEMO_ARTICLES.slice(0, ctx.maxItems).map((article) => {
      const published = demoPublishedAt(article, new Date(now));
      return {
        title: article.title,
        description: article.description,
        url: `https://example.com/ola-news-demo/${article.slug}`,
        publishedAt: published,
        publisher: article.publisher,
        externalId: `demo:${article.slug}`,
        language: article.language ?? 'en',
        country: article.country ?? 'IN',
        meta: { demo: 1 },
      } satisfies RawItem;
    });
  },
};
