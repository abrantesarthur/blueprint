/**
 * SQL Usage Validator
 *
 * Enforces two rules to prevent SQL injection vectors:
 *
 * Rule 1: Files outside backend/src/db/ must not import `sql` (the function)
 * from "drizzle-orm". This ensures all SQL logic stays in centralized query
 * functions where it can be audited and controlled.
 *
 * Rule 2: Files inside backend/src/db/queries/ must not use `sql.raw()`.
 * Unlike `sql` template tags (which parameterize interpolated values),
 * `sql.raw()` injects unparameterized strings directly into queries.
 * Schema files (backend/src/db/schema/) are exempt because CHECK constraints
 * require raw SQL for regex patterns.
 *
 * Type-only imports (e.g., `import type { SQL }`) are always allowed since
 * they have no runtime effect.
 *
 * Exclusions (Rule 1):
 * - backend/src/db/ (query functions may use sql for computed expressions)
 * - __tests__/ directories (test setup may need sql)
 * - backend/src/tests/ (test infrastructure)
 *
 * Exclusions (Rule 2):
 * - backend/src/db/schema/ (CHECK constraints require sql.raw for regex)
 * - __tests__/ directories (test setup may need sql.raw)
 *
 * Run with: bun src/scripts/validateSqlUsage.ts
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

const SRC_DIR = path.join(import.meta.dir, "..");

/** Directories that are allowed to import `sql` from drizzle-orm. */
const SQL_IMPORT_ALLOWED_DIRS = [
  path.join(SRC_DIR, "db"),
  path.join(SRC_DIR, "tests"),
];

/** Directory containing query files where sql.raw() is forbidden. */
const QUERIES_DIR = path.join(SRC_DIR, "db", "queries");

/** Validation error found during sql usage checking. */
interface ValidationError {
  /** File path where the error was found. */
  file: string;
  /** Line number in the file. */
  line: number;
  /** The code snippet that violated the rule. */
  statement: string;
}

/**
 * Check whether a directory should be skipped for Rule 1 (sql import check).
 * @param dirPath - Absolute path to the directory.
 * @param dirName - Name of the directory entry.
 * @returns Whether to skip this directory.
 */
function shouldSkipDirForImports(dirPath: string, dirName: string): boolean {
  if (dirName === "__tests__" || dirName === "node_modules") return true;
  return SQL_IMPORT_ALLOWED_DIRS.some(
    (allowed) => dirPath === allowed || dirPath.startsWith(allowed + "/"),
  );
}

/**
 * Recursively find all TypeScript files in a directory, excluding specified dirs.
 * @param dir - Directory to search.
 * @param shouldSkip - Predicate to determine if a directory should be skipped.
 * @param files - Accumulator for found files.
 * @returns Array of file paths.
 */
async function findTsFiles(
  dir: string,
  shouldSkip: (dirPath: string, dirName: string) => boolean,
  files: string[] = [],
): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (!shouldSkip(fullPath, entry.name)) {
        await findTsFiles(fullPath, shouldSkip, files);
      }
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Check a file for forbidden `sql` value imports from drizzle-orm.
 *
 * Detects import statements that bring `sql` into scope as a runtime value.
 * Skips type-only imports (`import type { ... }`).
 * Within mixed imports, skips `type sql` specifiers.
 *
 * @param filePath - Path to the file to check.
 * @returns Array of validation errors found.
 */
async function checkFileSqlImports(
  filePath: string,
): Promise<ValidationError[]> {
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

    // Only check drizzle-orm imports (including subpaths like drizzle-orm/pg-core)
    if (sourcePath !== "drizzle-orm" && !sourcePath.startsWith("drizzle-orm/"))
      continue;

    // Skip type-only imports entirely
    if (isTypeOnly) continue;

    // Check if `sql` is imported as a value (not `type sql`)
    const specs = specifiers.split(",").map((s) => s.trim());
    const hasSqlValue = specs.some((s) => /^sql(\s+as\s+\w+)?$/.test(s));
    if (!hasSqlValue) continue;

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
 * Check a file for forbidden `sql.raw()` calls.
 *
 * Detects any usage of `sql.raw(` in query files. This function bypasses
 * Drizzle's parameterization and is a direct SQL injection vector if used
 * with dynamic values.
 *
 * @param filePath - Path to the file to check.
 * @returns Array of validation errors found.
 */
async function checkFileSqlRaw(filePath: string): Promise<ValidationError[]> {
  const content = await Bun.file(filePath).text();
  const errors: ValidationError[] = [];
  const lines = content.split("\n");

  const sqlRawRegex = /\bsql\.raw\s*\(/g;

  let match;
  while ((match = sqlRawRegex.exec(content)) !== null) {
    const line = content.substring(0, match.index).split("\n").length;
    const lineContent = lines[line - 1]?.trim() ?? match[0];
    errors.push({
      file: filePath,
      line,
      statement: lineContent,
    });
  }

  return errors;
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

/**
 * Check whether a directory should be skipped for Rule 2 (sql.raw check).
 * Skips __tests__ and node_modules. The search root is already scoped to
 * db/queries/, so schema files are never encountered.
 * @param _dirPath - Absolute path to the directory (unused).
 * @param dirName - Name of the directory entry.
 * @returns Whether to skip this directory.
 */
function shouldSkipDirForSqlRaw(_dirPath: string, dirName: string): boolean {
  return dirName === "__tests__" || dirName === "node_modules";
}

/** Main entry point. */
async function main(): Promise<void> {
  console.log("Validating SQL expression usage...\n");

  // Rule 1: No `sql` imports outside db/
  const importFiles = await findTsFiles(SRC_DIR, shouldSkipDirForImports);
  const sqlImportErrors: ValidationError[] = [];

  for (const file of importFiles) {
    const errors = await checkFileSqlImports(file);
    sqlImportErrors.push(...errors);
  }

  // Rule 2: No `sql.raw()` in db/queries/
  const queryFiles = await findTsFiles(QUERIES_DIR, shouldSkipDirForSqlRaw);
  const sqlRawErrors: ValidationError[] = [];

  for (const file of queryFiles) {
    const errors = await checkFileSqlRaw(file);
    sqlRawErrors.push(...errors);
  }

  if (sqlImportErrors.length > 0) {
    reportValidationErrors({
      errors: sqlImportErrors,
      title: "Forbidden sql import detected:",
      description:
        'Files outside backend/src/db/ must not import `sql` from "drizzle-orm".\nSQL expressions must stay in centralized query functions in backend/src/db/queries/.\nIf you need a computed SQL expression, add a dedicated function in db/queries/ instead.',
    });
  }

  if (sqlRawErrors.length > 0) {
    reportValidationErrors({
      errors: sqlRawErrors,
      title: "Forbidden sql.raw() usage detected:",
      description:
        "Query files in backend/src/db/queries/ must not use sql.raw().\nsql.raw() bypasses Drizzle's parameterization and is a SQL injection vector.\nUse parameterized sql template tags instead (e.g., sql`col + 1`).",
    });
  }

  if (sqlImportErrors.length > 0 || sqlRawErrors.length > 0) {
    process.exit(1);
  }

  console.log("\u2713 SQL expression usage validation passed");
}

main().catch((error) => {
  console.error("SQL expression usage validation failed:", error);
  process.exit(1);
});
