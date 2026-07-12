import { count, getTableColumns, getTableName, type Table } from "drizzle-orm";
import type { SelectedFields } from "drizzle-orm/pg-core";

import { aggregateFns } from "./maps";
import type { AggregateAttribute } from "./types";

/**
 * Resolves aggregate expressions and adds them to the given selection object.
 *
 * Handles three column formats:
 * - `"*"` — COUNT(*) with the given alias.
 * - Dot-notation (e.g. `"reviews.rating"`) — resolves from a joined table.
 * - Plain column name — resolves from the main table.
 *
 * @param options - The resolution options.
 * @param options.selection - The SelectedFields object to mutate.
 * @param options.mainTable - The primary Drizzle table for plain column lookups.
 * @param options.flattenedJoined - Pre-flattened joined table descriptors.
 * @param options.aggregates - The aggregate expressions to resolve.
 */
export function resolveAggregates({
  selection,
  mainTable,
  flattenedJoined,
  aggregates,
}: {
  /** The SelectedFields object to mutate in place. */
  selection: SelectedFields;
  /** The primary Drizzle table for plain column lookups. */
  mainTable: Table;
  /** Pre-flattened joined table descriptors. */
  flattenedJoined: { table: Table; alias?: Table }[];
  /** The aggregate expressions to resolve. */
  aggregates: AggregateAttribute<Record<string, unknown>, string>[];
}): void {
  const mainColumns = getTableColumns(mainTable);

  for (const attr of aggregates) {
    if (attr.column === "*") {
      selection[attr.as] = count().as(attr.as);
    } else if (attr.column.includes(".")) {
      const [tableName, columnName] = attr.column.split(".");
      const joined = flattenedJoined.find(
        (t) => getTableName(t.alias ?? t.table) === tableName,
      );
      if (!tableName || !columnName || !joined) continue;
      const effectiveTable = joined.alias ?? joined.table;
      const col = getTableColumns(effectiveTable)[columnName];
      if (col) {
        selection[attr.as] = aggregateFns[attr.fn](col).as(attr.as);
      }
    } else {
      const col = mainColumns[attr.column];
      if (col) {
        selection[attr.as] = aggregateFns[attr.fn](col).as(attr.as);
      }
    }
  }
}
