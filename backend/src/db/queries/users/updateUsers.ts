import { DbError } from "../../../shared/utils/errors";
import { db } from "../../client";
import { type User, users } from "../../schema";
import { applyFilters } from "../utils";
import type { UpdateUserOptions } from "./types";

/**
 * Updates users matching the provided filters.
 * @param options - The update options.
 * @param options.where - The filters to identify the users.
 * @param options.values - The values to update.
 * @param options.tx - Optional database transaction to run the update within.
 * @returns The updated user records.
 */
export async function updateUsers({
  where,
  values,
  tx,
}: UpdateUserOptions): Promise<User[]> {
  try {
    const executor = tx ?? db;
    const query = executor
      .update(users)
      .set({ ...values, updatedAt: new Date() })
      .$dynamic();

    applyFilters(query, users, where, { strict: true });
    return await query.returning();
  } catch (error) {
    throw new DbError(error);
  }
}
