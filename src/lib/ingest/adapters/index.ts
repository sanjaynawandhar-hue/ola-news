import { rssAdapter, googleNewsAdapter } from './rss';
import { gdeltAdapter } from './gdelt';
import { bingNewsAdapter, gnewsAdapter, newsApiAdapter, newsDataAdapter } from './credentialed';
import { demoAdapter } from './demo';
import type { SourceAdapter } from './types';

export const ADAPTERS: Record<string, SourceAdapter> = {
  rss: rssAdapter,
  'google-news': googleNewsAdapter,
  gdelt: gdeltAdapter,
  newsapi: newsApiAdapter,
  newsdata: newsDataAdapter,
  gnews: gnewsAdapter,
  'bing-news': bingNewsAdapter,
  demo: demoAdapter,
};

export function getAdapter(key: string): SourceAdapter | null {
  return ADAPTERS[key] ?? null;
}

export type { SourceAdapter, AdapterContext } from './types';
