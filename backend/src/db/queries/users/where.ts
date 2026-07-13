import { and, eq, isNull, type SQL } from "drizzle-orm";

import { users } from "../../schema";
import type { UserWhere } from "./types";

/**
 * Builds a Drizzle condition from a declarative user filter.
 * @param options - The builder options.
 * @param options.where - The equality filters to translate.
 * @returns The combined AND condition, or undefined when no filters are set.
 */
export function buildUserWhere({
  where,
}: {
  /** The equality filters to translate. */
  where: UserWhere;
}): SQL | undefined {
  const conditions: SQL[] = [];

  if (where.id !== undefined) {
    conditions.push(eq(users.id, where.id));
  }
  if (where.email !== undefined) {
    conditions.push(
      where.email === null ? isNull(users.email) : eq(users.email, where.email),
    );
  }
  if (where.firstName !== undefined) {
    conditions.push(eq(users.firstName, where.firstName));
  }
  if (where.lastName !== undefined) {
    conditions.push(eq(users.lastName, where.lastName));
  }

  return and(...conditions);
}

/**
 * Builds a Drizzle condition from a declarative user filter, requiring at
 * least one filter to be set. Guards mutating queries (update/delete) from
 * accidentally targeting every row in the table.
 * @param options - The builder options.
 * @param options.where - The equality filters to translate.
 * @returns The combined AND condition.
 * @throws Error when no filter field is set.
 */
export function buildRequiredUserWhere({
  where,
}: {
  /** The equality filters to translate. */
  where: UserWhere;
}): SQL {
  const condition = buildUserWhere({ where });
  if (!condition) {
    throw new Error("At least one where filter must be provided");
  }
  return condition;
}
