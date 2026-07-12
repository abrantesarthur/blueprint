import type { Table } from "drizzle-orm";

import { findAll } from "./findAll";
import type { GenericCountOptions, IncludeOption } from "./types";

/**
 * Base fields for {@link CountResourceOptions}, extracted to preserve JSDoc on `table`.
 * @template T - The Drizzle table type.
 */
interface CountResourceBase<T extends Table> {
  /** The main Drizzle table to count from. */
  table: T;
}

/**
 * Options for the generic countResources function.
 * Combines the target table with {@link GenericCountOptions}.
 * @template T - The Drizzle table type.
 * @template JWF - Typed joined-column filters exposed on `where`. Defaults to
 *   `object` (no joined filters); per-entity wrappers supply their own
 *   include-aware filter shape (e.g. `IncludeJoinWhereFilters<Inc>`).
 *   Inferrable from the `where` argument so direct callers can use
 *   dot-notation without casting.
 */
type CountResourceOptions<
  T extends Table,
  JWF extends object = object,
> = CountResourceBase<T> &
  GenericCountOptions<
    T["$inferSelect"],
    readonly IncludeOption<Table>[],
    string & keyof T["$inferSelect"],
    string,
    string,
    string,
    // Matches the original inferred default — `readonly string[]` keeps
    // dot-notation groupBy keys (e.g., `"users.id"`) assignable; narrowing
    // to `string & keyof Entity` would reject them.
    readonly string[],
    JWF
  >;

/**
 * Counts rows in the given table, with optional filtering, grouping, joins,
 * aggregates, and HAVING support. This is the centralized count helper that
 * all entity-specific `count*` functions delegate to. It mirrors the role of
 * {@link createResources} for inserts.
 *
 * @param options - The count configuration.
 * @returns The total count as a number (when ungrouped) or an array of grouped result objects.
 */
export async function countResources<
  T extends Table,
  JWF extends object = object,
>({
  table,
  where,
  include,
  groupBy,
  having,
  aggregates,
  tx,
}: CountResourceOptions<T, JWF>): Promise<Record<string, unknown>[] | number> {
  const results = await findAll({
    table,
    where,
    // findAll's FindAllOptions hardcodes Include as mutable IncludeOption<Table>[],
    // but we accept readonly to avoid forcing casts at every call site.
    include: include as IncludeOption<Table>[] | undefined,
    groupBy,
    having,
    aggregates,
    count: true,
    tx,
  });

  if (!groupBy || groupBy.length === 0) {
    const first = results[0];
    return Number(first?.["count"]) || 0;
  }

  return results;
}
