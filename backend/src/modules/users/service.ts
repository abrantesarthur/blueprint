import type { AuthUser } from "@blueprint/api-utils";
import { UserErrorMessage } from "@blueprint/error-utils";

import {
  createUsers,
  deleteUsers,
  findOneUser,
  updateUsers,
  type User,
} from "../../db";
import {
  ConflictError,
  DbError,
  ForbiddenError,
  NotFoundError,
} from "../../shared";
import type { UserCreateBody, UserUpdateBody } from "./model";

/**
 * Creates a new user account.
 *
 * @param body - The profile data for the new user.
 * @returns The created user record.
 * @throws ConflictError if the email address is already registered.
 */
export async function createUser(body: UserCreateBody): Promise<User> {
  const { firstName, lastName, email } = body;

  let created: User | undefined;
  try {
    [created] = await createUsers({
      data: [{ firstName, lastName, email }],
    });
  } catch (error) {
    if (error instanceof DbError && error.message.includes("unique")) {
      throw new ConflictError(UserErrorMessage.EMAIL_ALREADY_EXISTS);
    }
    throw error;
  }

  if (!created) {
    throw new NotFoundError(UserErrorMessage.USER_NOT_FOUND);
  }

  return created;
}

/**
 * Updates a user's mutable profile fields.
 *
 * @param options - The update inputs.
 * @returns The updated user record.
 * @throws NotFoundError if the user does not exist.
 * @throws ConflictError if the email address is already registered.
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
  const values: Partial<Pick<User, "firstName" | "lastName" | "email">> = {};
  if (body.firstName !== undefined) values.firstName = body.firstName;
  if (body.lastName !== undefined) values.lastName = body.lastName;
  if (body.email !== undefined) values.email = body.email;

  let updated: User | undefined;
  try {
    [updated] = await updateUsers({
      where: { id: userId },
      values,
    });
  } catch (error) {
    if (error instanceof DbError && error.message.includes("unique")) {
      throw new ConflictError(UserErrorMessage.EMAIL_ALREADY_EXISTS);
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
 * access. Only the owner of the record may view it.
 * @param options - The query options.
 * @param options.userId - The id of the user whose record to fetch.
 * @param options.authUser - The authenticated caller.
 * @returns The full user record.
 * @throws ForbiddenError if the caller is not the owner.
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
  if (authUser.id !== userId) {
    throw new ForbiddenError(UserErrorMessage.ACCESS_DENIED);
  }

  const user = await findOneUser({ where: { id: userId }, require: false });
  if (!user) {
    throw new NotFoundError(UserErrorMessage.USER_NOT_FOUND);
  }

  return user;
}
