import { getTableName, type Table } from "drizzle-orm";

import { flattenInclude } from "./flattenInclude";
import type { IncludeOption } from "./types";

/** A scalar value returned from a database column. */
export type ColumnValue = string | number | boolean | Date | null;

/** A nested result row: entity fields at root, relations nested under singular keys. */
export type NestedRow = Record<string, unknown>;

/**
 * Converts a plural table name to a singular relationship name.
 * Handles common English pluralization patterns used in the project's table names:
 * `users` → `user`, `categories` → `category`.
 * @param tableName - The plural table name.
 * @returns The singular form.
 */
function singularize(tableName: string): string {
  if (tableName.endsWith("ies")) return tableName.slice(0, -3) + "y";
  if (tableName.endsWith("s")) return tableName.slice(0, -1);
  return tableName;
}

/**
 * Determines whether an include is a "filter-only" join — i.e., joined purely
 * to constrain or filter the main query (via `on`, `required`, or aggregates),
 * with no columns to surface. Such joins should not produce a key in the
 * restructured result.
 *
 * A join is filter-only when `attributes` is an empty array AND every nested
 * include is itself filter-only (recursive). This means a chain of joins that
 * exists purely to enable a deeper filter or aggregate is collapsed away.
 * @param item - The include option to inspect.
 * @returns True when no columns from this branch will surface in the result.
 */
function isFilterOnlyJoin(item: IncludeOption<Table>): boolean {
  if (item.attributes === undefined || item.attributes.length > 0) {
    return false;
  }
  if (item.include === undefined || item.include.length === 0) {
    return true;
  }
  return item.include.every(isFilterOnlyJoin);
}

/**
 * Restructures columns for a single included table from the flat query result.
 * Extracts columns matching the table's prefix and optionally recurses into
 * nested includes to build the hierarchy.
 *
 * For left-joined tables (`required: false`), returns `null` when all column
 * values are null (no matching row).
 * @param flat - The flat result row from a prefixed select.
 * @param item - The include option describing this joined table.
 * @param leftJoinedTables - Set of table names that were left-joined.
 * @returns A nested object for this relation, or `null` for unmatched left joins.
 */
function restructureIncludeLevel(
  flat: Record<string, ColumnValue>,
  item: IncludeOption<Table>,
  leftJoinedTables: Set<string>,
): Record<string, unknown> | null {
  const effectiveTable = item.alias ?? item.table;
  const tableName = getTableName(effectiveTable);
  const prefix = tableName + ".";
  const columns: Record<string, unknown> = {};
  let hasNonNull = false;

  for (const [key, value] of Object.entries(flat)) {
    if (key.startsWith(prefix)) {
      columns[key.slice(prefix.length)] = value;
      if (value !== null) hasNonNull = true;
    }
  }

  // Left-join null collapsing: if all columns are null, the join had no match
  if (leftJoinedTables.has(tableName) && !hasNonNull) return null;

  // Recurse into nested includes (skipping filter-only joins)
  for (const nested of item.include ?? []) {
    if (isFilterOnlyJoin(nested)) continue;
    const nestedName =
      nested.relationName ??
      singularize(getTableName(nested.alias ?? nested.table));
    columns[nestedName] = restructureIncludeLevel(
      flat,
      nested,
      leftJoinedTables,
    );
  }

  return columns;
}

/**
 * Restructures a flat query result into a nested shape.
 * Main entity columns are unwrapped to the root. Included tables are nested
 * under their relationship names (singular or explicit `relationName`).
 * Aggregate aliases (unprefixed keys) stay at the root.
 * @param flat - The flat result row from a prefixed select.
 * @param mainTable - The primary Drizzle table.
 * @param include - The include tree describing joined tables.
 * @param leftJoinedTables - Set of table names that were left-joined.
 * @returns A nested object with entity fields at root and relations nested.
 */
function restructureRow(
  flat: Record<string, ColumnValue>,
  mainTable: Table,
  include: IncludeOption<Table>[],
  leftJoinedTables: Set<string>,
): NestedRow {
  const mainTableName = getTableName(mainTable);
  const mainPrefix = mainTableName + ".";
  const result: Record<string, unknown> = {};

  // Phase 1: Extract main table columns to root + aggregates
  for (const [key, value] of Object.entries(flat)) {
    if (key.startsWith(mainPrefix)) {
      result[key.slice(mainPrefix.length)] = value;
    } else if (!key.includes(".")) {
      // Aggregate alias or non-prefixed key — stays at root
      result[key] = value;
    }
  }

  // Phase 2: Recursively nest each include under its relation name
  // (filter-only joins contribute to the SQL but produce no result key)
  for (const item of include) {
    if (isFilterOnlyJoin(item)) continue;
    const relationName =
      item.relationName ?? singularize(getTableName(item.alias ?? item.table));
    result[relationName] = restructureIncludeLevel(
      flat,
      item,
      leftJoinedTables,
    );
  }

  return result;
}

/**
 * Executes a Drizzle query and restructures results when joins are present.
 * When `include` is falsy or empty, returns raw query results unchanged.
 * Otherwise, uses the include tree to produce nested output where:
 * - Main entity columns are at the root
 * - Included tables are nested under relationship names
 * - Aggregates remain at the root as scalars
 *
 * For left-joined tables (`required: false`), if all column values in the
 * nested object are `null` (i.e., no matching row), the nested object is
 * collapsed to `null`.
 * @param options - The query execution options.
 * @param options.query - The Drizzle query to execute.
 * @param options.mainTable - The primary Drizzle table.
 * @param options.include - Optional nested include tree of joined tables.
 * @returns Nested rows (entity at root, relations nested) or raw rows if no include.
 */
export async function executeQuery({
  query,
  mainTable,
  include,
}: {
  /** The Drizzle query to execute. */
  query: PromiseLike<Record<string, ColumnValue>[]>;
  /** The primary Drizzle table. */
  mainTable: Table;
  /** Optional nested include tree of joined tables. */
  include: IncludeOption<Table>[] | undefined;
}): Promise<NestedRow[] | Record<string, ColumnValue>[]> {
  const results = await query;

  if (!include?.length) return results;

  const flattened = flattenInclude(include);

  const leftJoinedTables = new Set(
    flattened
      .filter((i) => i.required === false)
      .map((i) => getTableName(i.alias ?? i.table)),
  );

  // Pass include TREE (not flat list) to restructureRow for nested output
  return results.map((row) =>
    restructureRow(row, mainTable, include, leftJoinedTables),
  );
}
