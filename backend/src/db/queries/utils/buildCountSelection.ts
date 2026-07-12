import { count, getTableColumns, getTableName, type Table } from "drizzle-orm";
import type { SelectedFields } from "drizzle-orm/pg-core";

import { flattenInclude } from "./flattenInclude";
import { resolveAggregates } from "./resolveAggregates";
import type { AggregateAttribute, IncludeOption } from "./types";

/**
 * Builds a count-mode selection containing `COUNT(*)` (aliased as `"count"`),
 * optional custom aggregate expressions, and, when `groupBy` is provided, the
 * grouped columns resolved from the main and joined tables.
 * @param options - The count selection options.
 * @param options.mainTable - The primary Drizzle table.
 * @param options.include - Nested include tree of joined tables.
 * @param options.groupBy - Columns to include alongside COUNT(*).
 * @param options.aggregates - Additional aggregate expressions to include.
 * @returns A SelectedFields object for a count query.
 */
export function buildCountSelection({
  mainTable,
  include,
  groupBy,
  aggregates,
}: {
  /** The primary Drizzle table. */
  mainTable: Table;
  /** Nested include tree of joined tables. */
  include?: IncludeOption<Table>[];
  /** Columns to include alongside COUNT(*). */
  groupBy?: readonly string[];
  /** Additional aggregate expressions to include in the count selection. */
  aggregates?: AggregateAttribute<Record<string, unknown>, string>[];
}): SelectedFields {
  const flattenedJoined = flattenInclude(include);
  const selection: SelectedFields = {};
  const hasJoinedTables = flattenedJoined.length > 0;

  selection["count"] = count().as("count");

  if (groupBy) {
    const mainColumns = getTableColumns(mainTable);
    const mainName = getTableName(mainTable);

    for (const key of groupBy) {
      if (key.includes(".")) {
        // Dot-notation key: resolve from joined tables (e.g. "users.firstName")
        const [tableName, columnName] = key.split(".");
        const joined = flattenedJoined.find(
          (t) => getTableName(t.alias ?? t.table) === tableName,
        );
        if (!tableName || !columnName || !joined) continue;
        const effectiveTable = joined.alias ?? joined.table;
        const col = getTableColumns(effectiveTable)[columnName];
        if (col) selection[key] = col;
      } else {
        // Plain main-table key: prefix when joins are present
        const col = mainColumns[key];
        if (col) {
          selection[hasJoinedTables ? `${mainName}.${key}` : key] = col;
        }
      }
    }
  }

  // Resolve custom aggregate expressions
  if (aggregates) {
    resolveAggregates({ selection, mainTable, flattenedJoined, aggregates });
  }

  return selection;
}
