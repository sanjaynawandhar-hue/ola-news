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
