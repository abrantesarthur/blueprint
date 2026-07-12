import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import type { PgSelect } from "drizzle-orm/pg-core";

import { flattenInclude } from "./flattenInclude";
import type { IncludeOption } from "./types";

/**
 * Applies groupBy clauses to a query, resolving both main-table columns
 * and dot-notation joined-table columns (e.g., `"users.id"`).
 *
 * Joined tables are derived from the raw `include` tree, which is flattened
 * internally (consistent with buildAttributeSelection).
 * Invalid keys are silently skipped.
 *
 * @param options - The groupBy options.
 * @param options.query - The dynamic query to apply groupBy to.
 * @param options.mainTable - The main Drizzle table object.
 * @param options.groupBy - The groupBy keys (plain column names or dot-notation strings).
 * @param options.include - Optional nested include tree of joined tables.
 */
export function applyGroupBy<Q extends PgSelect, T extends Table>({
  query,
  mainTable,
  groupBy,
  include,
}: {
  /** The dynamic query to apply groupBy to. */
  query: Q;
  /** The main Drizzle table object. */
  mainTable: T;
  /** The groupBy keys (plain column names or dot-notation strings). */
  groupBy: readonly string[] | undefined;
  /** Optional nested include tree of joined tables. */
  include?: IncludeOption<Table>[];
}): void {
  if (!groupBy || groupBy.length === 0) return;

  const mainColumns = getTableColumns(mainTable);
  const joinedTables = flattenInclude(include);
  const groupByClauses = [];

  for (const key of groupBy) {
    if (key.includes(".")) {
      const [tableName, columnName] = key.split(".");
      const joinedTable = joinedTables.find(
        (t) => getTableName(t.alias ?? t.table) === tableName,
      );
      if (!tableName || !columnName || !joinedTable) continue;

      const effectiveTable = joinedTable.alias ?? joinedTable.table;
      const joinedColumns = getTableColumns(effectiveTable);
      const column = joinedColumns[columnName];
      if (column) {
        groupByClauses.push(column);
      }
    } else {
      const column = mainColumns[key];
      if (column) {
        groupByClauses.push(column);
      }
    }
  }

  if (groupByClauses.length > 0) {
    query.groupBy(...groupByClauses);
  }
}
