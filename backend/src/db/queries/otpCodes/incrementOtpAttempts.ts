import { sql } from "drizzle-orm";

import { DbError } from "../../../shared/utils/errors";
import { db, type Transaction } from "../../client";
import { type OtpCode, otpCodes } from "../../schema";
import { applyFilters } from "../utils";

/**
 * Atomically increments OTP attempts if under the max limit.
 * Uses a SQL expression internally for atomic increment — this keeps
 * raw SQL confined to the db/queries layer.
 * @param options - The increment options.
 * @param options.otpId - The ID of the OTP record.
 * @param options.maxAttempts - The maximum allowed attempts.
 * @param options.tx - Optional database transaction.
 * @returns The updated OTP code records (empty if max attempts exceeded or not found).
 */
export async function incrementOtpAttempts({
  otpId,
  maxAttempts,
  tx,
}: {
  /** The ID of the OTP record. */
  otpId: string;
  /** The maximum allowed attempts. */
  maxAttempts: number;
  /** Optional database transaction. */
  tx?: Transaction;
}): Promise<OtpCode[]> {
  try {
    const executor = tx ?? db;
    const query = executor
      .update(otpCodes)
      .set({
        attempts: sql`${otpCodes.attempts} + 1`,
        updatedAt: new Date(),
      })
      .$dynamic();

    applyFilters(
      query,
      otpCodes,
      {
        id: otpId,
        attempts: { value: maxAttempts, operator: "lt" },
      },
      { strict: true },
    );

    return await query.returning();
  } catch (error) {
    throw new DbError(error);
  }
}
