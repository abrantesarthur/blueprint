import { ONE_SECOND } from "@blueprint/time-utils";

import { findOneOtpCode } from "../../../db";
import { TooManyRequestsError } from "../../../shared";
import { OTP_RATE_LIMIT_MS } from "../constants";

/**
 * Enforces rate limiting for OTP requests based on the OTP table.
 * Works for both existing and new phone numbers since it queries the OTP
 * record directly (the phone column has a UNIQUE constraint).
 * @param phone - The phone number to check.
 * @throws TooManyRequestsError if rate limit exceeded.
 */
export async function enforceOtpRateLimit(phone: string): Promise<void> {
  const existingOtp = await findOneOtpCode({
    attributes: ["createdAt"],
    where: { phone },
    require: false,
  });

  if (existingOtp?.createdAt) {
    const msSinceLastRequest = Date.now() - existingOtp.createdAt.getTime();
    if (msSinceLastRequest < OTP_RATE_LIMIT_MS) {
      const waitSeconds = Math.ceil(
        (OTP_RATE_LIMIT_MS - msSinceLastRequest) / ONE_SECOND,
      );
      throw new TooManyRequestsError(
        `Please wait ${waitSeconds} seconds before requesting a new code.`,
      );
    }
  }
}
