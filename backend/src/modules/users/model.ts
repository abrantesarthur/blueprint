import {
  userCreateBody,
  userCreateResponse,
  userPhoneUpdateBody,
  userResponse,
  userUpdateBody,
} from "@blueprint/api-utils";
import { Elysia, type Static, t } from "elysia";

import { successResponse, userRole, uuidParam } from "../shared/schema";

export type {
  UserCreateBody,
  UserCreateResponse,
  UserPhoneUpdateBody,
  UserResponse,
  UserUpdateBody,
} from "@blueprint/api-utils";

// Full user record (matches database row)
const user = t.Object({
  id: t.String(),
  email: t.Nullable(t.String()),
  firstName: t.String(),
  lastName: t.String(),
  phone: t.String(),
  phoneVerified: t.Boolean(),
  role: userRole,
  otpRequestedAt: t.Nullable(t.Date()),
  createdAt: t.Date(),
  updatedAt: t.Date(),
});

/** Full user record from database. */
export type User = Static<typeof user>;

export const usersModel = new Elysia().model({
  userCreateBody,
  userCreateResponse,
  userPhoneUpdateBody,
  userResponse,
  userUpdateBody,
  successResponse,
  user,
  uuidParam,
});
