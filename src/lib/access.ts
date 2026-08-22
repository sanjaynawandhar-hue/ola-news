import { NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';

/**
 * Read-only public mode.
 *
 * The dashboard has no user accounts. When it is exposed publicly, visitors
 * should be able to browse everything — feed, analytics, regulatory tracker,
 * PNG and PPTX exports — without being able to change configuration, delete
 * tracked companies, or burn the shared source rate limits.
 *
 * Behaviour is driven entirely by environment:
 *
 *   OLA_NEWS_PUBLIC_READ_ONLY=true   turn the guard on
 *   OLA_NEWS_ADMIN_TOKEN=<secret>    the token that unlocks writes
 *
 * With read-only on, a request carrying the admin token (either an
 * `x-admin-token` header or an `ola_news_admin` cookie) keeps full access;
 * everything else is limited to safe operations.
 *
 * Left off, the app behaves exactly as before — a local install needs no token.
 */

/** Mutating operations that stay available to anonymous visitors. */
const PUBLIC_WRITE_ALLOWLIST: Array<{ method: string; pathname: RegExp }> = [
  // Generating a briefing is a pure read of existing data that happens to be a
  // POST because the selection is sent in the body. It writes only an export
  // record, so visitors keep it — it is the most interesting thing to show off.
  { method: 'POST', pathname: /^\/api\/export\/pptx\/?$/ },
];

export function isReadOnlyMode(): boolean {
  return (process.env.OLA_NEWS_PUBLIC_READ_ONLY ?? 'false') === 'true';
}

function adminToken(): string | null {
  const token = process.env.OLA_NEWS_ADMIN_TOKEN?.trim();
  return token && token.length > 0 ? token : null;
}

/** Constant-time comparison so the token cannot be guessed by timing. */
function tokenMatches(supplied: string | null | undefined): boolean {
  const expected = adminToken();
  if (!expected || !supplied) return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function isAdminRequest(request: Request): boolean {
  const header = request.headers.get('x-admin-token');
  if (tokenMatches(header)) return true;

  const cookie = request.headers.get('cookie') ?? '';
  const match = /(?:^|;\s*)ola_news_admin=([^;]+)/.exec(cookie);
  if (match) {
    try {
      return tokenMatches(decodeURIComponent(match[1]));
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Returns a 403 response when a write should be refused, or null to continue.
 * Called by `withApi` for every non-GET request.
 */
export function denyIfReadOnly(request: Request): NextResponse | null {
  if (!isReadOnlyMode()) return null;

  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;
  if (isAdminRequest(request)) return null;

  const { pathname } = new URL(request.url);
  const allowed = PUBLIC_WRITE_ALLOWLIST.some(
    (rule) => rule.method === method && rule.pathname.test(pathname),
  );
  if (allowed) return null;

  return NextResponse.json(
    {
      error: {
        message:
          'This dashboard is published in read-only mode. Browsing, filtering and exports are ' +
          'open to everyone, but changing configuration requires the administrator token.',
        code: 'READ_ONLY',
      },
    },
    { status: 403 },
  );
}

/** Surfaced to the UI so it can hide controls that would only fail. */
export function accessState(request: Request) {
  const readOnly = isReadOnlyMode();
  return {
    readOnly,
    canWrite: !readOnly || isAdminRequest(request),
    adminTokenConfigured: !!adminToken(),
  };
}
