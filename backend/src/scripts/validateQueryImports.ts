/**
 * Query Import Validator
 *
 * Validates that files in backend/src/db/queries/ do not import from model.ts files.
 * Type definitions should come from the schema or dedicated type files, not from
 * Elysia route models.
 *
 * Run with: bun src/scripts/validateQueryImports.ts
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

const QUERIES_DIR = path.join(import.meta.dir, "../db/queries");

/** Validation error found during import checking. */
interface ValidationError {
  /** File path where the error was found. */
  file: string;
  /** Line number in the file. */
  line: number;
  /** The import path that violated the rule. */
  importPath: string;
}

/**
 * Recursively find all TypeScript files in a directory (excluding __tests__).
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
      if (entry.name !== "__tests__") {
        await findTsFiles(fullPath, files);
      }
    } else if (entry.isFile() && entry.name.endsWith(".ts")) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Find all TypeScript files in the queries directory (excluding __tests__).
 * @returns Array of file paths.
 */
async function findQueryFiles(): Promise<string[]> {
  return findTsFiles(QUERIES_DIR);
}

/**
 * Check a file for imports from model.ts files.
 * @param filePath - Path to the file to check.
 * @returns Array of validation errors found.
 */
async function checkFileForModelImports(
  filePath: string,
): Promise<ValidationError[]> {
  const content = await Bun.file(filePath).text();
  const lines = content.split("\n");
  const errors: ValidationError[] = [];

  // Pattern to match imports from paths ending with /model.ts or /model
  const importPattern = /from\s+["']([^"']*\/model(?:\.ts)?)["']/;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Skip commented lines
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    const match = importPattern.exec(line);
    if (match?.[1]) {
      errors.push({
        file: filePath,
        line: i + 1,
        importPath: match[1],
      });
    }
  }

  return errors;
}

/**
 * Report validation errors grouped by file.
 * @param errors - Array of validation errors to report.
 */
function reportErrors(errors: ValidationError[]): void {
  const grouped = new Map<string, ValidationError[]>();

  for (const error of errors) {
    if (!grouped.has(error.file)) {
      grouped.set(error.file, []);
    }
    grouped.get(error.file)!.push(error);
  }

  console.error("\nQuery import validation failed:\n");
  console.error(
    "Files in db/queries/ should not import from */model.ts files.",
  );
  console.error("Use schema types or create dedicated type files instead.\n");

  for (const [file, fileErrors] of grouped) {
    const relativePath = path.relative(process.cwd(), file);
    console.error(`${relativePath}:`);
    for (const error of fileErrors) {
      console.error(`  Line ${error.line}: imports from "${error.importPath}"`);
    }
    console.error("");
  }

  console.error(`Found ${errors.length} error(s).`);
}

/** Main entry point. */
async function main(): Promise<void> {
  console.log("Validating query imports...\n");

  const queryFiles = await findQueryFiles();
  const allErrors: ValidationError[] = [];

  for (const file of queryFiles) {
    const errors = await checkFileForModelImports(file);
    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    reportErrors(allErrors);
    process.exit(1);
  }

  console.log("✓ Query import validation passed");
}

main().catch((error) => {
  console.error("Query import validation failed:", error);
  process.exit(1);
});
