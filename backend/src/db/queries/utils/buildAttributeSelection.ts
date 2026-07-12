import { getTableColumns, getTableName, type Table } from "drizzle-orm";
import type { SelectedFields } from "drizzle-orm/pg-core";

import { flattenInclude } from "./flattenInclude";
import { resolveAggregates } from "./resolveAggregates";
import type { AggregateAttribute, IncludeOption } from "./types";

/**
 * Builds the column selection for a regular (non-count) query.
 *
 * Resolves main-table columns, joined-table columns (via `include`), and
 * aggregate expressions into a flat `SelectedFields` map suitable for
 * `db.select()`.
 *
 * @param options - The build options.
 * @param options.mainTable - The primary Drizzle table. Aggregate columns are resolved from this table.
 * @param options.attributes - Columns and aggregates to select from the parent table.
 * @param options.aggregates - Aggregate expressions to include in the select.
 * @param options.include - Nested include tree of joined tables.
 * @returns A SelectedFields object to pass to `db.select()`.
 */
export function buildAttributeSelection({
  mainTable,
  attributes,
  aggregates,
  include,
}: {
  /** The primary Drizzle table. Aggregate columns are resolved from this table. */
  mainTable: Table;
  /** Plain column keys to select. When undefined, all columns are selected. When empty array, no entity columns. */
  attributes?: string[];
  /** Aggregate expressions to include in the select. */
  aggregates?: AggregateAttribute<Record<string, unknown>, string>[];
  /** Nested include tree of joined tables. */
  include?: IncludeOption<Table>[];
}): SelectedFields {
  const flattenedJoined = flattenInclude(include);
  const hasJoinedTables = flattenedJoined.length > 0;

  const allTables: { table: Table; attributes?: string[]; alias?: Table }[] = [
    { table: mainTable, attributes },
    ...flattenedJoined,
  ];

  const selection: SelectedFields = {};

  for (const { table, attributes: attrs, alias } of allTables) {
    const effectiveTable = alias ?? table;
    const name = getTableName(effectiveTable);
    const allColumns = getTableColumns(effectiveTable);
    const entries =
      attrs !== undefined
        ? Object.entries(allColumns).filter(([colName]) =>
            attrs.includes(colName),
          )
        : Object.entries(allColumns);

    for (const [colName, col] of entries) {
      selection[hasJoinedTables ? `${name}.${colName}` : colName] = col;
    }
  }

  // Add aggregates (unprefixed — they have unique aliases)
  if (aggregates) {
    resolveAggregates({ selection, mainTable, flattenedJoined, aggregates });
  }

  return selection;
}
