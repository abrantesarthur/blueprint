/**
 * Test .only() Marker Validator
 *
 * Prevents committing test files that contain .only() markers,
 * which would cause other tests to be skipped in CI.
 *
 * Run with: bun src/scripts/validateTestOnly.ts
 */

import path from "node:path";

const SRC_DIR = path.join(import.meta.dir, "../");

/** Match found during scanning. */
interface OnlyMatch {
  /** File path where the marker was found. */
  file: string;
  /** Line number in the file. */
  line: number;
  /** The matched line content (trimmed). */
  content: string;
}

/**
 * Scans all test files for .only() markers.
 * @returns Array of matches found.
 */
async function findOnlyMarkers(): Promise<OnlyMatch[]> {
  const glob = new Bun.Glob("**/*.test.ts");
  const matches: OnlyMatch[] = [];

  // Pattern to match test.only(, it.only(, describe.only(
  const pattern = /\.(only)\s*\(/;

  for await (const filePath of glob.scan({ cwd: SRC_DIR })) {
    const fullPath = path.join(SRC_DIR, filePath);
    const content = await Bun.file(fullPath).text();
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;

      // Skip commented lines
      const trimmed = line.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*")) continue;

      if (pattern.test(line)) {
        matches.push({
          file: fullPath,
          line: i + 1,
          content: trimmed.slice(0, 80) + (trimmed.length > 80 ? "..." : ""),
        });
      }
    }
  }

  return matches;
}

/**
 * Report found .only() markers grouped by file.
 * @param matches - Array of matches to report.
 */
function reportMatches(matches: OnlyMatch[]): void {
  const grouped = new Map<string, OnlyMatch[]>();

  for (const match of matches) {
    if (!grouped.has(match.file)) {
      grouped.set(match.file, []);
    }
    grouped.get(match.file)!.push(match);
  }

  console.error("\nFound .only() markers in test files:\n");

  for (const [file, fileMatches] of grouped) {
    const relativePath = path.relative(process.cwd(), file);
    console.error(`${relativePath}:`);
    for (const match of fileMatches) {
      console.error(`  Line ${match.line}: ${match.content}`);
    }
    console.error("");
  }

  console.error(
    `Found ${matches.length} .only() marker(s). Remove them before committing.`,
  );
}

/** Main entry point. */
async function main(): Promise<void> {
  const matches = await findOnlyMarkers();

  if (matches.length > 0) {
    reportMatches(matches);
    process.exit(1);
  }

  console.log("No .only() markers found in test files");
}

main().catch((error) => {
  console.error("Test only validation failed:", error);
  process.exit(1);
});
