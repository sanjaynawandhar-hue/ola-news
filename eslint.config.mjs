import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Prisma Client is generated code and is not linted.
    "src/generated/**",
    // A clone of this repo checked out inside itself (e.g. to try the setup
    // steps). Its own .next/ and src/ would otherwise be linted as if they
    // were part of this project.
    "ola-news/**",
  ]),
  {
    rules: {
      // A leading underscore marks a binding that exists only so a key can be
      // destructured away from an object — that is intentional, not dead code.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],
    },
  },
]);

export default eslintConfig;
