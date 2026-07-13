import { db, type Transaction } from "../../client";

/**
 * Executes a callback inside a database transaction.
 * Wraps `db.transaction` to centralise the transaction entry point.
 * @param callback - An async function that receives the transaction handle.
 * @returns The value returned by the callback.
 */
export async function withTransaction<T>(
  callback: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return await db.transaction(callback);
}
