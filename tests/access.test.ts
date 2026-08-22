import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { accessState, denyIfReadOnly, isAdminRequest, isReadOnlyMode } from '@/lib/access';

const ORIGINAL = {
  readOnly: process.env.OLA_NEWS_PUBLIC_READ_ONLY,
  token: process.env.OLA_NEWS_ADMIN_TOKEN,
};

function req(method: string, path: string, headers: Record<string, string> = {}) {
  return new Request(`https://ola-news.example${path}`, { method, headers });
}

beforeEach(() => {
  delete process.env.OLA_NEWS_PUBLIC_READ_ONLY;
  delete process.env.OLA_NEWS_ADMIN_TOKEN;
});

afterEach(() => {
  if (ORIGINAL.readOnly === undefined) delete process.env.OLA_NEWS_PUBLIC_READ_ONLY;
  else process.env.OLA_NEWS_PUBLIC_READ_ONLY = ORIGINAL.readOnly;
  if (ORIGINAL.token === undefined) delete process.env.OLA_NEWS_ADMIN_TOKEN;
  else process.env.OLA_NEWS_ADMIN_TOKEN = ORIGINAL.token;
});

describe('read-only mode is off by default', () => {
  it('does not restrict a local install', () => {
    expect(isReadOnlyMode()).toBe(false);
    expect(denyIfReadOnly(req('DELETE', '/api/companies'))).toBeNull();
    expect(denyIfReadOnly(req('PUT', '/api/settings'))).toBeNull();
  });

  it('reports the visitor as able to write', () => {
    expect(accessState(req('GET', '/api/access'))).toMatchObject({
      readOnly: false,
      canWrite: true,
    });
  });
});

describe('read-only mode blocks configuration changes', () => {
  beforeEach(() => {
    process.env.OLA_NEWS_PUBLIC_READ_ONLY = 'true';
    process.env.OLA_NEWS_ADMIN_TOKEN = 'correct-horse-battery-staple';
  });

  it.each([
    ['PUT', '/api/settings'],
    ['DELETE', '/api/companies'],
    ['POST', '/api/keywords'],
    ['PATCH', '/api/sources'],
    ['POST', '/api/refresh'],
    ['DELETE', '/api/alerts'],
    ['POST', '/api/categories'],
  ])('refuses %s %s', (method, path) => {
    const response = denyIfReadOnly(req(method, path));
    expect(response).not.toBeNull();
    expect(response!.status).toBe(403);
  });

  it('still allows every read', () => {
    for (const path of ['/api/feed', '/api/overview', '/api/regulatory', '/api/sources']) {
      expect(denyIfReadOnly(req('GET', path))).toBeNull();
    }
  });

  it('still allows PNG export (a GET) and PPTX generation', () => {
    // Exports are the most interesting thing to show a visitor, so they stay open.
    expect(denyIfReadOnly(req('GET', '/api/export/png?articleId=x'))).toBeNull();
    expect(denyIfReadOnly(req('POST', '/api/export/pptx'))).toBeNull();
  });

  it('reports the visitor as read-only', () => {
    expect(accessState(req('GET', '/api/access'))).toMatchObject({
      readOnly: true,
      canWrite: false,
      adminTokenConfigured: true,
    });
  });
});

describe('admin token unlocks writes', () => {
  beforeEach(() => {
    process.env.OLA_NEWS_PUBLIC_READ_ONLY = 'true';
    process.env.OLA_NEWS_ADMIN_TOKEN = 'correct-horse-battery-staple';
  });

  it('accepts the token as a header', () => {
    const request = req('PUT', '/api/settings', { 'x-admin-token': 'correct-horse-battery-staple' });
    expect(isAdminRequest(request)).toBe(true);
    expect(denyIfReadOnly(request)).toBeNull();
  });

  it('accepts the token as a cookie', () => {
    const request = req('DELETE', '/api/companies', {
      cookie: 'theme=dark; ola_news_admin=correct-horse-battery-staple; other=1',
    });
    expect(isAdminRequest(request)).toBe(true);
    expect(denyIfReadOnly(request)).toBeNull();
  });

  it('rejects a wrong token', () => {
    const request = req('PUT', '/api/settings', { 'x-admin-token': 'wrong' });
    expect(isAdminRequest(request)).toBe(false);
    expect(denyIfReadOnly(request)!.status).toBe(403);
  });

  it('rejects a token of the right length but wrong value', () => {
    // Guards against a comparison that only checks length.
    const request = req('PUT', '/api/settings', { 'x-admin-token': 'xxxxxxx-xxxxx-xxxxxxx-xxxxxx' });
    expect(isAdminRequest(request)).toBe(false);
  });

  it('rejects an empty or missing token', () => {
    expect(isAdminRequest(req('PUT', '/api/settings'))).toBe(false);
    expect(isAdminRequest(req('PUT', '/api/settings', { 'x-admin-token': '' }))).toBe(false);
  });

  it('never unlocks when no token is configured on the server', () => {
    delete process.env.OLA_NEWS_ADMIN_TOKEN;
    const request = req('PUT', '/api/settings', { 'x-admin-token': 'anything' });
    expect(isAdminRequest(request)).toBe(false);
    expect(denyIfReadOnly(request)!.status).toBe(403);
  });
});

describe('refresh survives on serverless', () => {
  /** Comments discuss the old pattern, so only executable lines are inspected. */
  const codeOnly = (source: string) =>
    source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');

  it('hands the collection back instead of starting it in the background', async () => {
    // A fire-and-forget `void execute()` is silently killed when the platform
    // freezes the function after the response is sent, leaving the job pinned
    // at RUNNING forever. This only reproduces on a real deployment, so it is
    // guarded here rather than being rediscovered in production.
    const { readFile } = await import('node:fs/promises');

    const pipeline = codeOnly(await readFile('src/lib/ingest/pipeline.ts', 'utf8'));
    expect(pipeline).not.toMatch(/void\s+executeRefresh\s*\(/);
    expect(pipeline).toMatch(/return\s*\{\s*jobId:\s*job\.id,\s*run\s*\}/);

    const route = codeOnly(await readFile('src/app/api/refresh/route.ts', 'utf8'));
    expect(route).toMatch(/import\s*\{\s*after\s*\}\s*from\s*'next\/server'/);
    expect(route).toMatch(/after\(run\)/);
  });
});

describe('scheduled refresh endpoint', () => {
  /**
   * Vercel Cron can only issue a plain GET, and a GET passes the read-only
   * guard — so this route carries its own authorisation. Without it, anyone
   * who guessed the URL could refresh the dashboard and drain the shared
   * per-host source rate limits.
   */
  it('requires its own secret rather than relying on the read-only guard', async () => {
    const { readFile } = await import('node:fs/promises');
    const route = await readFile('src/app/api/cron/refresh/route.ts', 'utf8');

    // The guard must exist and be checked before any work is started.
    expect(route).toMatch(/CRON_SECRET/);
    expect(route).toMatch(/timingSafeEqual/);
    expect(route.indexOf('isAuthorised(request)')).toBeLessThan(route.indexOf('runRefresh('));

    // It must not stack concurrent refreshes.
    expect(route).toMatch(/status:\s*'RUNNING'/);

    // Same serverless requirement as the manual route.
    expect(route).toMatch(/after\(run\)/);
  });

  it('is registered on a schedule', async () => {
    const { readFile } = await import('node:fs/promises');
    const config = JSON.parse(await readFile('vercel.json', 'utf8'));
    expect(config.crons).toHaveLength(1);
    expect(config.crons[0].path).toBe('/api/cron/refresh');
    expect(config.crons[0].schedule).toMatch(/^[\d*/, -]+$/);
  });
});

describe('KPI tiles', () => {
  /**
   * Tailwind's `group-hover:` matches ANY ancestor carrying `.group`, so a bare
   * `group` on the clickable tile also fired every tooltip nested inside it —
   * a hint popped up whenever the cursor touched the card the user meant to
   * click. The tile must use a NAMED group.
   */
  it('uses a named group so nested tooltips are not triggered by tile hover', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile('src/components/dashboard/KpiCard.tsx', 'utf8');

    // No bare `group ` in a className on the card itself.
    expect(source).not.toMatch(/'surface group block/);
    expect(source).toMatch(/group\/kpi/);
    // Every group-driven style on the card must be namespaced too. Comments
    // discuss the bare form, so only executable lines are inspected.
    const code = source
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
      .join('\n');
    expect(code.match(/group-hover:/g) ?? []).toHaveLength(0);
    expect(code.match(/group-focus-visible:/g) ?? []).toHaveLength(0);
  });

  it('does not render a hover hint on a clickable tile', async () => {
    const { readFile } = await import('node:fs/promises');
    const source = await readFile('src/components/dashboard/KpiCard.tsx', 'utf8');
    // The InfoTip is rendered only when the tile has no link.
    expect(source).toMatch(/tooltip && !href \? <InfoTip/);
  });
});
