import { DbError } from "../../../shared/utils/errors";
import { db } from "../../client";
import { type OtpCode, otpCodes } from "../../schema";
import { applyFilters } from "../utils";
import type { UpdateOtpCodeOptions } from "./types";

/**
 * Updates OTP codes matching the provided filters.
 * @param options - The update options.
 * @param options.where - The filters to identify the OTP codes.
 * @param options.values - The values to update.
 * @param options.tx - Optional database transaction to run the update within.
 * @returns The updated OTP code records.
 */
export async function updateOtpCodes({
  where,
  values,
  tx,
}: UpdateOtpCodeOptions): Promise<OtpCode[]> {
  try {
    const executor = tx ?? db;
    const query = executor
      .update(otpCodes)
      .set({ ...values, updatedAt: new Date() })
      .$dynamic();

    applyFilters(query, otpCodes, where, { strict: true });
    return await query.returning();
  } catch (error) {
    throw new DbError(error);
  }
}
