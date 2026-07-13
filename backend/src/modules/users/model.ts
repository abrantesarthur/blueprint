import {
  userCreateBody,
  userResponse,
  userUpdateBody,
} from "@blueprint/api-utils";
import { Elysia } from "elysia";

import { successResponse, uuidParam } from "../shared/schema";

export type {
  UserCreateBody,
  UserResponse,
  UserUpdateBody,
} from "@blueprint/api-utils";

export const usersModel = new Elysia().model({
  userCreateBody,
  userResponse,
  userUpdateBody,
  successResponse,
  uuidParam,
});
