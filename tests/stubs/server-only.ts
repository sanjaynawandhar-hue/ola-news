/**
 * Test stub for the `server-only` package.
 *
 * In the app, importing `server-only` makes the bundler fail the build if a
 * client component ever pulls in a module that reads secrets. That guard has no
 * meaning under Vitest, so it is aliased to this no-op (see vitest.config.mts).
 */
export {};
