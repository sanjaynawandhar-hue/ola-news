'use client';

import * as React from 'react';

export interface ApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
}

interface Settled<T> {
  /** Identifies the request whose result is currently held. */
  key: string;
  data: T | null;
  error: string | null;
}

/**
 * Small fetch hook with abort handling and a readable error message.
 *
 * `loading` is *derived* from whether the settled result matches the request
 * the current render wants, rather than being written from inside the effect.
 * That keeps each fetch to a single state update and avoids the cascading
 * render that a `setLoading(true)` in an effect body causes.
 *
 * `deps` re-runs the request; `dataVersion` from the refresh provider is
 * normally passed in so every panel updates after a refresh completes.
 */
export function useApi<T>(url: string | null, deps: unknown[] = []): ApiState<T> {
  const [nonce, setNonce] = React.useState(0);
  const [settled, setSettled] = React.useState<Settled<T>>({ key: '', data: null, error: null });

  const depsKey = JSON.stringify(deps);
  const requestKey = url ? `${url}::${nonce}::${depsKey}` : '';

  React.useEffect(() => {
    if (!url) return;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        const payload = await response.json().catch(() => null);
        if (controller.signal.aborted) return;

        if (!response.ok) {
          throw new Error(
            payload?.error?.message ?? `Request failed with status ${response.status}.`,
          );
        }
        setSettled({ key: requestKey, data: payload as T, error: null });
      } catch (err) {
        if (controller.signal.aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setSettled((current) => ({
          key: requestKey,
          // Keep the previous data on screen so an error does not blank the panel.
          data: current.data,
          error: err instanceof Error ? err.message : 'Could not load this data.',
        }));
      }
    })();

    return () => controller.abort();
  }, [url, requestKey]);

  const reload = React.useCallback(() => setNonce((n) => n + 1), []);

  return {
    data: settled.data,
    loading: !!url && settled.key !== requestKey,
    error: settled.key === requestKey ? settled.error : null,
    reload,
  };
}

/** POST/PUT/PATCH/DELETE helper that surfaces the API's error message. */
export async function mutate<T = unknown>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(url, {
    method: options.method ?? 'POST',
    headers: options.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.error?.message ?? `Request failed with status ${response.status}.`);
  }
  return payload as T;
}
