/**
 * Migration Validation Script
 *
 * Performs four checks:
 * 1. File consistency - Verifies migration SQL files, snapshots, and journal entries are in sync (including contiguous indices)
 * 2. Chain integrity - Verifies snapshot prevId linkage and monotonic journal timestamps
 * 3. Immutability - Verifies already-committed migration files and snapshots have not been altered
 * 4. Schema drift - Compares current schema against latest snapshot to detect uncommitted changes
 *
 * Run with: bun src/scripts/checkMigrations.ts
 */

import { spawnSync } from "node:child_process";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { generateDrizzleJson } from "drizzle-kit/api";

import * as schema from "../db/schema";

const MIGRATIONS_DIR = path.join(import.meta.dir, "../db/migrations");
const META_DIR = path.join(MIGRATIONS_DIR, "meta");

// ============================================================================
// Types
// ============================================================================

/** A journal entry in the _journal.json file. */
interface JournalEntry {
  /** The migration index. */
  idx: number;
  /** The journal version. */
  version: string;
  /** Timestamp when the entry was created. */
  when: number;
  /** The migration tag (filename without .sql). */
  tag: string;
  /** Whether breakpoints are enabled. */
  breakpoints: boolean;
}

/** The journal file structure. */
interface Journal {
  /** The journal version. */
  version: string;
  /** The database dialect. */
  dialect: string;
  /** The list of migration entries. */
  entries: JournalEntry[];
}

/** Snapshot structure for comparison (subset of full PgSchema). */
interface SnapshotForComparison {
  /** Map of table names to table definitions. */
  tables: Record<string, unknown>;
  /** Map of enum names to enum definitions. */
  enums: Record<string, unknown>;
}

// ============================================================================
// File Consistency Check
// ============================================================================

/**
 * Get all migration SQL files sorted by index.
 * @returns Array of migration file info with index and filename.
 */
async function getMigrationFiles(): Promise<
  Array<{ idx: number; filename: string }>
> {
  const files = await readdir(MIGRATIONS_DIR);
  return files
    .filter((f) => f.match(/^\d{4}_.*\.sql$/))
    .map((f) => ({
      idx: parseInt(f.split("_")[0]!),
      filename: f,
    }))
    .sort((a, b) => a.idx - b.idx);
}

/**
 * Get all snapshot indices from the meta directory.
 * @returns Set of snapshot indices.
 */
async function getSnapshotIndices(): Promise<Set<number>> {
  const files = await readdir(META_DIR);
  const indices = files
    .filter((f) => f.match(/^\d{4}_snapshot\.json$/))
    .map((f) => parseInt(f.split("_")[0]!));
  return new Set(indices);
}

/**
 * Load and parse the journal file.
 * @returns Parsed journal object.
 */
async function loadJournal(): Promise<Journal> {
  const journalPath = path.join(META_DIR, "_journal.json");
  const content = await readFile(journalPath, "utf-8");
  return JSON.parse(content) as Journal;
}

/**
 * Check migration files consistency.
 * Verifies that migration SQL files, snapshots, and journal entries are in sync.
 * @returns Array of error messages, empty if all checks pass.
 */
async function checkFileConsistency(): Promise<string[]> {
  const errors: string[] = [];

  const migrations = await getMigrationFiles();
  const snapshotIndices = await getSnapshotIndices();
  const journal = await loadJournal();

  const journalIndices = new Set(journal.entries.map((e) => e.idx));

  // Check each migration has a journal entry
  for (const migration of migrations) {
    const { idx, filename } = migration;
    const tag = filename.replace(".sql", "");

    if (!journalIndices.has(idx)) {
      errors.push(
        `Missing journal entry for migration ${filename} (idx: ${idx})`,
      );
    } else {
      const entry = journal.entries.find((e) => e.idx === idx);
      if (entry && entry.tag !== tag) {
        errors.push(
          `Journal entry tag mismatch for idx ${idx}: expected "${tag}", got "${entry.tag}"`,
        );
      }
    }
  }

  // Check for orphaned snapshots
  for (const snapshotIdx of snapshotIndices) {
    if (!migrations.some((m) => m.idx === snapshotIdx)) {
      errors.push(
        `Orphaned snapshot: ${String(snapshotIdx).padStart(4, "0")}_snapshot.json has no corresponding migration`,
      );
    }
  }

  // Check for orphaned journal entries
  for (const entry of journal.entries) {
    if (!migrations.some((m) => m.idx === entry.idx)) {
      errors.push(
        `Orphaned journal entry: idx ${entry.idx} (${entry.tag}) has no corresponding migration`,
      );
    }
  }

  // Check journal entries are in order
  const sortedEntries = [...journal.entries].sort((a, b) => a.idx - b.idx);
  for (let i = 0; i < journal.entries.length; i++) {
    if (journal.entries[i]!.idx !== sortedEntries[i]!.idx) {
      errors.push("Journal entries are not in correct order by idx");
      break;
    }
  }

  // Check migration indices are contiguous starting at 0 (no gaps)
  for (let i = 0; i < migrations.length; i++) {
    if (migrations[i]!.idx !== i) {
      errors.push(
        `Migration index gap detected: expected idx ${i}, found ${migrations[i]!.idx} (${migrations[i]!.filename})`,
      );
      break;
    }
  }

  return errors;
}

// ============================================================================
// Chain Integrity Check
// ============================================================================

/** The prevId used by the very first snapshot, which has no predecessor. */
const ROOT_PREV_ID = "00000000-0000-0000-0000-000000000000";

/** Identity fields of a snapshot used to verify the migration chain. */
interface SnapshotChainLink {
  /** The migration index this snapshot belongs to. */
  idx: number;
  /** The snapshot's own identifier. */
  id: string;
  /** The identifier of the snapshot this one builds upon. */
  prevId: string;
}

/**
 * Load the chain identity (id/prevId) of every snapshot, sorted by index.
 * @returns Array of snapshot chain links ordered by ascending index.
 */
async function loadSnapshotChain(): Promise<SnapshotChainLink[]> {
  const files = await readdir(META_DIR);
  const snapshots = files.filter((f) => f.match(/^\d{4}_snapshot\.json$/));

  const links: SnapshotChainLink[] = [];
  for (const file of snapshots) {
    const content = await readFile(path.join(META_DIR, file), "utf-8");
    const parsed = JSON.parse(content) as { id: string; prevId: string };
    links.push({
      idx: parseInt(file.split("_")[0]!),
      id: parsed.id,
      prevId: parsed.prevId,
    });
  }

  return links.sort((a, b) => a.idx - b.idx);
}

/**
 * Verify snapshot prevId linkage and journal timestamp ordering.
 * Ensures each snapshot points at its predecessor and that journal
 * timestamps increase monotonically with the migration index.
 * @returns Array of error messages, empty if the chain is intact.
 */
async function checkChainIntegrity(): Promise<string[]> {
  const errors: string[] = [];

  const chain = await loadSnapshotChain();
  for (let i = 0; i < chain.length; i++) {
    const link = chain[i]!;
    const expectedPrevId = i === 0 ? ROOT_PREV_ID : chain[i - 1]!.id;
    if (link.prevId !== expectedPrevId) {
      errors.push(
        `Broken snapshot chain at idx ${link.idx}: prevId "${link.prevId}" does not match expected "${expectedPrevId}"`,
      );
    }
  }

  const journal = await loadJournal();
  const sorted = [...journal.entries].sort((a, b) => a.idx - b.idx);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i]!.when <= sorted[i - 1]!.when) {
      errors.push(
        `Journal timestamps not monotonic: idx ${sorted[i]!.idx} (when ${sorted[i]!.when}) is not after idx ${sorted[i - 1]!.idx} (when ${sorted[i - 1]!.when})`,
      );
    }
  }

  return errors;
}

// ============================================================================
// Immutability Check
// ============================================================================

/**
 * Detect modifications, deletions, or renames of migration files that already
 * exist in HEAD. New migration files are permitted; altering historical SQL
 * files or snapshots is not. The append-only `_journal.json` is exempt, since
 * it legitimately changes whenever a new migration is added.
 * @returns Array of error messages, empty when no historical files changed.
 */
function checkImmutability(): string[] {
  const result = spawnSync(
    "git",
    ["diff", "--name-status", "HEAD", "--", MIGRATIONS_DIR],
    { encoding: "utf-8" },
  );

  if (result.status !== 0) {
    console.warn(
      "  ⚠ Skipping immutability check (git unavailable or no commits yet)",
    );
    return [];
  }

  const errors: string[] = [];
  const lines = result.stdout.split("\n").filter((l) => l.trim().length > 0);

  for (const line of lines) {
    const parts = line.split("\t");
    const code = parts[0]![0];
    const filePaths = parts.slice(1);
    const primary = filePaths[filePaths.length - 1]!;

    if (primary.endsWith("_journal.json")) continue;

    if (code === "M" || code === "D" || code === "R") {
      const action =
        code === "M" ? "modified" : code === "D" ? "deleted" : "renamed";
      errors.push(
        `Historical migration file ${action}: ${filePaths.join(" -> ")}`,
      );
    }
  }

  return errors;
}

// ============================================================================
// Schema Drift Check
// ============================================================================

/**
 * Find the latest snapshot file in the migrations meta directory.
 * @returns Path to the latest snapshot file.
 */
async function findLatestSnapshot(): Promise<string | null> {
  try {
    const files = await readdir(META_DIR);
    const snapshots = files
      .filter((f) => f.match(/^\d+_snapshot\.json$/))
      .sort()
      .reverse();

    if (snapshots.length === 0) return null;
    return path.join(META_DIR, snapshots[0]!);
  } catch {
    return null;
  }
}

/**
 * Load and parse a snapshot JSON file.
 * @param snapshotPath - Path to the snapshot file.
 * @returns Parsed snapshot object.
 */
async function loadSnapshot(
  snapshotPath: string,
): Promise<SnapshotForComparison> {
  const content = await Bun.file(snapshotPath).text();
  return JSON.parse(content) as SnapshotForComparison;
}

/**
 * Normalize snapshot for comparison by removing volatile fields.
 * @param snapshot - The snapshot to normalize.
 * @returns Normalized snapshot with only comparable fields.
 */
function normalizeForComparison(snapshot: SnapshotForComparison): object {
  return {
    tables: snapshot.tables,
    enums: snapshot.enums,
  };
}

/**
 * Recursively sort object keys for consistent comparison.
 * @param obj - Object to sort.
 * @returns Object with sorted keys at all levels.
 */
function sortObjectKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sortObjectKeys);
  }

  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as object).sort()) {
    sorted[key] = sortObjectKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

/**
 * Deep compare two objects.
 * @param a - First object.
 * @param b - Second object.
 * @returns True if objects are deeply equal.
 */
function deepEqual(a: unknown, b: unknown): boolean {
  return (
    JSON.stringify(sortObjectKeys(a)) === JSON.stringify(sortObjectKeys(b))
  );
}

/**
 * Find differences between two snapshots.
 * @param prev - Previous snapshot (from migrations).
 * @param current - Current snapshot (from schema).
 * @returns Array of difference descriptions.
 */
function findDifferences(
  prev: SnapshotForComparison,
  current: SnapshotForComparison,
): string[] {
  const differences: string[] = [];

  // Compare tables
  const prevTables = new Set(Object.keys(prev.tables));
  const currentTables = new Set(Object.keys(current.tables));

  for (const table of currentTables) {
    if (!prevTables.has(table)) {
      differences.push(`+ Table added: ${table}`);
    }
  }

  for (const table of prevTables) {
    if (!currentTables.has(table)) {
      differences.push(`- Table removed: ${table}`);
    }
  }

  for (const table of currentTables) {
    if (prevTables.has(table)) {
      const prevTable = prev.tables[table] as Record<string, unknown>;
      const currentTable = current.tables[table] as Record<string, unknown>;

      const prevColumns = (prevTable["columns"] ?? {}) as Record<
        string,
        unknown
      >;
      const currentColumns = (currentTable["columns"] ?? {}) as Record<
        string,
        unknown
      >;

      const prevColNames = new Set(Object.keys(prevColumns));
      const currentColNames = new Set(Object.keys(currentColumns));

      for (const col of currentColNames) {
        if (!prevColNames.has(col)) {
          differences.push(`+ Column added: ${table}.${col}`);
        }
      }

      for (const col of prevColNames) {
        if (!currentColNames.has(col)) {
          differences.push(`- Column removed: ${table}.${col}`);
        }
      }

      for (const col of currentColNames) {
        if (prevColNames.has(col)) {
          if (!deepEqual(prevColumns[col], currentColumns[col])) {
            differences.push(`~ Column modified: ${table}.${col}`);
          }
        }
      }

      const propsToCompare = [
        "checkConstraints",
        "indexes",
        "foreignKeys",
        "uniqueConstraints",
      ];
      for (const prop of propsToCompare) {
        if (!deepEqual(prevTable[prop], currentTable[prop])) {
          differences.push(`~ Table ${prop} changed: ${table}`);
        }
      }
    }
  }

  // Compare enums
  const prevEnums = new Set(Object.keys(prev.enums));
  const currentEnums = new Set(Object.keys(current.enums));

  for (const enumName of currentEnums) {
    if (!prevEnums.has(enumName)) {
      differences.push(`+ Enum added: ${enumName}`);
    }
  }

  for (const enumName of prevEnums) {
    if (!currentEnums.has(enumName)) {
      differences.push(`- Enum removed: ${enumName}`);
    }
  }

  for (const enumName of currentEnums) {
    if (prevEnums.has(enumName)) {
      if (!deepEqual(prev.enums[enumName], current.enums[enumName])) {
        differences.push(`~ Enum modified: ${enumName}`);
      }
    }
  }

  return differences;
}

/**
 * Check for schema drift against the latest snapshot.
 * @returns Array of drift descriptions, empty if schema is in sync.
 */
async function checkSchemaDrift(): Promise<string[]> {
  const latestSnapshotPath = await findLatestSnapshot();
  if (!latestSnapshotPath) {
    return ["No migration snapshots found. Run 'bun db:generate' first."];
  }

  console.log(`  Latest snapshot: ${path.basename(latestSnapshotPath)}`);

  const prevSnapshot = await loadSnapshot(latestSnapshotPath);

  const currentSnapshot = generateDrizzleJson(
    schema as unknown as Record<string, unknown>,
    undefined,
    undefined,
    "snake_case",
  ) as unknown as SnapshotForComparison;

  const normalizedPrev = normalizeForComparison(prevSnapshot);
  const normalizedCurrent = normalizeForComparison(currentSnapshot);

  if (deepEqual(normalizedPrev, normalizedCurrent)) {
    return [];
  }

  return findDifferences(prevSnapshot, currentSnapshot);
}

// ============================================================================
// Main
// ============================================================================

/** Main entry point. */
async function main(): Promise<void> {
  console.log("Validating migrations...\n");

  let hasErrors = false;

  // Step 1: Check file consistency
  console.log("[1/4] Checking migration files consistency...");
  const fileErrors = await checkFileConsistency();

  if (fileErrors.length > 0) {
    hasErrors = true;
    console.error("  ✗ Migration files are inconsistent!\n");
    for (const error of fileErrors) {
      console.error(`    - ${error}`);
    }
    console.error(
      "\n  Ensure every migration SQL file has a journal entry in meta/_journal.json.\n",
    );
  } else {
    console.log("  ✓ Migration files are consistent\n");
  }

  // Step 2: Check snapshot chain and journal timestamp integrity
  console.log("[2/4] Checking snapshot chain integrity...");
  const chainErrors = await checkChainIntegrity();

  if (chainErrors.length > 0) {
    hasErrors = true;
    console.error("  ✗ Migration chain is broken!\n");
    for (const error of chainErrors) {
      console.error(`    - ${error}`);
    }
    console.error(
      "\n  This usually indicates a bad merge or a hand-edited snapshot/journal.\n",
    );
  } else {
    console.log("  ✓ Migration chain is intact\n");
  }

  // Step 3: Check immutability of already-committed migrations
  console.log("[3/4] Checking migration immutability...");
  const immutabilityErrors = checkImmutability();

  if (immutabilityErrors.length > 0) {
    hasErrors = true;
    console.error("  ✗ Historical migration files were altered!\n");
    for (const error of immutabilityErrors) {
      console.error(`    - ${error}`);
    }
    console.error(
      "\n  Committed migrations are immutable. Revert these files and add a new migration instead.\n",
    );
  } else {
    console.log("  ✓ Historical migrations are unchanged\n");
  }

  // Step 4: Check schema drift
  console.log("[4/4] Checking for schema drift...");
  const driftErrors = await checkSchemaDrift();

  if (driftErrors.length > 0) {
    hasErrors = true;
    console.error("  ✗ Schema has drifted from migrations!\n");
    console.error("  Detected changes:\n");
    for (const diff of driftErrors) {
      console.error(`    ${diff}`);
    }
    console.error("\n  Run 'bun db:generate' to create the migration.\n");
  } else {
    console.log("  ✓ Schema is in sync with migrations\n");
  }

  // Final result
  if (hasErrors) {
    process.exit(1);
  }

  console.log("✓ All migration checks passed");
  process.exit(0);
}

main().catch((error) => {
  console.error("Migration check failed:", error);
  process.exit(1);
});
