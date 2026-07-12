import {
  otpRequestBody,
  otpRequestResponse,
  otpVerifyBody,
  otpVerifyResponse,
  refreshTokenBody,
  tokensResponse,
} from "@blueprint/api-utils";
import { Elysia } from "elysia";

import { authUser, successResponse } from "../shared/schema";

// ============ Elysia Model ============

export const authModel = new Elysia().model({
  otpRequestBody,
  otpRequestResponse,
  otpVerifyBody,
  otpVerifyResponse,
  refreshTokenBody,
  tokensResponse,
  authUserResponse: authUser,
  successResponse,
});
