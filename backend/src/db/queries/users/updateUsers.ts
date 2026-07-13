import { DbError } from "../../../shared/utils/errors";
import { db, type Transaction } from "../../client";
import { type User, users } from "../../schema";
import type { UserUpdateValues, UserWhere } from "./types";
import { buildRequiredUserWhere } from "./where";

/**
 * Updates users matching the provided equality filters.
 * @param options - The update options.
 * @param options.where - Equality filters identifying the users. At least one filter is required.
 * @param options.values - The column values to update.
 * @param options.tx - Optional database transaction to run the update within.
 * @returns The updated user records.
 * @throws Error when no where filter is provided.
 * @throws DbError when the update fails (e.g., unique constraint violation).
 */
export async function updateUsers({
  where,
  values,
  tx,
}: {
  /** Equality filters identifying the users. At least one filter is required. */
  where: UserWhere;
  /** The column values to update. */
  values: UserUpdateValues;
  /** Optional database transaction to run the update within. */
  tx?: Transaction;
}): Promise<User[]> {
  const condition = buildRequiredUserWhere({ where });

  try {
    const executor = tx ?? db;
    return await executor
      .update(users)
      .set({ ...values, updatedAt: new Date() })
      .where(condition)
      .returning();
  } catch (error) {
    throw new DbError(error);
  }
}
