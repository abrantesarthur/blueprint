import { getTableColumns } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import { DbError } from "../../../shared/utils/errors";
import { db } from "../../client";
import type { GenericCreateOptions } from "./types";

/**
 * Base fields for {@link CreateResourceOptions}, extracted to preserve JSDoc on `table`.
 * @template T - The Drizzle table type.
 */
interface CreateResourceBase<T extends PgTable> {
  /** The main Drizzle table to insert into. */
  table: T;
}

/**
 * Options for the generic createResources function.
 * Combines the target table with {@link GenericCreateOptions}.
 * @template T - The Drizzle table type.
 */
type CreateResourceOptions<T extends PgTable> = CreateResourceBase<T> &
  GenericCreateOptions<T>;

/**
 * Inserts one or more records into the given table, with optional upsert support.
 *
 * This is the centralized insert helper that all entity-specific `create*`
 * functions delegate to. It mirrors the role of {@link findAll} for queries.
 *
 * @param options - The creation configuration.
 * @returns The created (or upserted) records.
 */
export async function createResources<T extends PgTable>({
  table,
  data,
  onConflictDoUpdate: updateOption,
  onConflictDoNothing: noOpOption,
  tx,
}: CreateResourceOptions<T>): Promise<T["$inferSelect"][]> {
  if (updateOption && noOpOption) {
    throw new Error(
      "createResources: onConflictDoUpdate and onConflictDoNothing are mutually exclusive",
    );
  }
  try {
    const executor = tx ?? db;
    const normalized = Array.isArray(data) ? data : [data];
    const query = executor.insert(table).values(normalized);
    const conflictOption = updateOption ?? noOpOption;

    let result;

    if (conflictOption) {
      const columns = getTableColumns(table);
      const keys = Array.isArray(conflictOption.target)
        ? conflictOption.target
        : [conflictOption.target];

      const target = keys.map((k) => {
        const col = columns[k];
        if (!col) throw new Error(`Column "${k}" not found in table`);
        return col;
      });

      if (updateOption) {
        result = await query
          .onConflictDoUpdate({ target, set: updateOption.set })
          .returning();
      } else {
        result = await query.onConflictDoNothing({ target }).returning();
      }
    } else {
      result = await query.returning();
    }

    // onConflictDoNothing intentionally returns an empty array when every
    // input row conflicted — that's how callers detect "already there".
    if (result.length === 0 && !noOpOption) {
      throw new Error("Failed to create resource");
    }

    return result;
  } catch (error) {
    throw new DbError(error);
  }
}
