import type { Table } from "drizzle-orm";

import { db, type Transaction } from "../../client";
import { applyFilters } from "./applyFilters";
import { applyGroupBy } from "./applyGroupBy";
import { applyHaving } from "./applyHaving";
import { applyIncludes } from "./applyIncludes";
import { applyOrdering } from "./applyOrdering";
import { applyPagination } from "./applyPagination";
import { buildAttributeSelection } from "./buildAttributeSelection";
import { buildCountSelection } from "./buildCountSelection";
import { type ColumnValue, executeQuery, type NestedRow } from "./executeQuery";
import type { GenericFindOptions, IncludeOption } from "./types";

/**
 * Base fields for {@link FindAllOptions}, extracted to preserve JSDoc on `table`.
 * @template T - The Drizzle table type.
 */
interface FindAllBase<T extends Table> {
  /** The main Drizzle table to query from. */
  table: T;
}

/**
 * Options for the generic findAll query builder.
 *
 * This is a discriminated union on the `count` field:
 * - When `count` is `true` (count mode), query-only options (`orderBy`,
 *   `limit`, `offset`, `attributes`) are forbidden.
 * - When `count` is `false` or omitted (regular mode), all options are available.
 *
 * @template T   - The Drizzle table type.
 * @template K   - The groupBy column keys.
 * @template A   - The aggregate alias literal type(s).
 * @template AK  - The attribute column keys.
 * @template JGK - The dot-notation join groupBy keys.
 * @template JAC - The dot-notation join aggregate column keys.
 * @template JOK - The dot-notation join orderBy keys.
 * @template JWF - Typed joined-column filters exposed on `where`. Defaults to `object` (no joined filters).
 */
type FindAllOptions<
  T extends Table,
  K extends string & keyof T["$inferSelect"] = string & keyof T["$inferSelect"],
  A extends string = string,
  AK extends string & keyof T["$inferSelect"] = string &
    keyof T["$inferSelect"],
  JGK extends string = string,
  JAC extends string = string,
  JOK extends string = string,
  JWF extends object = object,
> = FindAllBase<T> &
  GenericFindOptions<
    T["$inferSelect"],
    IncludeOption<Table>[],
    K,
    A,
    AK,
    JGK,
    JAC,
    JOK,
    JWF
  > & {
    /** Optional database transaction to run the query within. */
    tx?: Transaction;
  } & (
    | {
        /** Whether to run a count query. When true, selects COUNT(*) instead of regular columns. */
        count: true;
        /** Not applicable in count mode. */
        orderBy?: never;
        /** Not applicable in count mode. */
        limit?: never;
        /** Not applicable in count mode. */
        offset?: never;
        /** Not applicable in count mode. */
        attributes?: never;
      }
    | {
        /** Whether to run a count query. When true, selects COUNT(*) instead of regular columns. */
        count?: false;
      }
  );

/**
 * Executes a generic find query against the given table, applying the full
 * pipeline of select, join, filter, group, having, order, and pagination steps.
 * Each step is a no-op when its corresponding parameter is undefined.
 *
 * Type safety is derived from the generic `T` parameter, which constrains
 * where, orderBy, attributes, groupBy, and having to valid columns for the
 * given table. Entity-specific wrappers (e.g., findReviews) provide additional
 * return-type narrowing via overloads.
 *
 * @param options - The query configuration.
 * @returns The query results, restructured when includes are present.
 */
export async function findAll<
  T extends Table,
  K extends string & keyof T["$inferSelect"] = string & keyof T["$inferSelect"],
  A extends string = string,
  AK extends string & keyof T["$inferSelect"] = string &
    keyof T["$inferSelect"],
  JGK extends string = string,
  JAC extends string = string,
  JOK extends string = string,
  JWF extends object = object,
>({
  table,
  where,
  include,
  orderBy,
  groupBy,
  attributes,
  aggregates,
  having,
  limit,
  offset,
  count,
  tx,
}: FindAllOptions<T, K, A, AK, JGK, JAC, JOK, JWF>): Promise<
  NestedRow[] | Record<string, ColumnValue>[]
> {
  const selection = count
    ? buildCountSelection({
        mainTable: table,
        include,
        groupBy,
        aggregates,
      })
    : buildAttributeSelection({
        mainTable: table,
        attributes,
        aggregates,
        include,
      });

  const executor = tx ?? db;
  const query = executor
    .select(selection)
    .from(table as Table)
    .$dynamic();

  applyIncludes({ query, mainTable: table, include });
  applyGroupBy({
    query,
    mainTable: table,
    groupBy,
    include,
  });
  applyFilters(query, table, where, { include });
  applyHaving({ query, mainTable: table, having, selection });
  if (!count) {
    applyOrdering({ query, mainTable: table, orderBy, include, selection });
    applyPagination(query, { limit, offset });
  }

  return executeQuery({
    query: query as PromiseLike<Record<string, ColumnValue>[]>,
    mainTable: table,
    // In count mode without groupBy, skip restructuring (no prefixed columns to nest).
    include: count && !groupBy?.length ? undefined : include,
  });
}
