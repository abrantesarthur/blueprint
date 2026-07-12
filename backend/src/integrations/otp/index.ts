import { AuthErrorMessage } from "@blueprint/error-utils";

import { env } from "../../config";

/**
 * Delivers a one-time verification code to the given phone number.
 *
 * This is a stub integration: outside production it logs the code to the
 * console so developers can complete the OTP flow without a real provider.
 * In production it throws until a real delivery channel (email, SMS, ...)
 * is plugged in.
 *
 * @param options - The delivery inputs.
 * @returns Resolves once the code has been "delivered" (logged).
 * @throws Error in production, where no OTP delivery provider is configured.
 */
export async function sendOtp({
  phone,
  code,
}: {
  /** The destination phone number in E.164 format. */
  phone: string;
  /** The plaintext 6-digit verification code to deliver. */
  code: string;
}): Promise<void> {
  if (env.RUNTIME_ENVIRONMENT === "production") {
    throw new Error(AuthErrorMessage.OTP_DELIVERY_NOT_CONFIGURED);
  }

  console.log(`[OTP stub] Verification code for ${phone}: ${code}`);
}
