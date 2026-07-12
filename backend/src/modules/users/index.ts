import type { AuthUser } from "@blueprint/api-utils";
import { Elysia } from "elysia";

import { authMiddleware } from "../../shared/middleware/auth";
import {
  RATE_LIMITS,
  rateLimitHook,
  standardRateLimitPlugin,
} from "../../shared/middleware/rateLimit";
import type { SuccessResponse } from "../shared/schema";
import {
  type UserCreateBody,
  type UserCreateResponse,
  type UserPhoneUpdateBody,
  type UserResponse,
  usersModel,
  type UserUpdateBody,
} from "./model";
import {
  createUser,
  deleteUserAccount,
  getUser,
  updateUser,
  updateUserPhone,
} from "./service";

// Framework-agnostic Controller
abstract class UsersController {
  /**
   * Creates a new user account using a registration token from OTP verification.
   * @param data - The registration token and profile fields.
   * @returns The created user and auth tokens.
   */
  static create(data: UserCreateBody): Promise<UserCreateResponse> {
    return createUser(data);
  }

  /**
   * Updates the authenticated user's mutable profile fields.
   * @param userId - The authenticated caller's user id.
   * @param body - The profile fields to patch.
   * @returns The updated user record.
   */
  static update(userId: string, body: UserUpdateBody): Promise<UserResponse> {
    return updateUser({ userId, body });
  }

  /**
   * Updates the authenticated user's phone after verifying OTP.
   * @param userId - The authenticated caller's user id.
   * @param body - The new phone, OTP code, and request token.
   * @returns The updated user record.
   */
  static updatePhone(
    userId: string,
    body: UserPhoneUpdateBody,
  ): Promise<UserResponse> {
    return updateUserPhone({ userId, body });
  }

  /**
   * Returns the requested user's full profile, scoped to the caller's access.
   * @param userId - The id of the user whose record to fetch.
   * @param authUser - The authenticated caller.
   * @returns The user record.
   */
  static getUser(userId: string, authUser: AuthUser): Promise<UserResponse> {
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
  // Public registration route — registration-token auth, not JWT
  .post("/", ({ body }) => UsersController.create(body), {
    beforeHandle: rateLimitHook(RATE_LIMITS.CREATE_USER),
    body: "userCreateBody",
    response: "userCreateResponse",
    detail: {
      summary: "Create a new user account",
      description:
        "Creates a user using a registration token obtained from OTP verification.",
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
  .patch(
    "/me/phone",
    ({ user, body }) => UsersController.updatePhone(user.id, body),
    {
      body: "userPhoneUpdateBody",
      response: "userResponse",
      detail: {
        summary: "Update current user's phone after OTP verification",
        description:
          "Validates an OTP requested for the new phone (single-use), then updates the authenticated user's phone and marks it verified.",
        tags: ["Users"],
      },
    },
  )
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
        "Returns the requested user's full record. Only the owner or an admin may access this data.",
      tags: ["Users"],
    },
  });
