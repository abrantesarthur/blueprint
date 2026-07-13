import { DbError } from "../../../shared/utils/errors";
import { db, type Transaction } from "../../client";
import { type NewUser, type User, users } from "../../schema";

/**
 * Creates one or more user records in the database.
 * @param options - The creation options.
 * @param options.data - The user records to insert.
 * @param options.tx - Optional database transaction to run the insert within.
 * @returns The created user records.
 * @throws DbError when the insert fails (e.g., unique constraint violation).
 */
export async function createUsers({
  data,
  tx,
}: {
  /** The user records to insert. */
  data: NewUser[];
  /** Optional database transaction to run the insert within. */
  tx?: Transaction;
}): Promise<User[]> {
  try {
    const executor = tx ?? db;
    return await executor.insert(users).values(data).returning();
  } catch (error) {
    throw new DbError(error);
  }
}
