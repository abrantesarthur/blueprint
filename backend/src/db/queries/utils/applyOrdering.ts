import {
  asc,
  desc,
  getTableColumns,
  getTableName,
  SQL,
  type SQLWrapper,
  type Table,
} from "drizzle-orm";
import type { PgSelect, SelectedFields } from "drizzle-orm/pg-core";

import { flattenInclude } from "./flattenInclude";
import type { IncludeOption, OrderByOption } from "./types";

/**
 * Applies ordering to a query based on orderBy options, resolving both
 * main-table columns and dot-notation joined-table columns (e.g., `"users.name"`).
 *
 * Joined tables are derived from the raw `include` tree, which is flattened
 * internally (consistent with applyGroupBy and buildAttributeSelection).
 * Invalid keys are silently skipped.
 *
 * @param options - The ordering options.
 * @param options.query - The dynamic query to apply ordering to.
 * @param options.mainTable - The Drizzle table object.
 * @param options.orderBy - The ordering options.
 * @param options.include - Optional nested include tree of joined tables.
 * @param options.selection - The selection map from buildAttributeSelection. Used to resolve aggregate aliases for ORDER BY.
 */
export function applyOrdering<Q extends PgSelect, T extends Table>({
  query,
  mainTable,
  orderBy,
  include,
  selection,
}: {
  /** The dynamic query to apply ordering to. */
  query: Q;
  /** The Drizzle table object. */
  mainTable: T;
  /** The ordering options. */
  orderBy: OrderByOption<T["$inferSelect"]> | undefined;
  /** Optional nested include tree of joined tables. */
  include?: IncludeOption<Table>[];
  /** The selection map from buildAttributeSelection. Used to resolve aggregate aliases for ORDER BY. */
  selection?: SelectedFields;
}): void {
  if (!orderBy) return;

  const mainColumns = getTableColumns(mainTable);
  const joinedTables = flattenInclude(include);
  const orderClauses: SQL[] = [];

  for (const [key, direction] of Object.entries(orderBy)) {
    if (!direction) continue;

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
        orderClauses.push(direction === "asc" ? asc(column) : desc(column));
      }
    } else {
      const col = mainColumns[key];
      if (col) {
        orderClauses.push(direction === "asc" ? asc(col) : desc(col));
      } else if (selection?.[key]) {
        const aggCol = selection[key] as SQLWrapper;
        orderClauses.push(direction === "asc" ? asc(aggCol) : desc(aggCol));
      }
    }
  }

  if (orderClauses.length > 0) {
    query.orderBy(...orderClauses);
  }
}
