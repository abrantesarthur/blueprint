// provides ESLint's built-in recommended JavaScript rules.
import js from "@eslint/js";
// provides JSDOC rules
import jsdoc from "eslint-plugin-jsdoc";
// Provides a config that turns off all rules that are unnecessary or might conflict with
import prettier from "eslint-config-prettier/flat";
// gives predefined global variables (e.g. window, document) for different environments.
import globals from "globals";
// enables TypeScript parsing and rules.
import tseslint from "typescript-eslint";
// sorts imports alphabetically and groups them by category.
import simpleImportSort from "eslint-plugin-simple-import-sort";
// helper for type-safe config definition.
import { defineConfig } from "eslint/config";
// Next.js ESLint configs (scoped to frontend/ in the config below)
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * Scopes an array of ESLint flat config objects to the frontend/ directory.
 * Prefixes all `files` and `ignores` glob patterns with "frontend/".
 *
 * @param {import("eslint").Linter.Config[]} configs
 * @returns {import("eslint").Linter.Config[]}
 */
function scopeToFrontend(configs) {
  const prefixGlob = (g) =>
    g.startsWith("!") ? `!frontend/${g.slice(1)}` : `frontend/${g}`;

  return configs.map((config) => {
    const scoped = { ...config };

    // Config with only ignores = global ignore pattern
    if (config.ignores && Object.keys(config).length === 1) {
      scoped.ignores = config.ignores.map(prefixGlob);
      return scoped;
    }

    // Prefix files patterns (supports nested arrays for AND logic)
    if (config.files) {
      scoped.files = config.files.map((f) =>
        Array.isArray(f) ? f.map(prefixGlob) : prefixGlob(f),
      );
    } else {
      scoped.files = ["frontend/**/*.{js,jsx,mjs,ts,tsx,mts,cts}"];
    }

    if (config.ignores) {
      scoped.ignores = config.ignores.map(prefixGlob);
    }

    return scoped;
  });
}

/**
 * Custom rule that enforces clean import/export paths:
 * - No `.ts` file extensions (Bun resolves them automatically)
 * - No `/index` suffixes (directory imports resolve to index files)
 * - No deep subpath imports reaching into a package's `/src/` directory
 *
 * Covers `import`, `export { } from`, and `export * from` statements.
 * Supports auto-fix via `eslint --fix` (except deep subpath imports).
 *
 * @type {import("eslint").Rule.RuleModule}
 */
const cleanImportPaths = {
  meta: {
    type: "problem",
    fixable: "code",
    messages: {
      noTsExtension:
        "Do not use .ts extension in imports. Use extensionless paths instead.",
      noIndexSuffix:
        "Do not import from '/index'. Import from the directory instead.",
      noDeepPackageImport:
        "Do not reach into package internals. Import from '{{root}}' instead.",
    },
  },
  create(context) {
    /**
     * Extract the package root from an import specifier.
     * Returns null for relative or absolute paths.
     *
     * @param {string} source
     * @returns {string | null}
     */
    function getPackageRoot(source) {
      if (source.startsWith(".") || source.startsWith("/")) return null;
      const parts = source.split("/");
      // Scoped packages: @scope/pkg
      if (source.startsWith("@") && parts.length >= 2) {
        return parts[0] + "/" + parts[1];
      }
      return parts[0];
    }

    /**
     * Check an import/export node for disallowed path patterns.
     * @param {import("estree").ImportDeclaration | import("estree").ExportNamedDeclaration | import("estree").ExportAllDeclaration} node
     */
    function check(node) {
      if (!node.source) return;
      const source = node.source.value;
      const quote = node.source.raw[0];

      if (source.endsWith(".ts")) {
        context.report({
          node: node.source,
          messageId: "noTsExtension",
          fix: (fixer) =>
            fixer.replaceText(
              node.source,
              `${quote}${source.slice(0, -3)}${quote}`,
            ),
        });
      } else if (source.endsWith("/index")) {
        context.report({
          node: node.source,
          messageId: "noIndexSuffix",
          fix: (fixer) =>
            fixer.replaceText(
              node.source,
              `${quote}${source.slice(0, -6)}${quote}`,
            ),
        });
      }

      // Flag imports that reach into a package's /src/ directory
      const root = getPackageRoot(source);
      if (root && source !== root && /\/src(\/|$)/.test(source)) {
        context.report({
          node: node.source,
          messageId: "noDeepPackageImport",
          data: { root },
        });
      }
    }

    return {
      ImportDeclaration: check,
      ExportNamedDeclaration: check,
      ExportAllDeclaration: check,
    };
  },
};

export default defineConfig([
  // ── Global ignores — build artifacts and generated files ──
  {
    ignores: [
      "frontend/.next/**",
      "frontend/out/**",
      "frontend/build/**",
      "frontend/next-env.d.ts",
      ".claude/skills/**",
    ],
  },

  // ── Shared rules (all workspaces) ──
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      js,
      local: { rules: { "clean-import-paths": cleanImportPaths } },
      "simple-import-sort": simpleImportSort,
    },
    extends: ["js/recommended"],
    rules: {
      /** possible logic errors */
      eqeqeq: "error",
      "no-unused-vars": "off",
      "no-promise-executor-return": "warn",
      "no-self-compare": "error",
      "no-template-curly-in-string": "warn",
      "no-unmodified-loop-condition": "warn",
      "no-useless-assignment": "error",
      "require-atomic-updates": "error",
      "no-duplicate-imports": "error",
      "simple-import-sort/imports": "error",
      "simple-import-sort/exports": "error",
    },
  },

  // ── TypeScript — parsing and recommended rules (all .ts/.tsx) ──
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
          ignoreRestSiblings: true,
        },
      ],
    },
  },

  // ── Next.js + React (scoped to frontend/) ──
  ...scopeToFrontend([...nextVitals, ...nextTs]),
  {
    files: ["frontend/**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    settings: { next: { rootDir: "frontend" } },
    rules: {
      // App router doesn't use pages/ — this rule is for the pages router only
      "@next/next/no-html-link-for-pages": "off",
    },
  },

  // ── Backend & utils — Node.js globals, clean import paths ──
  {
    files: ["backend/**/*.{js,ts}", "utils/**/*.{js,ts}"],
    languageOptions: { globals: globals.node },
    rules: {
      "local/clean-import-paths": "error",
    },
  },

  // ── Backend & utils — JSDoc enforcement ──
  {
    ...jsdoc.configs["flat/recommended-typescript"],
    files: ["backend/**/*.{js,ts}", "utils/**/*.{js,ts}"],
    rules: {
      // Flags @param names that don't match actual function parameters.
      "jsdoc/check-param-names": [
        "warn",
        {
          checkDestructured: false,
        },
      ],
      // Warns when the specified kinds of declarations lack a JSDoc comment.
      "jsdoc/require-jsdoc": [
        "warn",
        {
          contexts: [
            "TSInterfaceDeclaration",
            "TSTypeAliasDeclaration",
            "FunctionDeclaration",
            {
              context:
                "VariableDeclaration[kind='const'] > VariableDeclarator > ArrowFunctionExpression",
            },
            {
              context:
                "VariableDeclaration[kind='const'] > VariableDeclarator > FunctionExpression",
            },
            // ensure every property in interfaces carries JSDoc, inline style
            {
              context:
                "TSInterfaceDeclaration > TSInterfaceBody > TSPropertySignature",
            },
          ],
        },
      ],
      "jsdoc/require-param": [
        "warn",
        {
          // only require the root destructured object, not each property
          checkDestructured: false,
          checkDestructuredRoots: true,
        },
      ],
      "jsdoc/require-returns": "warn",
      "jsdoc/multiline-blocks": [
        "warn",
        {
          // collapse empty comments to a one-liner
          requireSingleLineUnderCount: 80,
          noSingleLineBlocks: false,
        },
      ],
      "jsdoc/no-blank-blocks": "warn",
    },
  },

  // ── Backend & utils — strict TypeScript rules ──
  {
    files: ["backend/**/*.ts", "utils/**/*.ts"],
    rules: {
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          allowExpressions: false,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: false,
          allowIIFEs: false,
        },
      ],
      // Require type definitions for variables, parameters, properties, etc.
      "@typescript-eslint/typedef": [
        "warn",
        {
          // All function parameters must have explicit type annotations.
          parameter: true,
          // Arrow function parameters don't need explicit types (use inference).
          arrowParameter: false,
        },
      ],
    },
  },

  // ── Prettier — disable conflicting formatting rules (always last) ──
  prettier,
]);
