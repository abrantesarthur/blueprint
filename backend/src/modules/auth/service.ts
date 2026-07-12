import type {
  OtpRequestBody,
  OtpRequestResponse,
  OtpVerifyBody,
  OtpVerifyResponse,
  TokensResponse,
} from "@blueprint/api-utils";
import { hashSha256 } from "@blueprint/crypto-utils";
import { AuthErrorMessage } from "@blueprint/error-utils";
import { ONE_SECOND } from "@blueprint/time-utils";

import { env } from "../../config";
import { createOtpCode, findOneUser, updateUsers } from "../../db";
import { sendOtp } from "../../integrations/otp";
import { UnauthorizedError } from "../../shared/utils/errors";
import {
  generateAuthTokens,
  generateRegistrationToken,
  verifyRefreshToken,
} from "../../shared/utils/jwt";
import { OTP_EXPIRY_MS } from "./constants";
import {
  consumeOtp,
  enforceOtpRateLimit,
  generateOtpCode,
  generateRequestToken,
} from "./helpers";

/**
 * Refreshes authentication tokens using a valid refresh token.
 * @param refreshToken - The refresh token to use for generating new tokens.
 * @returns New access and refresh tokens with their expiry times.
 * @throws UnauthorizedError if the refresh token is invalid or user not found.
 */
export async function refreshAuthTokens(
  refreshToken: string,
): Promise<TokensResponse> {
  const payload = await verifyRefreshToken(refreshToken);

  if (!payload) {
    throw new UnauthorizedError(AuthErrorMessage.INVALID_REFRESH_TOKEN);
  }

  // Verify user still exists
  const user = await findOneUser({
    where: { id: payload.id },
    require: false,
  });
  if (!user) {
    throw new UnauthorizedError(AuthErrorMessage.USER_NOT_FOUND);
  }

  return generateAuthTokens({ userId: user.id });
}

// ============ OTP Authentication Functions ============

/**
 * Requests an OTP for phone verification.
 * Delivers a 6-digit code via the OTP integration. No user is created at
 * this stage.
 * @param input - The OTP request input containing the phone number.
 * @returns Response indicating success, expiry time, and the request token.
 * @throws TooManyRequestsError if rate limit exceeded.
 */
export async function requestOtp(
  input: OtpRequestBody,
): Promise<OtpRequestResponse> {
  const { phone } = input;

  // Enforce rate limit via OTP table
  await enforceOtpRateLimit(phone);

  // Generate the 6-digit OTP code and hash it for storage. When the OTP
  // mock is on (local dev only), force a fixed code so the developer can type
  // it in without checking logs or a real device.
  const code = env.MOCK_OTP ? "000000" : generateOtpCode();
  const hashedCode = hashSha256(code);

  // Generate a request token that binds this OTP to the requesting device.
  // The plaintext goes back to the client; the hash goes to the database.
  const { plaintext: requestToken, hashed: hashedRequestToken } =
    generateRequestToken();

  // Send FIRST - if this fails, OTP won't be persisted
  if (!env.MOCK_OTP) {
    await sendOtp({ phone, code });
  }

  // Only persist after successful send
  const now = new Date();
  const expiresAt = new Date(now.getTime() + OTP_EXPIRY_MS);

  // Upsert: if the phone already has an OTP, replace it entirely.
  // IMPORTANT: `onConflictDoUpdate.set` must include `requestToken` so
  // the new plaintext token matches the hash stored in the DB.
  await createOtpCode({
    data: {
      phone,
      code: hashedCode,
      requestToken: hashedRequestToken,
      expiresAt,
    },
    onConflictDoUpdate: {
      target: "phone",
      set: {
        code: hashedCode,
        requestToken: hashedRequestToken,
        expiresAt,
        attempts: 0,
        createdAt: now,
      },
    },
  });

  return {
    success: true,
    expiresIn: OTP_EXPIRY_MS / ONE_SECOND,
    requestToken,
  };
}

/**
 * Verifies an OTP code and either authenticates the user (login) or issues a
 * short-lived registration token that the client can present to `POST /users`
 * to create a new account (registration).
 *
 * This function performs the second half of the OTP authentication flow:
 * 1. Looks up the active (non-expired) OTP for the given phone number.
 * 2. Atomically increments the attempt counter (max 3 attempts allowed).
 * 3. Validates the request token — this ensures only the device that initiated
 *    the OTP request can complete verification (defense against OTP interception).
 * 4. Validates the OTP code itself (hash comparison).
 * 5. Deletes the OTP record (single-use).
 * 6. If a user exists for the phone, marks it verified and returns auth tokens.
 *    Otherwise mints a registration token bound to the phone.
 *
 * The request token check happens AFTER the attempt increment. This is intentional:
 * a wrong request token likely indicates a hijack attempt, and burning an attempt
 * prevents unlimited probing by an attacker who doesn't have the token.
 *
 * @param input - The verification input containing phone, code, and requestToken.
 * @returns Login response (user + tokens) for existing phones, or registration
 *          response (registrationToken) for new phones.
 * @throws BadRequestError if OTP is invalid, expired, max attempts exceeded,
 *         or the request token doesn't match.
 */
export async function verifyOtp({
  phone,
  code,
  requestToken,
}: OtpVerifyBody): Promise<OtpVerifyResponse> {
  await consumeOtp({ phone, code, requestToken });

  const user = await findOneUser({ where: { phone }, require: false });

  if (user) {
    if (!user.phoneVerified) {
      await updateUsers({
        where: { id: user.id },
        values: { phoneVerified: true },
      });
    }

    const tokens = await generateAuthTokens({ userId: user.id });

    return {
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      ...tokens,
      registrationToken: null,
    };
  }

  const { registrationToken: token } = await generateRegistrationToken({
    phone,
  });

  return {
    user: null,
    accessToken: null,
    refreshToken: null,
    accessTokenExpiresIn: null,
    refreshTokenExpiresIn: null,
    registrationToken: token,
  };
}
