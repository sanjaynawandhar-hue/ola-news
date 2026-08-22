import type { RawItem } from '@/types';

export interface AdapterContext {
  /** Search terms derived from tracked companies/brands/keywords. */
  queries: string[];
  maxItems: number;
  timeoutMs: number;
  rateLimitMs: number;
  /** Resolved credential value, if the source declares one. */
  credential?: string;
  sourceKey: string;
  endpoint?: string | null;
  queryTemplate?: string | null;
}

export interface SourceAdapter {
  key: string;
  /** Human-readable description of what this adapter collects and under what terms. */
  description: string;
  fetchItems(ctx: AdapterContext): Promise<RawItem[]>;
}
