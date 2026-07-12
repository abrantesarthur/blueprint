import type { RequiredField } from "@blueprint/type-utils";

import { type OtpCode, otpCodes } from "../../schema";
import { findAll } from "../utils";
import type { WithAggregate } from "../utils/types";
import type { FindOtpCodesOptions, OtpCodesInclude } from "./types";

/**
 * Overload 1: aggregates required, all entity columns.
 *
 * @param options
 * @example
 * const results = await findOtpCodes({
 *   aggregates: [{ fn: "count", column: "*", as: "total" }],
 *   groupBy: ["phone"],
 * });
 *
 * // results[0].total → number
 * // results[0].phone → string (all columns present)
 *
 * @returns An array of objects containing all OTP code columns and aggregate values.
 */
export async function findOtpCodes<
  K extends keyof OtpCode,
  const A extends string,
>(
  options: Omit<
    RequiredField<FindOtpCodesOptions<OtpCodesInclude, K, A>, "aggregates">,
    "attributes"
  >,
): Promise<WithAggregate<OtpCode, A>[]>;

/**
 * Overload 2: attributes required (optional aggregates).
 *
 * @param options
 * @example
 * const results = await findOtpCodes({
 *   attributes: ["phone", "attempts"],
 *   aggregates: [{ fn: "count", column: "*", as: "total" }],
 *   groupBy: ["phone", "attempts"],
 * });
 *
 * // results[0].phone    → string
 * // results[0].attempts → number
 * // results[0].total    → number
 *
 * @returns An array of objects containing the selected OTP code columns
 * and aggregate values (if any). No joined tables are present.
 */
export async function findOtpCodes<
  K extends keyof OtpCode,
  const A extends string,
  AK extends keyof OtpCode,
>(
  options: RequiredField<
    FindOtpCodesOptions<OtpCodesInclude, K, A, AK>,
    "attributes"
  >,
): Promise<WithAggregate<Pick<OtpCode, AK>, A>[]>;

/**
 * Overload 3: without aggregates or attribute selection (general case).
 *
 * Find OTP codes without aggregates or explicit attribute selection.
 * This is the most basic overload — a simple query returning all OTP code columns.
 *
 * @param options
 * @example
 * const results = await findOtpCodes({
 *   where: { phone: "+5511999999999" },
 *   orderBy: { createdAt: "desc" },
 *   limit: 5,
 * });
 *
 * // results[0].id       → string
 * // results[0].phone    → string
 * // results[0].attempts → number (all columns present)
 *
 * @returns An array of plain OtpCode objects with all columns.
 */
export async function findOtpCodes<T extends OtpCodesInclude>(
  options: Omit<FindOtpCodesOptions<T>, "having" | "aggregates">,
): Promise<OtpCode[]>;

/**
 * Finds OTP codes matching the provided filters.
 * @param options - The filter options.
 * @returns List of OTP codes matching the filters.
 */
export async function findOtpCodes<
  T extends OtpCodesInclude,
  K extends keyof OtpCode,
>({
  where,
  limit,
  offset,
  orderBy,
  groupBy,
  attributes,
  aggregates,
  having,
  tx,
}: FindOtpCodesOptions<T, K>): Promise<
  (Pick<OtpCode, K> & Record<string, number>)[] | Pick<OtpCode, K>[] | OtpCode[]
> {
  return findAll({
    table: otpCodes,
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
