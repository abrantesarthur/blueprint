import { db, type Transaction } from "../../client";
import { type User, users } from "../../schema";
import type { UserWhere } from "./types";
import { buildRequiredUserWhere } from "./where";

/**
 * Deletes users matching the provided equality filters.
 * @param options - The delete options.
 * @param options.where - Equality filters identifying the users. At least one filter is required.
 * @param options.tx - Optional database transaction to run the delete within.
 * @returns The deleted user records.
 * @throws Error when no where filter is provided.
 */
export async function deleteUsers({
  where,
  tx,
}: {
  /** Equality filters identifying the users. At least one filter is required. */
  where: UserWhere;
  /** Optional database transaction to run the delete within. */
  tx?: Transaction;
}): Promise<User[]> {
  const condition = buildRequiredUserWhere({ where });
  const executor = tx ?? db;
  return executor.delete(users).where(condition).returning();
}
