import { hashSha256 } from "@blueprint/crypto-utils";
import { AuthErrorMessage } from "@blueprint/error-utils";

import {
  deleteOtpCodes,
  findOneOtpCode,
  incrementOtpAttempts,
  type OtpCode,
} from "../../../db";
import { BadRequestError } from "../../../shared/utils/errors";
import { OTP_MAX_ATTEMPTS } from "../constants";

/**
 * Retrieves an active (non-expired) OTP for a phone number.
 * @param phone - The phone number to look up.
 * @returns The OTP record if found and not expired, null otherwise.
 */
async function getActiveOtpByPhone(phone: string): Promise<OtpCode | null> {
  return findOneOtpCode({
    where: { phone, expiresAt: { value: new Date(), operator: "gte" } },
    require: false,
  });
}

/**
 * Atomically increments OTP attempts if under the max limit.
 * @param otpId - The ID of the OTP record.
 * @returns True if increment succeeded (was under limit), false if max attempts exceeded.
 */
async function tryIncrementOtpAttempts(otpId: string): Promise<boolean> {
  const updated = await incrementOtpAttempts({
    otpId,
    maxAttempts: OTP_MAX_ATTEMPTS,
  });

  return updated.length > 0;
}

/**
 * Validates an OTP submission and consumes the record on success.
 *
 * Performs the same security-critical sequence used during login OTP
 * verification: looks up the active OTP, atomically increments the attempt
 * counter (max 3), validates the request token (binds verification to the
 * device that requested the OTP), validates the code itself, and finally
 * deletes the record so it cannot be reused.
 *
 * Both the request token and code checks are performed AFTER the attempt
 * increment so that probing attempts always burn a try.
 *
 * @param input - The OTP submission inputs.
 * @param input.phone - The phone number that received the OTP.
 * @param input.code - The 6-digit plaintext OTP code submitted by the user.
 * @param input.requestToken - The plaintext request token from `requestOtp`.
 * @throws BadRequestError if the OTP is expired, max attempts exceeded,
 *         the request token is wrong, or the code is wrong.
 */
export async function consumeOtp({
  phone,
  code,
  requestToken,
}: {
  /** The phone number that received the OTP. */
  phone: string;
  /** The 6-digit plaintext OTP code submitted by the user. */
  code: string;
  /** The plaintext request token returned from `requestOtp`. */
  requestToken: string;
}): Promise<void> {
  const otpRecord = await getActiveOtpByPhone(phone);

  if (!otpRecord) {
    throw new BadRequestError(AuthErrorMessage.EXPIRED_OTP);
  }

  const attemptAllowed = await tryIncrementOtpAttempts(otpRecord.id);
  if (!attemptAllowed) {
    throw new BadRequestError(AuthErrorMessage.MAX_OTP_ATTEMPTS);
  }

  const hashedRequestToken = hashSha256(requestToken);
  if (otpRecord.requestToken !== hashedRequestToken) {
    throw new BadRequestError(AuthErrorMessage.INVALID_REQUEST_TOKEN);
  }

  const hashedInput = hashSha256(code);
  if (otpRecord.code !== hashedInput) {
    throw new BadRequestError(AuthErrorMessage.INVALID_OTP);
  }

  await deleteOtpCodes({ where: { id: otpRecord.id } });
}
