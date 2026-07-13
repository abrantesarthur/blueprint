import type { AuthUser } from "@blueprint/api-utils";
import { Elysia } from "elysia";

import type { User } from "../../db";
import { authMiddleware } from "../../shared/middleware/auth";
import {
  RATE_LIMITS,
  rateLimitHook,
  standardRateLimitPlugin,
} from "../../shared/middleware/rateLimit";
import type { SuccessResponse } from "../shared/schema";
import { type UserCreateBody, usersModel, type UserUpdateBody } from "./model";
import { createUser, deleteUserAccount, getUser, updateUser } from "./service";

// Framework-agnostic Controller
abstract class UsersController {
  /**
   * Creates a new user account.
   * @param data - The profile fields for the new user.
   * @returns The created user record.
   */
  static create(data: UserCreateBody): Promise<User> {
    return createUser(data);
  }

  /**
   * Updates the authenticated user's mutable profile fields.
   * @param userId - The authenticated caller's user id.
   * @param body - The profile fields to patch.
   * @returns The updated user record.
   */
  static update(userId: string, body: UserUpdateBody): Promise<User> {
    return updateUser({ userId, body });
  }

  /**
   * Returns the requested user's full profile, scoped to the caller's access.
   * @param userId - The id of the user whose record to fetch.
   * @param authUser - The authenticated caller.
   * @returns The user record.
   */
  static getUser(userId: string, authUser: AuthUser): Promise<User> {
    return getUser({ userId, authUser });
  }

  /**
   * Permanently deletes the authenticated user's account.
   * @param userId - The authenticated caller's user id.
   * @returns A success response.
   */
  static async deleteAccount(userId: string): Promise<SuccessResponse> {
    await deleteUserAccount(userId);

    return { success: true };
  }
}

export const usersModule = new Elysia({ prefix: "/users" })
  .use(usersModel)
  // Public registration route
  .post("/", ({ body }) => UsersController.create(body), {
    beforeHandle: rateLimitHook(RATE_LIMITS.CREATE_USER),
    body: "userCreateBody",
    response: "userResponse",
    detail: {
      summary: "Create a new user account",
      tags: ["Users"],
    },
  })
  // Authenticated routes
  .use(authMiddleware)
  .use(standardRateLimitPlugin)
  .patch("/me", ({ user, body }) => UsersController.update(user.id, body), {
    body: "userUpdateBody",
    response: "userResponse",
    detail: {
      summary: "Update current user profile",
      tags: ["Users"],
    },
  })
  .delete("/me", ({ user }) => UsersController.deleteAccount(user.id), {
    response: "successResponse",
    detail: {
      summary: "Delete account",
      tags: ["Users"],
    },
  })
  .get("/:id", ({ params, user }) => UsersController.getUser(params.id, user), {
    params: "uuidParam",
    response: "userResponse",
    detail: {
      summary: "Get a user profile by id",
      description:
        "Returns the requested user's profile. Only the owner may access this data.",
      tags: ["Users"],
    },
  });
