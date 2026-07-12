import { roleSchema } from "@blueprint/enum-utils";
import { type Static, Type as t } from "@sinclair/typebox";

import { E164_PHONE_PATTERN } from "./regex";
import { Nullable } from "./utils";

/** Standard success response schema. */
export const successResponse = t.Object({ success: t.Boolean() });

/** Standard success response type with boolean status. */
export type SuccessResponse = Static<typeof successResponse>;

/** Authenticated user schema — JWT payload structure. */
export const authUser = t.Object({
  id: t.String(),
  email: Nullable(t.String()),
  firstName: t.String(),
  lastName: t.String(),
  role: roleSchema,
});

/** Authenticated user type. */
export type AuthUser = Static<typeof authUser>;

/** JWT access and refresh tokens response schema. */
export const tokensResponse = t.Object({
  accessToken: t.String(),
  refreshToken: t.String(),
  accessTokenExpiresIn: t.Number(),
  refreshTokenExpiresIn: t.Number(),
});

/** JWT access and refresh tokens response type. */
export type TokensResponse = Static<typeof tokensResponse>;

/** OTP request body schema. */
export const otpRequestBody = t.Object({
  phone: t.String({ pattern: E164_PHONE_PATTERN }),
});

/** OTP request body type. */
export type OtpRequestBody = Static<typeof otpRequestBody>;

/** OTP request response schema. */
export const otpRequestResponse = t.Object({
  success: t.Boolean(),
  expiresIn: t.Number(),
  requestToken: t.String(),
});

/** OTP request response type. */
export type OtpRequestResponse = Static<typeof otpRequestResponse>;

/** OTP verify response for existing users (login). */
const otpVerifyLoginResponse = t.Object({
  user: authUser,
  accessToken: t.String(),
  refreshToken: t.String(),
  accessTokenExpiresIn: t.Number(),
  refreshTokenExpiresIn: t.Number(),
  registrationToken: t.Null(),
});

/** OTP verify response for new users (registration). */
const otpVerifyRegistrationResponse = t.Object({
  user: t.Null(),
  accessToken: t.Null(),
  refreshToken: t.Null(),
  accessTokenExpiresIn: t.Null(),
  refreshTokenExpiresIn: t.Null(),
  registrationToken: t.String(),
});

/** OTP verify response schema — union of login and registration cases. */
export const otpVerifyResponse = t.Union([
  otpVerifyLoginResponse,
  otpVerifyRegistrationResponse,
]);

/** OTP verify response type. */
export type OtpVerifyResponse = Static<typeof otpVerifyResponse>;

/** OTP verify body schema. */
export const otpVerifyBody = t.Object({
  phone: t.String({ pattern: E164_PHONE_PATTERN }),
  code: t.String({ minLength: 6, maxLength: 6 }),
  requestToken: t.String({
    minLength: 64,
    maxLength: 64,
    pattern: "^[a-f0-9]{64}$",
  }),
});

/** OTP verify body type. */
export type OtpVerifyBody = Static<typeof otpVerifyBody>;

/** Refresh token body schema */
export const refreshTokenBody = t.Object({
  refreshToken: t.String({ minLength: 1, maxLength: 1024 }),
});

/** Refresh token body type */
export type RefreshTokenBody = Static<typeof refreshTokenBody>;
