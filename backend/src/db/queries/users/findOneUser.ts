import { NotFoundError } from "../../../shared/utils/errors";
import type { User } from "../../schema";
import { findUsers } from "./findUsers";
import type { FindOneUserOptions, UsersInclude } from "./types";

/**
 * Finds a user matching the provided filters.
 * @param options - The filter options.
 * @returns The user if found, null otherwise.
 */
export async function findOneUser<T extends UsersInclude>(
  options: FindOneUserOptions<T> & { require: false },
): Promise<User | null>;

/**
 * Finds a user matching the provided filters.
 * @param options - The filter options.
 * @returns The user if found.
 * @throws NotFoundError if no user matches.
 */
export async function findOneUser<T extends UsersInclude>(
  options: FindOneUserOptions<T> & { require?: true },
): Promise<User>;

/**
 * Finds a user matching the provided filters.
 * @param options - The filter options.
 * @returns The user if found (or throws by default if not found).
 */
export async function findOneUser<T extends UsersInclude>({
  attributes,
  where,
  include,
  orderBy,
  require = true,
  tx,
}: FindOneUserOptions<T> & {
  require?: boolean;
}): Promise<User | null> {
  const [user] = await findUsers({
    attributes,
    where,
    include,
    orderBy,
    limit: 1,
    offset: 0,
    tx,
  } as FindOneUserOptions<T>);

  if (!user && require) {
    throw new NotFoundError("User not found");
  }

  return user ?? null;
}
