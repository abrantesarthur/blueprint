import { asc, desc } from "drizzle-orm";

import { db, type Transaction } from "../../client";
import { type User, users } from "../../schema";
import type { UserOrderBy, UserWhere } from "./types";
import { buildUserWhere } from "./where";

/**
 * Finds users matching the provided equality filters.
 * @param options - The query options.
 * @param options.where - Equality filters combined with AND. When omitted, all users match.
 * @param options.orderBy - Column and direction to sort the results by.
 * @param options.limit - Maximum number of rows to return.
 * @param options.offset - Number of rows to skip.
 * @param options.tx - Optional database transaction to run the query within.
 * @returns The matching user records.
 */
export async function findUsers({
  where,
  orderBy,
  limit,
  offset,
  tx,
}: {
  /** Equality filters combined with AND. When omitted, all users match. */
  where?: UserWhere;
  /** Column and direction to sort the results by. */
  orderBy?: UserOrderBy;
  /** Maximum number of rows to return. */
  limit?: number;
  /** Number of rows to skip. */
  offset?: number;
  /** Optional database transaction to run the query within. */
  tx?: Transaction;
} = {}): Promise<User[]> {
  const executor = tx ?? db;
  let query = executor.select().from(users).$dynamic();

  const condition = where ? buildUserWhere({ where }) : undefined;
  if (condition) {
    query = query.where(condition);
  }
  if (orderBy) {
    const column = users[orderBy.column];
    query = query.orderBy(
      orderBy.direction === "desc" ? desc(column) : asc(column),
    );
  }
  if (limit !== undefined) {
    query = query.limit(limit);
  }
  if (offset !== undefined) {
    query = query.offset(offset);
  }

  return query;
}
