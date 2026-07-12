/**
 * Database Client Usage Validator
 *
 * Enforces three rules for files outside backend/src/db/:
 * 1. The `db` client must not be imported directly — use db/queries/ instead.
 * 2. Imports must come from the db barrel (e.g., `../../db`), not from subpaths
 *    like `../../db/schema` or `../../db/queries/users`.
 * 3. The transaction parameter from `withTransaction` callbacks must not be used
 *    for direct Drizzle operations (insert, update, delete, select, selectDistinct,
 *    selectDistinctOn, execute, transaction) or relational queries (query.<table>).
 *    Use the centralized query functions from db/queries/ instead.
 *
 * Exclusions (all rules):
 * - backend/src/db/ (allowed to use db directly)
 * - __tests__/ directories (use testDb from test setup)
 * - backend/src/tests/ (test infrastructure that mocks db)
 * - backend/src/scripts/seed.ts (needs direct db access for seeding)
 *
 * Additional exception for rule 2:
 * - backend/src/scripts/ may import from db/schema (for schema introspection)
 *
 * Run with: bun src/scripts/validateDbUsage.ts
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = path.join(import.meta.dir, "..");

/** Directories that are allowed to import the db client directly. */
const ALLOWED_DIRS = [path.join(SRC_DIR, "db"), path.join(SRC_DIR, "tests")];

/** Individual files exempt from all validation rules. */
const FULLY_EXEMPT_FILES = new Set([path.join(SRC_DIR, "scripts", "seed.ts")]);

/** Validation error found during db usage checking. */
interface ValidationError {
  /** File path where the error was found. */
  file: string;
  /** Line number in the file. */
  line: number;
  /** The code snippet that violated the rule. */
  statement: string;
}

/**
 * Check whether a directory should be skipped during file discovery.
 * @param dirPath - Absolute path to the directory.
 * @param dirName - Name of the directory entry.
 * @returns Whether to skip this directory.
 */
function shouldSkipDir(dirPath: string, dirName: string): boolean {
  if (dirName === "__tests__" || dirName === "node_modules") return true;
  return ALLOWED_DIRS.some(
    (allowed) => dirPath === allowed || dirPath.startsWith(allowed + "/"),
  );
}

/**
 * Recursively find all TypeScript files in a directory, excluding allowed dirs.
 * @param dir - Directory to search.
 * @param files - Accumulator for found files.
 * @returns Array of file paths.
 */
async function findTsFiles(
  dir: string,
  files: string[] = [],
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkipDir(fullPath, entry.name)) {
        await findTsFiles(fullPath, files);
      }
    } else if (
      entry.isFile() &&
      entry.name.endsWith(".ts") &&
      !FULLY_EXEMPT_FILES.has(fullPath)
    ) {
      files.push(fullPath);
    }
  }

  return files;
}

/** Pattern to match db-related import source paths. */
const DB_PATH_PATTERN = /\/db(?:\/(?:client|index))?(?:\.ts)?$/;

/** Pattern to detect imports from db subpaths (e.g., /db/schema, /db/queries/users). */
const DB_SUBPATH_SOURCE_PATTERN = /\/db\/.+/;

/** Import subpath from db that scripts are allowed to use. */
const SCRIPTS_ALLOWED_DB_SUBPATH = /\/db\/schema(?:\/index)?(?:\.ts)?$/;

/** Path to the scripts directory. */
const SCRIPTS_DIR = path.join(SRC_DIR, "scripts");

/** Drizzle ORM methods that constitute direct database operations. */
const FORBIDDEN_TX_METHODS = [
  "insert",
  "update",
  "delete",
  "select",
  "selectDistinct",
  "selectDistinctOn",
  "execute",
  "transaction",
] as const;

/**
 * Check a file for forbidden db client imports.
 *
 * Uses a regex that matches full import statements (including multi-line)
 * to detect value imports of `db` from db module paths.
 *
 * Matches paths ending with `/db`, `/db/index`, `/db/index.ts`,
 * `/db/client`, or `/db/client.ts`.
 *
 * Skips type-only imports (`import type { ... }`).
 * Within mixed imports, skips `type db` specifiers.
 *
 * @param filePath - Path to the file to check.
 * @returns Array of validation errors found.
 */
async function checkFile(filePath: string): Promise<ValidationError[]> {
  const content = await Bun.file(filePath).text();
  const errors: ValidationError[] = [];

  // Match all import statements including multi-line ones.
  // Group 1: "type " keyword (if present), Group 2: specifiers, Group 3: source path
  const importRegex =
    /import\s+(type\s+)?\{([^}]*)\}\s*from\s*["']([^"']*)["']/g;

  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const isTypeOnly = !!match[1];
    const specifiers = match[2]!;
    const sourcePath = match[3]!;

    if (isTypeOnly) continue;
    if (!DB_PATH_PATTERN.test(sourcePath)) continue;

    // Check if `db` is imported as a value (not `type db`)
    const specs = specifiers.split(",").map((s) => s.trim());
    const hasDbValue = specs.some((s) => /^db(\s+as\s+\w+)?$/.test(s));
    if (!hasDbValue) continue;

    const line = content.substring(0, match.index).split("\n").length;
    errors.push({
      file: filePath,
      line,
      statement: match[0].replace(/\s+/g, " ").trim(),
    });
  }

  return errors;
}

/**
 * Check a file for forbidden db subpath imports.
 *
 * Files outside backend/src/db/ must import from the db barrel (e.g., `../../db`),
 * not from subpaths like `../../db/schema` or `../../db/queries/users`.
 *
 * Exception: files in backend/src/scripts/ may import from db/schema.
 *
 * @param filePath - Path to the file to check.
 * @returns Array of validation errors found.
 */
async function checkFileSubpathImports(
  filePath: string,
): Promise<ValidationError[]> {
  const content = await Bun.file(filePath).text();
  const errors: ValidationError[] = [];
  const isScript = filePath.startsWith(SCRIPTS_DIR + "/");

  // Match destructured imports: import [type] { ... } from "..."
  const destructuredRegex =
    /import\s+(?:type\s+)?\{[^}]*\}\s*from\s*["']([^"']*)["']/g;

  // Match star imports: import * as X from "..."
  const starRegex = /import\s+\*\s+as\s+\w+\s+from\s*["']([^"']*)["']/g;

  const importMatches: Array<{
    sourcePath: string;
    index: number;
    fullMatch: string;
  }> = [];

  let match;
  while ((match = destructuredRegex.exec(content)) !== null) {
    importMatches.push({
      sourcePath: match[1]!,
      index: match.index,
      fullMatch: match[0],
    });
  }
  while ((match = starRegex.exec(content)) !== null) {
    importMatches.push({
      sourcePath: match[1]!,
      index: match.index,
      fullMatch: match[0],
    });
  }

  for (const { sourcePath, index, fullMatch } of importMatches) {
    if (!DB_SUBPATH_SOURCE_PATTERN.test(sourcePath)) continue;
    if (isScript && SCRIPTS_ALLOWED_DB_SUBPATH.test(sourcePath)) continue;

    const line = content.substring(0, index).split("\n").length;
    errors.push({
      file: filePath,
      line,
      statement: fullMatch.replace(/\s+/g, " ").trim(),
    });
  }

  return errors;
}

/**
 * Check a file for direct Drizzle operations on `withTransaction` callback parameters.
 *
 * Finds `withTransaction(async (tx) => ...)` calls, extracts the callback parameter
 * name, then checks if that parameter is used for direct Drizzle operations like
 * `.insert(`, `.update(`, `.delete(`, etc., or relational queries like `.query.<table>`.
 *
 * Also handles function-reference callbacks by finding local functions that accept
 * a parameter named in the `withTransaction(fnName)` call and scanning their bodies.
 *
 * @param filePath - Path to the file to check.
 * @returns Array of validation errors found.
 */
async function checkFileDirectDbOperations(
  filePath: string,
): Promise<ValidationError[]> {
  const content = await Bun.file(filePath).text();
  const errors: ValidationError[] = [];
  const lines = content.split("\n");

  // Collect transaction parameter names from both inline and function-ref callbacks.
  const txParamNames = new Set<string>();

  // Match inline callbacks: withTransaction(async (tx) => or withTransaction((tx) =>
  const inlineCallbackRegex = /withTransaction\s*\(\s*(?:async\s*)?\(\s*(\w+)/g;
  let match;
  while ((match = inlineCallbackRegex.exec(content)) !== null) {
    txParamNames.add(match[1]!);
  }

  // Match function-reference callbacks: withTransaction(doUpdate)
  // Then find the function and extract its first parameter name.
  const fnRefRegex = /withTransaction\s*\(\s*(\w+)\s*\)/g;
  while ((match = fnRefRegex.exec(content)) !== null) {
    const fnName = match[1]!;
    // Skip if it looks like an inline callback (already captured above)
    if (fnName === "async") continue;

    // Find the local function/const and extract its first parameter
    const fnParamRegex = new RegExp(
      `(?:const|function)\\s+${fnName}[^(]*\\(\\s*(?:async\\s*)?\\(?\\s*(\\w+)`,
    );
    const fnMatch = content.match(fnParamRegex);
    if (fnMatch?.[1]) {
      txParamNames.add(fnMatch[1]);
    }
  }

  if (txParamNames.size === 0) return errors;

  // Build a single regex to find forbidden operations on any extracted tx param name.
  const namesPattern = [...txParamNames].map(escapeRegExp).join("|");
  const methodsPattern = FORBIDDEN_TX_METHODS.join("|");
  const forbiddenCallRegex = new RegExp(
    `\\b(${namesPattern})\\s*\\.\\s*(${methodsPattern})\\s*\\(`,
    "g",
  );

  // Separate regex for relational query access (e.g., param.query.<table>).
  const forbiddenQueryRegex = new RegExp(
    `\\b(${namesPattern})\\s*\\.\\s*query\\s*\\.`,
    "g",
  );

  for (const regex of [forbiddenCallRegex, forbiddenQueryRegex]) {
    while ((match = regex.exec(content)) !== null) {
      const line = content.substring(0, match.index).split("\n").length;
      const lineContent = lines[line - 1]?.trim() ?? match[0];
      errors.push({
        file: filePath,
        line,
        statement: lineContent,
      });
    }
  }

  return errors;
}

/**
 * Escape special regex characters in a string.
 * @param str - The string to escape.
 * @returns The escaped string safe for use in a RegExp.
 */
function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Report validation errors grouped by file.
 * @param params - Report parameters.
 * @param params.errors - Array of validation errors to report.
 * @param params.title - Title for the error section.
 * @param params.description - Description of the rule being enforced.
 */
function reportValidationErrors({
  errors,
  title,
  description,
}: {
  /** Array of validation errors to report. */
  errors: ValidationError[];
  /** Title for the error section. */
  title: string;
  /** Description of the rule being enforced. */
  description: string;
}): void {
  const grouped = new Map<string, ValidationError[]>();

  for (const error of errors) {
    if (!grouped.has(error.file)) {
      grouped.set(error.file, []);
    }
    grouped.get(error.file)!.push(error);
  }

  console.error(`\n${title}\n`);
  console.error(`${description}\n`);

  for (const [file, fileErrors] of grouped) {
    const relativePath = path.relative(process.cwd(), file);
    console.error(`${relativePath}:`);
    for (const error of fileErrors) {
      console.error(`  Line ${error.line}: ${error.statement}`);
    }
    console.error("");
  }

  console.error(`Found ${errors.length} error(s).`);
}

/** Main entry point. */
async function main(): Promise<void> {
  console.log("Validating database client usage...\n");

  const files = await findTsFiles(SRC_DIR);
  const clientErrors: ValidationError[] = [];
  const subpathErrors: ValidationError[] = [];
  const directOpErrors: ValidationError[] = [];

  for (const file of files) {
    const [cErrors, sErrors, dErrors] = await Promise.all([
      checkFile(file),
      checkFileSubpathImports(file),
      checkFileDirectDbOperations(file),
    ]);
    clientErrors.push(...cErrors);
    subpathErrors.push(...sErrors);
    directOpErrors.push(...dErrors);
  }

  if (clientErrors.length > 0) {
    reportValidationErrors({
      errors: clientErrors,
      title: "Direct db client import detected:",
      description:
        "Files outside backend/src/db/ must not import `db` directly.\nUse the centralized query functions in backend/src/db/queries/ instead.",
    });
  }

  if (subpathErrors.length > 0) {
    reportValidationErrors({
      errors: subpathErrors,
      title: "Direct db subpath import detected:",
      description:
        'Files outside backend/src/db/ must import from the db barrel (e.g., "../../db"),\nnot from subpaths like "../../db/schema" or "../../db/queries/users".',
    });
  }

  if (directOpErrors.length > 0) {
    reportValidationErrors({
      errors: directOpErrors,
      title: "Direct Drizzle operation on transaction detected:",
      description:
        "Transaction parameters from withTransaction callbacks must not be used for\ndirect Drizzle operations. Use the centralized query functions in db/queries/ instead.",
    });
  }

  if (
    clientErrors.length > 0 ||
    subpathErrors.length > 0 ||
    directOpErrors.length > 0
  ) {
    process.exit(1);
  }

  console.log("\u2713 Database client usage validation passed");
}

main().catch((error) => {
  console.error("Database client usage validation failed:", error);
  process.exit(1);
});
