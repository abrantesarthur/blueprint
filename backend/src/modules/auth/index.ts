import type {
  OtpRequestBody,
  OtpRequestResponse,
  OtpVerifyBody,
  OtpVerifyResponse,
  TokensResponse,
} from "@blueprint/api-utils";
import { Elysia } from "elysia";

import { authMiddleware } from "../../shared/middleware/auth";
import { RATE_LIMITS, rateLimitHook } from "../../shared/middleware/rateLimit";
import type { SuccessResponse } from "../shared/schema";
import { authModel } from "./model";
import { refreshAuthTokens, requestOtp, verifyOtp } from "./service";

// Framework-agnostic Controller
abstract class AuthController {
  static requestOtp(input: OtpRequestBody): Promise<OtpRequestResponse> {
    return requestOtp(input);
  }

  static verifyOtp(input: OtpVerifyBody): Promise<OtpVerifyResponse> {
    return verifyOtp(input);
  }

  static refreshToken(refreshToken: string): Promise<TokensResponse> {
    return refreshAuthTokens(refreshToken);
  }

  static logout(): SuccessResponse {
    // For stateless JWT, logout is handled client-side by discarding tokens
    return { success: true };
  }
}

export const authModule = new Elysia({ prefix: "/auth" })
  .use(authModel)
  .post("/otp/request", ({ body }) => AuthController.requestOtp(body), {
    beforeHandle: [
      rateLimitHook(RATE_LIMITS.OTP_REQUEST_IP),
      rateLimitHook(RATE_LIMITS.OTP_REQUEST),
    ],
    body: "otpRequestBody",
    response: "otpRequestResponse",
    detail: {
      summary: "Request OTP for phone verification",
      description:
        "Delivers a 6-digit OTP to the provided phone number via the configured OTP provider.",
      tags: ["Authentication"],
    },
  })
  .post("/otp/verify", ({ body }) => AuthController.verifyOtp(body), {
    beforeHandle: rateLimitHook(RATE_LIMITS.OTP_VERIFY),
    body: "otpVerifyBody",
    response: "otpVerifyResponse",
    detail: {
      summary: "Verify OTP and authenticate",
      description:
        "Verifies the OTP code and returns auth tokens for the matching user.",
      tags: ["Authentication"],
    },
  })
  .post(
    "/refresh",
    ({ body }) => AuthController.refreshToken(body.refreshToken),
    {
      beforeHandle: rateLimitHook(RATE_LIMITS.TOKEN_REFRESH),
      body: "refreshTokenBody",
      response: "tokensResponse",
      detail: {
        summary: "Refresh JWT token",
        tags: ["Authentication"],
      },
    },
  )
  .post("/logout", () => AuthController.logout(), {
    beforeHandle: rateLimitHook(RATE_LIMITS.LOGOUT),
    response: "successResponse",
    detail: {
      summary: "Invalidate refresh token",
      tags: ["Authentication"],
    },
  })
  .use(authMiddleware)
  .get("/me", ({ user }) => user, {
    beforeHandle: rateLimitHook(RATE_LIMITS.STANDARD),
    response: "authUserResponse",
    detail: {
      summary: "Get current user profile",
      tags: ["Authentication"],
    },
  });
