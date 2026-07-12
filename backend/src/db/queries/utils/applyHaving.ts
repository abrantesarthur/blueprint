import { getEntries } from "@blueprint/type-utils";
import {
  and,
  getTableColumns,
  inArray,
  SQL,
  type SQLWrapper,
  type Table,
} from "drizzle-orm";
import type { PgSelect, SelectedFields } from "drizzle-orm/pg-core";

import { filterOperators } from "./maps";
import { isExplicitFilter } from "./types";

/**
 * Unwraps a SQL.Aliased to its underlying SQL expression, or returns the value as-is.
 * PostgreSQL does not allow referencing column aliases in HAVING, so we must
 * use the raw aggregate expression (e.g., `count(*)` instead of `"total"`).
 * @param value - The selection field value (may be SQL.Aliased, Column, or SQL).
 * @returns The unwrapped SQLWrapper suitable for use in filter operators.
 */
function unwrapAliased(value: SelectedFields[string]): SQLWrapper {
  if (value instanceof SQL.Aliased) {
    return value.sql;
  }
  return value as SQLWrapper;
}

/**
 * Applies HAVING conditions to a grouped query.
 *
 * Resolves keys against:
 * 1. The selection object (for aggregate aliases like "total")
 * 2. The main table columns (for grouped entity columns like "id")
 *
 * Type safety is enforced at the call site via HavingOption, not inside this
 * function (consistent with buildAttributeSelection).
 * Invalid keys are silently skipped (consistent with applyGroupBy).
 *
 * @param options - The having options.
 * @param options.query - The dynamic query to apply having to.
 * @param options.mainTable - The main Drizzle table object.
 * @param options.having - The having filters.
 * @param options.selection - The SelectedFields containing aggregate references.
 */
export function applyHaving<
  Q extends PgSelect,
  T extends Table,
  H extends Record<string, unknown>,
>({
  query,
  mainTable,
  having,
  selection,
}: {
  /** The dynamic query to apply having to. */
  query: Q;
  /** The main Drizzle table object. */
  mainTable: T;
  /** The having filters. */
  having: H | undefined;
  /** The SelectedFields containing aggregate references. */
  selection: SelectedFields | undefined;
}): void {
  if (!having) return;

  const mainColumns = getTableColumns(mainTable);
  const conditions: SQL[] = [];

  for (const [key, filter] of getEntries(having)) {
    if (!filter || !isExplicitFilter(filter)) continue;

    const { operator, value } = filter;

    if (operator === "in") {
      const selectionCol = selection?.[key];
      if (selectionCol) {
        conditions.push(
          inArray(unwrapAliased(selectionCol), value as unknown[]),
        );
        continue;
      }

      const tableCol = mainColumns[key];
      if (tableCol) {
        conditions.push(inArray(tableCol, value as unknown[]));
      }
    } else {
      const op = filterOperators[operator];

      // Try selection first (aggregate aliases like "total")
      const selectionCol = selection?.[key];
      if (selectionCol) {
        conditions.push(op(unwrapAliased(selectionCol), value));
        continue;
      }

      // Fall back to main table columns (grouped entity columns)
      const tableCol = mainColumns[key];
      if (tableCol) {
        conditions.push(op(tableCol, value));
      }
    }
  }

  if (conditions.length > 0) {
    query.having(and(...conditions)!);
  }
}
