import { getEntries } from "@blueprint/type-utils";
import {
  and,
  type Column,
  eq,
  getTableColumns,
  getTableName,
  inArray,
  isNotNull,
  isNull,
  not,
  or,
  type SQL,
  Table,
} from "drizzle-orm";
import type { PgDelete, PgSelect, PgUpdate } from "drizzle-orm/pg-core";

import { flattenInclude } from "./flattenInclude";
import { filterOperators } from "./maps";
import {
  type ColumnFilters,
  type IncludeOption,
  isAndClause,
  isExplicitFilter,
  isNotClause,
  isOrClause,
  type WhereOption,
} from "./types";

/** Mapping of column names to Drizzle column definitions. */
type TableColumns = ReturnType<typeof getTableColumns>;

/** Joined table entry returned by {@link flattenInclude}. */
type JoinedTable = ReturnType<typeof flattenInclude>[number];

/**
 * Emits a single SQL condition for a resolved column from one filter entry.
 * Handles array-of-filters, single explicit filter, null (IS NULL), and
 * implicit equality — matching the same branches used by the main-table path.
 * Throws on malformed array entries (defense-in-depth against a bypassed type gate).
 * @param column - The resolved Drizzle column (main-table or joined).
 * @param filterValue - The filter value to translate into SQL.
 * @param conditions - Output accumulator pushed to.
 */
function emitCondition(
  column: Column,
  filterValue: unknown,
  conditions: SQL[],
): void {
  if (Array.isArray(filterValue)) {
    for (const entry of filterValue) {
      if (!isExplicitFilter(entry)) {
        throw new Error(
          "applyFilters: array filter entry is not a valid {operator, value} object.",
        );
      }
      const { operator, value } = entry;
      if (operator === "in") {
        conditions.push(inArray(column, value));
      } else if (operator === "eq" && value === null) {
        conditions.push(isNull(column));
      } else if (operator === "ne" && value === null) {
        conditions.push(isNotNull(column));
      } else {
        const fn = filterOperators[operator];
        conditions.push(fn(column, value));
      }
    }
    return;
  }

  if (isExplicitFilter(filterValue)) {
    const { operator, value } = filterValue;
    if (operator === "in") {
      conditions.push(inArray(column, value));
    } else if (operator === "eq" && value === null) {
      conditions.push(isNull(column));
    } else if (operator === "ne" && value === null) {
      conditions.push(isNotNull(column));
    } else {
      const fn = filterOperators[operator];
      conditions.push(fn(column, value));
    }
    return;
  }

  if (filterValue === null) {
    conditions.push(isNull(column));
    return;
  }

  conditions.push(eq(column, filterValue));
}

/**
 * Resolves a dot-notation key (e.g., `"payments.expiresAt"`) to a Drizzle
 * column using the flattened include tree as the allow-list. Throws on
 * unresolved tables or columns — dropping a WHERE clause silently would
 * change query semantics (e.g., return all rows instead of a filtered
 * subset), so the runtime check is defense-in-depth against bypassing the
 * type gate.
 * @param key - The dot-notation key.
 * @param joinedTables - Flattened include tree used as the allow-list.
 * @returns The resolved Drizzle column.
 */
function resolveJoinedColumn(key: string, joinedTables: JoinedTable[]): Column {
  const [tableName, columnName] = key.split(".");
  const joinedTable = joinedTables.find(
    (t) => getTableName(t.alias ?? t.table) === tableName,
  );
  if (!joinedTable) {
    throw new Error(
      `applyFilters: where references table "${tableName}" which is not in the include tree.`,
    );
  }
  const effectiveTable = joinedTable.alias ?? joinedTable.table;
  const column = getTableColumns(effectiveTable)[columnName!];
  if (!column) {
    throw new Error(
      `applyFilters: where references unknown column "${columnName}" on table "${tableName}".`,
    );
  }
  return column;
}

/**
 * Builds SQL conditions from column filters. Main-table keys resolve against
 * `columns`; dot-notation keys (e.g., `"users.firstName"`) resolve against
 * the flattened include tree.
 * @param filters - The column filters to process.
 * @param columns - The main-table columns mapping.
 * @param joinedTables - Flattened include tree (empty when not provided).
 * @returns Array of SQL conditions.
 */
function buildColumnConditions<Entity>(
  filters: ColumnFilters<Entity>,
  columns: TableColumns,
  joinedTables: JoinedTable[],
): SQL[] {
  const conditions: SQL[] = [];

  for (const [rawKey, filterValue] of getEntries(filters)) {
    if (filterValue === undefined) continue;

    const key = String(rawKey);

    if (key.includes(".")) {
      const column = resolveJoinedColumn(key, joinedTables);
      emitCondition(column, filterValue, conditions);
      continue;
    }

    if (!(key in columns)) continue;

    const column = columns[key]!;
    emitCondition(column, filterValue, conditions);
  }

  return conditions;
}

/**
 * Recursively builds a SQL condition from a where clause.
 * @param clause - The where clause (column filters, AND, OR, or NOT).
 * @param columns - The main-table columns mapping.
 * @param joinedTables - Flattened include tree (empty when not provided).
 * @returns The combined SQL condition, or undefined if no conditions.
 */
function buildCondition<Entity>(
  clause: WhereOption<Entity>,
  columns: TableColumns,
  joinedTables: JoinedTable[],
): SQL | undefined {
  if (isAndClause(clause)) {
    const conditions = clause.and
      .map((c) => buildCondition(c, columns, joinedTables))
      .filter((c): c is SQL => c !== undefined);
    return conditions.length > 0 ? and(...conditions) : undefined;
  }

  if (isOrClause(clause)) {
    const conditions = clause.or
      .map((c) => buildCondition(c, columns, joinedTables))
      .filter((c): c is SQL => c !== undefined);
    return conditions.length > 0 ? or(...conditions) : undefined;
  }

  if (isNotClause(clause)) {
    const condition = buildCondition(clause.not, columns, joinedTables);
    return condition ? not(condition) : undefined;
  }

  const conditions = buildColumnConditions(
    clause as ColumnFilters<Entity>,
    columns,
    joinedTables,
  );
  return conditions.length > 0 ? and(...conditions) : undefined;
}

/** Options for the applyFilters utility. */
interface ApplyFiltersOptions {
  /**
   * When true, throws if filters resolve to no conditions.
   * Use for destructive queries (DELETE/UPDATE) to prevent unfiltered execution.
   */
  strict?: boolean;
  /**
   * The nested include tree of joined tables. Required when the `where`
   * clause contains dot-notation keys (e.g., `"payments.expiresAt"`) — they
   * resolve against this tree. Unlike `applyOrdering` / `applyGroupBy` which
   * silently skip unresolved keys, `applyFilters` throws to avoid turning a
   * typo into a silent "filter dropped, returns all rows" bug.
   */
  include?: IncludeOption<Table>[];
}

/**
 * Applies filter conditions to a query.
 * Supports nested AND/OR/NOT logical operators and dot-notation keys for
 * joined-table columns when `options.include` is provided.
 * @param query - The dynamic query to modify.
 * @param table - The table to filter on.
 * @param where - The where clause with filters.
 * @param options - Optional configuration for filter application.
 */
export function applyFilters<
  Q extends PgSelect | PgUpdate | PgDelete,
  T extends Table,
>(
  query: Q,
  table: T,
  where: WhereOption<T["$inferSelect"]> | undefined,
  options?: ApplyFiltersOptions,
): void {
  if (!where) {
    if (options?.strict) {
      throw new Error(
        "Strict mode: filters are required but none were provided.",
      );
    }
    return;
  }

  const columns = getTableColumns(table);
  const joinedTables = flattenInclude(options?.include);
  const condition = buildCondition(where, columns, joinedTables);

  if (condition) {
    query.where(condition);
  } else if (options?.strict) {
    throw new Error(
      "Strict mode: provided filters resolved to an empty condition.",
    );
  }
}
