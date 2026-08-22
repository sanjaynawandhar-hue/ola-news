import { NextResponse } from 'next/server';
import { ZodError, type ZodType } from 'zod';
import { serverEnv } from '@/lib/env';
import { clientKey, rateLimit } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('api');

export interface ApiErrorBody {
  error: { message: string; code: string; details?: unknown };
}

/** Consistent success envelope. */
export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

/** Consistent, user-readable error envelope. */
export function fail(message: string, code = 'BAD_REQUEST', status = 400, details?: unknown) {
  return NextResponse.json<ApiErrorBody>({ error: { message, code, details } }, { status });
}

/**
 * Wraps a handler with rate limiting and error handling so no route leaks a
 * stack trace and every failure is a readable message.
 */
export function withApi(
  handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>,
  options: { limit?: number; bucket?: string } = {},
) {
  return async (request: Request, context: { params: Promise<Record<string, string>> }) => {
    const bucket = options.bucket ?? new URL(request.url).pathname;
    const limit = options.limit ?? serverEnv.rateLimit.max;
    const result = rateLimit(clientKey(request, bucket), limit, serverEnv.rateLimit.windowMs);

    if (!result.ok) {
      return NextResponse.json<ApiErrorBody>(
        {
          error: {
            message: 'Too many requests. Please wait a moment and try again.',
            code: 'RATE_LIMITED',
          },
        },
        {
          status: 429,
          headers: {
            'retry-after': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
            'x-ratelimit-limit': String(result.limit),
            'x-ratelimit-remaining': String(result.remaining),
          },
        },
      );
    }

    try {
      const response = await handler(request, context);
      response.headers.set('x-ratelimit-remaining', String(result.remaining));
      return response;
    } catch (error) {
      if (error instanceof ZodError) {
        return fail('The request contained invalid parameters.', 'VALIDATION_ERROR', 422, error.issues);
      }
      log.error('unhandled route error', {
        path: new URL(request.url).pathname,
        error: error instanceof Error ? error.message : String(error),
      });
      return fail(
        'Something went wrong while handling this request. The failure has been logged.',
        'INTERNAL_ERROR',
        500,
      );
    }
  };
}

/** Parses and validates a JSON body. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ZodError([
      { code: 'custom', path: [], message: 'Request body must be valid JSON.' },
    ]);
  }
  return schema.parse(raw);
}

/** Parses and validates search params. Repeated keys become arrays. */
export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const url = new URL(request.url);
  const record: Record<string, string | string[]> = {};
  for (const key of new Set(url.searchParams.keys())) {
    const values = url.searchParams.getAll(key);
    record[key] = values.length > 1 ? values : values[0];
  }
  return schema.parse(record);
}

/** Comma-or-repeat separated list of strings, e.g. ?sentiments=POSITIVE,NEGATIVE */
export function csvList(value: string | string[] | undefined): string[] | undefined {
  if (value === undefined) return undefined;
  const parts = Array.isArray(value) ? value : value.split(',');
  const cleaned = parts.map((p) => p.trim()).filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}
