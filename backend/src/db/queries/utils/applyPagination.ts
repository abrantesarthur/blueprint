import type { PgSelect } from "drizzle-orm/pg-core";

import type { PaginationInput } from "../../../shared/types";

/**
 * Applies pagination (limit and offset) to a dynamic query.
 * @param query - The dynamic query to modify.
 * @param options - The pagination options.
 */
export function applyPagination<T extends PgSelect>(
  query: T,
  { limit, offset }: PaginationInput,
): void {
  if (limit !== undefined) {
    query.limit(limit);
  }
  if (offset !== undefined) {
    query.offset(offset);
  }
}
