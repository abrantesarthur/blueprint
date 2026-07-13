import { NotFoundError } from "../../../shared/utils/errors";
import type { Transaction } from "../../client";
import type { User } from "../../schema";
import { findUsers } from "./findUsers";
import type { UserWhere } from "./types";

/**
 * Finds a single user matching the provided equality filters.
 * @param options - The query options.
 * @param options.where - Equality filters combined with AND.
 * @param options.tx - Optional database transaction to run the query within.
 * @returns The matching user record.
 * @throws NotFoundError when no user matches the filters.
 */
export async function findUser({
  where,
  tx,
}: {
  /** Equality filters combined with AND. */
  where: UserWhere;
  /** Optional database transaction to run the query within. */
  tx?: Transaction;
}): Promise<User> {
  const [user] = await findUsers({ where, limit: 1, tx });

  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
}
