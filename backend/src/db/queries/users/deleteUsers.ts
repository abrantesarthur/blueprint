import { db } from "../../client";
import { type User, users } from "../../schema";
import { applyFilters } from "../utils";
import type { DeleteUserOptions } from "./types";

/**
 * Deletes users matching the provided filters.
 * @param options - The delete options.
 * @param options.where - The filters to identify the users to delete.
 * @param options.tx - Optional database transaction to run the query within.
 * @returns The deleted user records.
 */
export async function deleteUsers({
  where,
  tx,
}: DeleteUserOptions): Promise<User[]> {
  const executor = tx ?? db;
  const query = executor.delete(users).$dynamic();

  applyFilters(query, users, where, { strict: true });
  return query.returning();
}
