import type { RequiredField } from "@blueprint/type-utils";

import { type User, users } from "../../schema";
import { findAll } from "../utils";
import type { WithAggregate } from "../utils/types";
import type { FindUsersOptions, UsersInclude } from "./types";

/**
 * Overload 1: aggregates required, all entity columns.
 *
 * @param options
 * @example
 * const results = await findUsers({
 *   aggregates: [{ fn: "count", column: "*", as: "total" }],
 *   groupBy: ["city"],
 * });
 *
 * // results[0].total → number
 * // results[0].city  → string (all columns present)
 *
 * @returns An array of objects containing all user columns and aggregate values.
 */
export async function findUsers<K extends keyof User, const A extends string>(
  options: Omit<
    RequiredField<FindUsersOptions<UsersInclude, K, A>, "aggregates">,
    "attributes"
  >,
): Promise<WithAggregate<User, A>[]>;

/**
 * Overload 2: attributes required (optional aggregates).
 *
 * @param options
 * @example
 * const results = await findUsers({
 *   attributes: ["firstName", "city"],
 *   aggregates: [{ fn: "count", column: "*", as: "total" }],
 *   groupBy: ["firstName", "city"],
 * });
 *
 * // results[0].firstName → string
 * // results[0].city      → string
 * // results[0].total     → number
 *
 * @returns An array of objects containing the selected user columns
 * and aggregate values (if any). No joined tables are present.
 */
export async function findUsers<
  K extends keyof User,
  const A extends string,
  AK extends keyof User,
>(
  options: RequiredField<
    FindUsersOptions<UsersInclude, K, A, AK>,
    "attributes"
  >,
): Promise<WithAggregate<Pick<User, AK>, A>[]>;

/**
 * Overload 3: without aggregates or attribute selection (general case).
 *
 * Find users without aggregates or explicit attribute selection.
 * This is the most basic overload — a simple query returning all user columns.
 *
 * @param options
 * @example
 * const results = await findUsers({
 *   where: { role: "student" },
 *   orderBy: { firstName: "asc" },
 *   limit: 10,
 * });
 *
 * // results[0].id        → string
 * // results[0].firstName → string
 * // results[0].email     → string (all columns present)
 *
 * @returns An array of plain User objects with all columns.
 */
export async function findUsers<T extends UsersInclude>(
  options: Omit<FindUsersOptions<T>, "having" | "aggregates">,
): Promise<User[]>;

/**
 * Finds users matching the provided filters.
 * @param options - The filter options.
 * @returns List of users matching the filters.
 */
export async function findUsers<T extends UsersInclude, K extends keyof User>({
  where,
  limit,
  offset,
  orderBy,
  groupBy,
  attributes,
  aggregates,
  having,
  tx,
}: FindUsersOptions<T, K>): Promise<
  (Pick<User, K> & Record<string, number>)[] | Pick<User, K>[] | User[]
> {
  return findAll({
    table: users,
    where,
    limit,
    offset,
    orderBy,
    groupBy,
    attributes,
    aggregates,
    having,
    tx,
  }) as never;
}
