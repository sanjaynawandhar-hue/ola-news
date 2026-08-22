import { serverEnv } from './env';
import { createLogger } from './logger';

const log = createLogger('http');

export class FetchError extends Error {
  constructor(
    message: string,
    readonly statusCode?: number,
    readonly retryable = false,
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

interface FetchOptions {
  timeoutMs?: number;
  retries?: number;
  headers?: Record<string, string>;
  accept?: string;
}

/** Per-host politeness: never issue two requests to one host closer than its rate limit. */
const lastRequestAt = new Map<string, number>();

async function respectRateLimit(host: string, rateLimitMs: number) {
  const last = lastRequestAt.get(host) ?? 0;
  const wait = last + rateLimitMs - Date.now();
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastRequestAt.set(host, Date.now());
}

/**
 * Fetch with timeout, bounded exponential-backoff retry, a declared user agent
 * and per-host throttling. Never throws for a non-retryable status without
 * surfacing the status code so the caller can record a SourceFailure.
 */
export async function fetchWithRetry(
  url: string,
  { timeoutMs, retries = 2, headers = {}, accept }: FetchOptions = {},
  rateLimitMs = 1000,
): Promise<{ body: string; status: number; contentType: string }> {
  const host = safeHost(url);
  const effectiveTimeout = timeoutMs ?? serverEnv.fetchTimeoutMs;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    await respectRateLimit(host, rateLimitMs);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), effectiveTimeout);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        cache: 'no-store',
        headers: {
          'user-agent': serverEnv.userAgent,
          accept: accept ?? 'application/rss+xml, application/xml, text/xml, application/json;q=0.9, */*;q=0.8',
          'accept-language': 'en-IN,en;q=0.9',
          ...headers,
        },
      });
      clearTimeout(timer);

      if (response.status === 429 || response.status >= 500) {
        throw new FetchError(`Upstream returned HTTP ${response.status}`, response.status, true);
      }
      if (!response.ok) {
        // 401/403 usually means credentials, robots or terms restrictions.
        throw new FetchError(
          response.status === 403
            ? 'Access denied by the publisher (HTTP 403). This source is not available for automated collection.'
            : `Upstream returned HTTP ${response.status}`,
          response.status,
          false,
        );
      }
      const body = await response.text();
      return {
        body,
        status: response.status,
        contentType: response.headers.get('content-type') ?? '',
      };
    } catch (error) {
      clearTimeout(timer);
      lastError = error;
      const retryable =
        error instanceof FetchError
          ? error.retryable
          : error instanceof Error && (error.name === 'AbortError' || error.name === 'TypeError');
      if (!retryable || attempt === retries) break;
      const backoff = Math.min(8000, 500 * 2 ** attempt) + Math.random() * 250;
      log.warn('retrying request', { url, attempt: attempt + 1, backoff: Math.round(backoff) });
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }

  if (lastError instanceof FetchError) throw lastError;
  if (lastError instanceof Error && lastError.name === 'AbortError') {
    throw new FetchError(`Request timed out after ${effectiveTimeout}ms`, undefined, true);
  }
  throw new FetchError(
    lastError instanceof Error ? lastError.message : 'Unknown network error',
    undefined,
    true,
  );
}

function safeHost(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown';
  }
}

/** Test/diagnostic helper. */
export function resetHostThrottle() {
  lastRequestAt.clear();
}
