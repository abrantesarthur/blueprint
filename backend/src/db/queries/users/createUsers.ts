import { type User, users } from "../../schema";
import { createResources } from "../utils";
import type { CreateUsersOptions } from "./types";

/**
 * Creates one or more user records in the database.
 * @param options - The creation options.
 * @param options.data - The user data to insert.
 * @param options.onConflictDoUpdate - Optional upsert behavior when a conflict is detected.
 * @param options.tx - Optional database transaction to run the insert within.
 * @returns The created user records.
 */
export async function createUsers(
  options: CreateUsersOptions,
): Promise<User[]> {
  return createResources({ table: users, ...options });
}
