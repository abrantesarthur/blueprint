import { type OtpCode, otpCodes } from "../../schema";
import { createResources } from "../utils";
import type { CreateOtpCodeOptions } from "./types";

/**
 * Creates a single OTP code record in the database.
 * Supports upsert behavior via `onConflictDoUpdate`.
 * @param options - The creation options.
 * @returns The created or upserted OTP code record.
 */
export async function createOtpCode(
  options: CreateOtpCodeOptions,
): Promise<OtpCode> {
  const [created] = await createResources({ table: otpCodes, ...options });
  return created!;
}
