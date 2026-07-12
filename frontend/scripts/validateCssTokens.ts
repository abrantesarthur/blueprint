/**
 * CSS Token Usage Validator (Frontend)
 *
 * Enforces the frontend design-system rule: all Tailwind/CSS token values
 * must be defined in `frontend/src/styles/globals.css` and referenced by
 * name. Frontend components must NOT hardcode CSS values using Tailwind's
 * arbitrary-value syntax (e.g., `text-[15px]`, `shadow-[0_-2px_6px_...]`)
 * or literal color strings in SVG attributes (e.g., `fill="#FFFFFF"`).
 *
 * Rules (each reports only the specific violation category):
 *
 *  1. `text-[Npx]` / `text-[Nrem]` — font sizes must use `text-caption`,
 *     `text-body-*`, `text-title-*`, or `text-display-*` tokens.
 *  2. `leading-[Npx]` / `leading-[Nrem]` — line heights must use Tailwind's
 *     `leading-*` scale or the baked-in line-height of a `text-*` token.
 *  3. `shadow-[...]` — shadows must use `shadow-elevation*` tokens.
 *     Arbitrary shadow values that reference a CSS variable (i.e. contain
 *     `var(` inside the brackets) are allowed since they are token references.
 *  4. `rounded[-*]-[Npx|rem|em]` — border radii must use `rounded-sm/md/lg/xl/full`.
 *  5. `(bg|text|border|fill|stroke|outline|ring|shadow|caret|decoration|divide|accent|from|to|via)-[#hex]` —
 *     colors must use named tokens (e.g., `text-foreground`, `bg-primary`).
 *  6. Same utilities with `-[rgba(` / `-[rgb(` prefixes.
 *  7. `fill="#hex"` / `stroke="#hex"` in SVG attributes — must reference
 *     `var(--color-*)` from globals.css.
 *  8. `(p|px|py|pt|pb|pl|pr)-N` or `(p|px|py|pt|pb|pl|pr)-[Npx|rem|em]` —
 *     padding must use the named spacing tokens defined in globals.css:
 *     `p-none`, `p-xs`, `p-sm`, `p-md`, `p-lg`, `p-xl`, `p-2xl`, `p-3xl`,
 *     `p-4xl`, `p-5xl`, or `px-page-gutter-*` for page-level gutters.
 *     Both raw Tailwind scale classes (`p-4`, `px-3.5`) and arbitrary values
 *     (`px-[18px]`, `py-[7px]`) are forbidden. Viewport-relative arbitrary
 *     values (`pt-[12vh]`, `pt-[50%]`) and `var(...)` references are
 *     allowed as structural exceptions.
 *
 * Allowed (NOT flagged) because they are structural, not design-system values:
 *  - Layout dimensions: `w-[340px]`, `h-[760px]`, `max-w-[1280px]`, `top-[Npx]`,
 *    `gap-[Npx]`, `m-[Npx]`, `h-[calc(100vh-139px)]`
 *  - Sub-pixel borders: `border-[0.5px]`
 *  - Icon stroke widths: `stroke-[1.5]`, `stroke-[2px]`
 *  - Background position / image / gradients that reference a token:
 *    `bg-[center_35%]`, `bg-[image:var(--color-hero-gradient-mobile)]`
 *  - Any `-[var(--...)]` arbitrary value (already a token reference)
 *  - SVG `fill="none"` / `fill="currentColor"` / `stroke="currentColor"`
 *
 * Exclusions:
 *  - `frontend/src/styles/` (globals.css is where tokens are defined)
 *  - `node_modules/` and `.next/`
 *
 * Run from the frontend workspace with: bun scripts/validateCssTokens.ts
 * (or via the npm script: `bun run validate:css-tokens`).
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

const FRONTEND_SRC = path.join(import.meta.dir, "../src");

/** Directory entries that should never be recursed into. */
const SKIP_DIRS = new Set(["node_modules", ".next", "styles"]);

/** File extensions that can contain Tailwind class names or JSX attributes. */
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx"];

/** A single validation rule checked against each source file. */
interface Rule {
  /** Short identifier for the rule, shown in the error report. */
  id: string;
  /** Human-readable description explaining the rule and the fix. */
  description: string;
  /** Global regex applied against the raw file contents. */
  pattern: RegExp;
  /**
   * Optional post-filter. Returns `true` to accept the match as a false
   * positive and skip reporting (e.g., an arbitrary shadow value whose
   * contents reference a `--shadow-elevation*` CSS variable).
   * @param match - The exact matched substring.
   * @returns Whether to ignore this match.
   */
  allow?: (match: string) => boolean;
}

const RULES: Rule[] = [
  {
    id: "arbitrary-text-size",
    description:
      "Font sizes must use text-caption / text-body-* / text-title-* / text-display-* tokens from globals.css.",
    pattern: /\btext-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g,
  },
  {
    id: "arbitrary-leading",
    description:
      "Line heights must use Tailwind's leading-* scale or the baked-in line-height of a text-* token.",
    pattern: /\bleading-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g,
  },
  {
    id: "arbitrary-shadow",
    description:
      "Shadows must use shadow-elevation* tokens from globals.css. Add a new token to globals.css if none fits.",
    pattern: /\bshadow-\[[^\]]+\]/g,
    allow: (match) => match.includes("var("),
  },
  {
    id: "arbitrary-rounded",
    description:
      "Border radii must use rounded-sm/md/lg/xl/full tokens from globals.css.",
    pattern: /\brounded(?:-[a-z]+)?-\[\d+(?:\.\d+)?(?:px|rem|em)\]/g,
  },
  {
    id: "arbitrary-hex-color-class",
    description:
      "Colors must use named tokens from globals.css (e.g., text-foreground, bg-primary, border-light-grey).",
    pattern:
      /\b(?:bg|text|border|fill|stroke|outline|ring|shadow|caret|decoration|divide|accent|from|to|via)-\[#[\dA-Fa-f]{3,8}(?:\/\d+)?\]/g,
  },
  {
    id: "arbitrary-rgba-color-class",
    description:
      "Colors must use named tokens from globals.css (e.g., text-foreground, bg-primary, border-light-grey).",
    pattern:
      /\b(?:bg|text|border|fill|stroke|outline|ring|shadow|caret|decoration|divide|accent|from|to|via)-\[rgba?\(/g,
  },
  {
    id: "hex-svg-attribute",
    description:
      'SVG fill/stroke literal colors must reference var(--color-*) from globals.css (e.g., fill="var(--color-background)").',
    pattern: /\b(?:fill|stroke)="#[\dA-Fa-f]{3,8}"/g,
  },
  {
    id: "arbitrary-padding",
    description:
      "Padding must use --spacing-* tokens from globals.css (p-none/xs/sm/md/lg/xl/2xl/3xl/4xl/5xl) or px-page-gutter-* for page gutters.",
    pattern: /\b(?:p|px|py|pt|pb|pl|pr)-(?:\d+(?:\.\d+)?(?![a-z])|\[[^\]]+\])/g,
    allow: (match) => {
      const bracket = match.match(/\[([^\]]+)\]/);
      if (!bracket) return false;
      const content = bracket[1] ?? "";
      if (content.includes("var(")) return true;
      if (/(?:vh|vw|dvh|dvw|svh|svw)\b/.test(content)) return true;
      if (content.includes("%")) return true;
      return false;
    },
  },
];

/** A single rule violation found while scanning a file. */
interface ValidationError {
  /** Absolute path to the file containing the violation. */
  file: string;
  /** 1-based line number of the violation. */
  line: number;
  /** The rule id that matched. */
  ruleId: string;
  /** The matched substring (e.g., `text-[15px]`). */
  match: string;
  /** The full trimmed line content, for context in the report. */
  lineContent: string;
}

/**
 * Recursively finds all source files under a directory, skipping entries in
 * {@link SKIP_DIRS}.
 * @param dir - Directory to scan.
 * @param files - Accumulator for discovered files.
 * @returns Array of absolute file paths.
 */
async function findSourceFiles(
  dir: string,
  files: string[] = [],
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      await findSourceFiles(fullPath, files);
    } else if (
      entry.isFile() &&
      SOURCE_EXTENSIONS.some((ext) => entry.name.endsWith(ext))
    ) {
      files.push(fullPath);
    }
  }
  return files;
}

/**
 * Runs every rule against a single file and collects the violations found.
 * @param filePath - Absolute path to the file being checked.
 * @returns Array of validation errors for this file (may be empty).
 */
async function checkFile(filePath: string): Promise<ValidationError[]> {
  const content = await Bun.file(filePath).text();
  const lines = content.split("\n");
  const errors: ValidationError[] = [];

  for (const rule of RULES) {
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = rule.pattern.exec(content)) !== null) {
      const matched = match[0];
      if (rule.allow && rule.allow(matched)) continue;
      const line = content.substring(0, match.index).split("\n").length;
      const lineContent = lines[line - 1]?.trim() ?? matched;
      errors.push({
        file: filePath,
        line,
        ruleId: rule.id,
        match: matched,
        lineContent,
      });
    }
  }

  return errors;
}

/**
 * Prints the collected violations grouped by file, then by rule, and writes
 * a final count to stderr.
 * @param errors - The complete list of violations.
 */
function reportErrors(errors: ValidationError[]): void {
  const byFile = new Map<string, ValidationError[]>();
  for (const error of errors) {
    const list = byFile.get(error.file);
    if (list) {
      list.push(error);
    } else {
      byFile.set(error.file, [error]);
    }
  }

  console.error("\nHardcoded CSS values detected in frontend source:\n");
  console.error(
    "All Tailwind/CSS token values must come from frontend/src/styles/globals.css.",
  );
  console.error(
    "Replace the arbitrary value with an existing token, or add a new token to globals.css if none fits.\n",
  );

  const rulesById = new Map(RULES.map((rule) => [rule.id, rule]));

  for (const [file, fileErrors] of byFile) {
    const relativePath = path.relative(process.cwd(), file);
    console.error(`${relativePath}:`);
    for (const error of fileErrors) {
      console.error(`  Line ${error.line} [${error.ruleId}]: ${error.match}`);
      console.error(`    ${error.lineContent}`);
      const rule = rulesById.get(error.ruleId);
      if (rule) {
        console.error(`    -> ${rule.description}`);
      }
    }
    console.error("");
  }

  console.error(`Found ${errors.length} violation(s).`);
}

/** Main entry point. */
async function main(): Promise<void> {
  console.log("Validating CSS token usage in frontend/src...\n");

  const files = await findSourceFiles(FRONTEND_SRC);
  const allErrors: ValidationError[] = [];

  for (const file of files) {
    const errors = await checkFile(file);
    allErrors.push(...errors);
  }

  if (allErrors.length === 0) {
    console.log("\u2713 CSS token usage validation passed");
    return;
  }

  reportErrors(allErrors);
  process.exit(1);
}

main().catch((error) => {
  console.error("CSS token usage validation failed:", error);
  process.exit(1);
});
