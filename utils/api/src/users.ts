import { roleSchema } from "@blueprint/enum-utils";
import { type Static, Type as t } from "@sinclair/typebox";

import { authUser } from "./auth";
import { E164_PHONE_PATTERN, NO_DIGITS_PATTERN } from "./regex";
import { Nullable } from "./utils/nullable";

/** Request body for `POST /users` — creates an account after OTP verification. */
export const userCreateBody = t.Object({
  /** The user's first name. */
  firstName: t.String({
    minLength: 2,
    maxLength: 30,
    pattern: NO_DIGITS_PATTERN,
  }),
  /** The user's last name. */
  lastName: t.String({
    minLength: 2,
    maxLength: 60,
    pattern: NO_DIGITS_PATTERN,
  }),
  /** Registration JWT minted by `POST /auth/otp/verify` for the verified phone. */
  registrationToken: t.String({ minLength: 1, maxLength: 2048 }),
});

/** Request body type for `POST /users`. */
export type UserCreateBody = Static<typeof userCreateBody>;

/** Response body for `POST /users` — newly created user and auth tokens. */
export const userCreateResponse = t.Object({
  /** The newly created authenticated user. */
  user: authUser,
  /** The short-lived access token. */
  accessToken: t.String(),
  /** The long-lived refresh token. */
  refreshToken: t.String(),
  /** Access token validity in seconds. */
  accessTokenExpiresIn: t.Number(),
  /** Refresh token validity in seconds. */
  refreshTokenExpiresIn: t.Number(),
});

/** Response body type for `POST /users`. */
export type UserCreateResponse = Static<typeof userCreateResponse>;

/**
 * Request body for `PATCH /users/me/phone`. The caller must prove control of
 * the new phone by submitting an OTP previously requested for that number,
 * along with the request token bound to the OTP request.
 */
export const userPhoneUpdateBody = t.Object({
  /** New phone number in E.164 format (e.g. +15551234567). */
  phone: t.String({
    minLength: 9,
    maxLength: 16,
    pattern: E164_PHONE_PATTERN,
  }),
  /** 6-digit OTP code received on the new phone. */
  code: t.String({ minLength: 6, maxLength: 6 }),
  /** 64-char hex request token returned from `POST /auth/otp/request`. */
  requestToken: t.String({
    minLength: 64,
    maxLength: 64,
    pattern: "^[a-f0-9]{64}$",
  }),
});

/** Request body for `PATCH /users/me/phone`. */
export type UserPhoneUpdateBody = Static<typeof userPhoneUpdateBody>;

/** Public user-profile response schema. */
export const userResponse = t.Object({
  /** The user's unique identifier. */
  id: t.String(),
  /** The user's email address or null. */
  email: Nullable(t.String()),
  /** The user's first name. */
  firstName: t.String(),
  /** The user's last name. */
  lastName: t.String(),
  /** Phone number in E.164 format (e.g. `+15551234567`) or null. */
  phone: Nullable(t.String()),
  /** The user's role. */
  role: roleSchema,
  /** Account creation timestamp (ISO string when serialised). */
  createdAt: t.Date(),
});

/** Public user-profile response type. */
export type UserResponse = Static<typeof userResponse>;

/**
 * Request body for `PATCH /users/me`. Every field is optional so callers
 * can patch a single attribute without echoing the entire profile.
 *
 * Phone has its own dedicated OTP-gated endpoint (`PATCH /users/me/phone`).
 */
export const userUpdateBody = t.Object({
  /** The user's first name. */
  firstName: t.Optional(
    t.String({ minLength: 2, maxLength: 30, pattern: NO_DIGITS_PATTERN }),
  ),
  /** The user's last name. */
  lastName: t.Optional(
    t.String({ minLength: 2, maxLength: 60, pattern: NO_DIGITS_PATTERN }),
  ),
});

/** Request body type for `PATCH /users/me`. */
export type UserUpdateBody = Static<typeof userUpdateBody>;
