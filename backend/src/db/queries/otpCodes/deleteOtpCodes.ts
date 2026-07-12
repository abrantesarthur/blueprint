import { db } from "../../client";
import { type OtpCode, otpCodes } from "../../schema";
import { applyFilters } from "../utils";
import type { DeleteOtpCodeOptions } from "./types";

/**
 * Deletes OTP codes matching the provided filters.
 * @param options - The delete options.
 * @param options.where - The filters to identify the OTP codes to delete.
 * @param options.tx - Optional database transaction to run the query within.
 * @returns The deleted OTP code records.
 */
export async function deleteOtpCodes({
  where,
  tx,
}: DeleteOtpCodeOptions): Promise<OtpCode[]> {
  const executor = tx ?? db;
  const query = executor.delete(otpCodes).$dynamic();

  applyFilters(query, otpCodes, where, { strict: true });
  return query.returning();
}
