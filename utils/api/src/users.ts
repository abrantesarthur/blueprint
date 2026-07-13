import { type Static, Type as t } from "@sinclair/typebox";

import { NO_DIGITS_PATTERN } from "./regex";
import { Nullable } from "./utils/nullable";

/** Standard success response schema. */
export const successResponse = t.Object({ success: t.Boolean() });

/** Standard success response type with boolean status. */
export type SuccessResponse = Static<typeof successResponse>;

/** Authenticated user schema — the user attributes attached to a request. */
export const authUser = t.Object({
  id: t.String(),
  email: Nullable(t.String()),
  firstName: t.String(),
  lastName: t.String(),
});

/** Authenticated user type. */
export type AuthUser = Static<typeof authUser>;

/** Request body for `POST /users` — creates a new user account. */
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
  /** The user's email address. */
  email: t.Optional(t.String({ format: "email", maxLength: 255 })),
});

/** Request body type for `POST /users`. */
export type UserCreateBody = Static<typeof userCreateBody>;

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
  /** Account creation timestamp (ISO string when serialised). */
  createdAt: t.Date(),
});

/** Public user-profile response type. */
export type UserResponse = Static<typeof userResponse>;

/**
 * Request body for `PATCH /users/me`. Every field is optional so callers
 * can patch a single attribute without echoing the entire profile.
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
  /** The user's email address. */
  email: t.Optional(t.String({ format: "email", maxLength: 255 })),
});

/** Request body type for `PATCH /users/me`. */
export type UserUpdateBody = Static<typeof userUpdateBody>;
