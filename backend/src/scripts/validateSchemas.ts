/**
 * TypeBox Schema Naming Convention Validator
 *
 * Validates that schemas used in Elysia routes follow naming conventions:
 * - body option schemas must end with `Body` suffix
 * - query option schemas must end with `Query` suffix
 * - response option schemas must end with `Response` suffix
 * - params option schemas must end with `Param` suffix
 *
 * Run with: bun src/scripts/validateSchemas.ts
 */

import { readdir } from "node:fs/promises";
import path from "node:path";

const MODULES_DIR = path.join(import.meta.dir, "../modules");

/** Validation rules mapping option names to required suffixes. */
const VALIDATION_RULES: Record<string, string> = {
  body: "Body",
  query: "Query",
  response: "Response",
  params: "Param",
};

/** Validation error found during schema name checking. */
interface ValidationError {
  /** File path where the error was found. */
  file: string;
  /** Line number in the file. */
  line: number;
  /** The route option (body, query, response, params). */
  option: string;
  /** The schema name that violated the convention. */
  schemaName: string;
  /** The expected suffix for this option type. */
  expectedSuffix: string;
}

/**
 * Recursively find all index.ts files in the modules directory.
 * @param dir - Directory to search.
 * @returns Array of file paths.
 */
async function findIndexFiles(dir: string = MODULES_DIR): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findIndexFiles(fullPath)));
    } else if (entry.name === "index.ts") {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Extract schema usages from a file's content.
 * Finds patterns like `body: "schemaName"` or `response: "schemaName"`.
 * @param content - File content to parse.
 * @returns Array of matches with line number, option, and schema name.
 */
function extractSchemaUsages(
  content: string,
): Array<{ line: number; option: string; schemaName: string }> {
  const usages: Array<{ line: number; option: string; schemaName: string }> =
    [];
  const lines = content.split("\n");

  // Pattern to match: body: "schemaName" or response: "schemaName", etc.
  // Captures the option name and the schema name (string literal)
  const pattern = /\b(body|query|response|params)\s*:\s*["']([^"']+)["']/g;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;

    // Skip commented lines
    const trimmed = line.trim();
    if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

    let match;
    while ((match = pattern.exec(line)) !== null) {
      const option = match[1];
      const schemaName = match[2];
      if (option && schemaName) {
        usages.push({
          line: i + 1,
          option,
          schemaName,
        });
      }
    }
    // Reset regex lastIndex for next line
    pattern.lastIndex = 0;
  }

  return usages;
}

/**
 * Validate schema usages against naming conventions.
 * @param file - File path being validated.
 * @param usages - Schema usages extracted from the file.
 * @returns Array of validation errors.
 */
function validateUsages(
  file: string,
  usages: Array<{ line: number; option: string; schemaName: string }>,
): ValidationError[] {
  const errors: ValidationError[] = [];

  for (const usage of usages) {
    const expectedSuffix = VALIDATION_RULES[usage.option];
    if (!expectedSuffix) continue;

    if (!usage.schemaName.endsWith(expectedSuffix)) {
      errors.push({
        file,
        line: usage.line,
        option: usage.option,
        schemaName: usage.schemaName,
        expectedSuffix,
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

  console.error("\nTypeBox schema naming validation failed:\n");

  for (const [file, fileErrors] of grouped) {
    const relativePath = path.relative(process.cwd(), file);
    console.error(`${relativePath}:`);
    for (const error of fileErrors) {
      console.error(
        `  Line ${error.line}: "${error.schemaName}" used as ${error.option} should end with "${error.expectedSuffix}"`,
      );
    }
    console.error("");
  }

  console.error(`Found ${errors.length} error(s).`);
}

/** Main entry point. */
async function main(): Promise<void> {
  console.log("Validating TypeBox schema naming conventions...\n");

  const indexFiles = await findIndexFiles();
  const allErrors: ValidationError[] = [];

  // Skip the main modules/index.ts which just re-exports
  const routeFiles = indexFiles.filter(
    (f) => f !== path.join(MODULES_DIR, "index.ts"),
  );

  for (const file of routeFiles) {
    const content = await Bun.file(file).text();
    const usages = extractSchemaUsages(content);
    const errors = validateUsages(file, usages);
    allErrors.push(...errors);
  }

  if (allErrors.length > 0) {
    reportErrors(allErrors);
    process.exit(1);
  }

  console.log("✓ Schema naming validation passed");
}

main().catch((error) => {
  console.error("Schema validation failed:", error);
  process.exit(1);
});
