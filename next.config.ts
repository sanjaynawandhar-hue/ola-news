import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /**
   * Native and heavyweight server-only packages are loaded at runtime by Node
   * rather than bundled. `@napi-rs/canvas` and `better-sqlite3` ship platform
   * binaries that cannot be placed in an ESM chunk, and pptxgenjs is only ever
   * used inside route handlers.
   */
  serverExternalPackages: [
    '@napi-rs/canvas',
    'better-sqlite3',
    '@prisma/adapter-better-sqlite3',
    '@prisma/adapter-pg',
    'pptxgenjs',
  ],

  outputFileTracingIncludes: {
    // The logo is read from disk when rendering PNG cards and PPTX decks.
    '/api/export/**': ['./public/branding/**'],
  },
};

export default nextConfig;
