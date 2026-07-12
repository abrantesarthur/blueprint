import type { AuthUser } from "@blueprint/api-utils";
import { UserErrorMessage } from "@blueprint/error-utils";

import { createUsers, deleteUsers, findOneUser, updateUsers } from "../../db";
import {
  ConflictError,
  DbError,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "../../shared";
import {
  generateAuthTokens,
  verifyRegistrationToken,
} from "../../shared/utils/jwt";
import { consumeOtp } from "../auth/helpers";
import type {
  User,
  UserCreateBody,
  UserCreateResponse,
  UserPhoneUpdateBody,
  UserUpdateBody,
} from "./model";

/**
 * Creates a new user account using a registration token obtained from OTP
 * verification.
 *
 * @param body - The registration token and profile data.
 * @returns The created user and JWT access + refresh tokens.
 * @throws UnauthorizedError if the registration token is invalid or expired.
 * @throws ConflictError if the phone number is already registered.
 */
export async function createUser(
  body: UserCreateBody,
): Promise<UserCreateResponse> {
  const { registrationToken, firstName, lastName } = body;

  const payload = await verifyRegistrationToken({ token: registrationToken });
  if (!payload) {
    throw new UnauthorizedError(UserErrorMessage.EXPIRED_REGISTRATION);
  }

  let created;
  try {
    [created] = await createUsers({
      data: [
        {
          firstName,
          lastName,
          phone: payload.id,
          phoneVerified: true,
        },
      ],
    });
  } catch (error) {
    if (error instanceof DbError && error.message.includes("unique")) {
      throw new ConflictError(UserErrorMessage.PHONE_ALREADY_EXISTS);
    }
    throw error;
  }

  if (!created) {
    throw new NotFoundError(UserErrorMessage.USER_NOT_FOUND);
  }

  const tokens = await generateAuthTokens({ userId: created.id });

  return {
    user: {
      id: created.id,
      email: created.email,
      firstName: created.firstName,
      lastName: created.lastName,
      role: created.role,
    },
    ...tokens,
  };
}

/**
 * Updates a user's mutable profile fields. Phone has its own dedicated
 * OTP-gated endpoint (`PATCH /users/me/phone`).
 *
 * @param options - The update inputs.
 * @returns The updated user record.
 * @throws NotFoundError if the user does not exist.
 */
export async function updateUser({
  userId,
  body,
}: {
  /** The id of the user to update. */
  userId: string;
  /** The profile fields to patch. */
  body: UserUpdateBody;
}): Promise<User> {
  const values: Partial<Pick<User, "firstName" | "lastName">> = {};
  if (body.firstName !== undefined) values.firstName = body.firstName;
  if (body.lastName !== undefined) values.lastName = body.lastName;

  const [updated] = await updateUsers({
    where: { id: userId },
    values,
  });
  if (!updated) {
    throw new NotFoundError(UserErrorMessage.USER_NOT_FOUND);
  }
  return updated;
}

/**
 * Updates the authenticated user's phone after verifying control of the
 * new number via OTP. The caller must have first requested an OTP for the
 * new phone via `POST /auth/otp/request` and received a request token.
 *
 * The phone uniqueness constraint is enforced both proactively (404 → 409
 * conversion of the underlying DB error) and via an early lookup so the
 * happy path returns a clean 409 without consuming the OTP record.
 *
 * @param options - The update inputs.
 * @param options.userId - The authenticated caller's user id.
 * @param options.body - The new phone, OTP code, and request token.
 * @returns The updated user record.
 * @throws BadRequestError if OTP validation fails.
 * @throws ConflictError if the phone is already registered to another user.
 * @throws NotFoundError if the caller's user record no longer exists.
 */
export async function updateUserPhone({
  userId,
  body,
}: {
  /** The authenticated caller's user id. */
  userId: string;
  /** The new phone, OTP code, and request token. */
  body: UserPhoneUpdateBody;
}): Promise<User> {
  const existingByPhone = await findOneUser({
    where: { phone: body.phone },
    require: false,
  });
  if (existingByPhone && existingByPhone.id !== userId) {
    throw new ConflictError(UserErrorMessage.PHONE_ALREADY_EXISTS);
  }

  await consumeOtp({
    phone: body.phone,
    code: body.code,
    requestToken: body.requestToken,
  });

  let updated: User | undefined;
  try {
    [updated] = await updateUsers({
      where: { id: userId },
      values: { phone: body.phone, phoneVerified: true },
    });
  } catch (error) {
    if (error instanceof DbError && error.message.includes("unique")) {
      throw new ConflictError(UserErrorMessage.PHONE_ALREADY_EXISTS);
    }
    throw error;
  }

  if (!updated) {
    throw new NotFoundError(UserErrorMessage.USER_NOT_FOUND);
  }

  return updated;
}

/**
 * Permanently deletes a user account and all associated data.
 * @param userId - The unique identifier of the user to delete.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  await deleteUsers({ where: { id: userId } });
}

/**
 * Returns the full user record for the given user, scoped to the caller's
 * access. Only the owner of the record or an admin may view it.
 * @param options - The query options.
 * @param options.userId - The id of the user whose record to fetch.
 * @param options.authUser - The authenticated caller.
 * @returns The full user record.
 * @throws ForbiddenError if the caller is neither the owner nor an admin.
 * @throws NotFoundError if the user does not exist.
 */
export async function getUser({
  userId,
  authUser,
}: {
  /** The id of the user whose record to fetch. */
  userId: string;
  /** The authenticated caller. */
  authUser: AuthUser;
}): Promise<User> {
  if (authUser.id !== userId && authUser.role !== "admin") {
    throw new ForbiddenError(UserErrorMessage.ACCESS_DENIED);
  }

  const user = await findOneUser({ where: { id: userId }, require: false });
  if (!user) {
    throw new NotFoundError(UserErrorMessage.USER_NOT_FOUND);
  }

  return user;
}
