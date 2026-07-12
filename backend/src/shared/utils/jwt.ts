import { env } from "../../config";
import { REGISTRATION_TOKEN_EXPIRY } from "../../modules/auth/constants";
import { generateToken, type JwtPayload, verifyToken } from "./jws";

const ACCESS_TOKEN_EXPIRY = 24 * 60 * 60; // 1 day in seconds
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60; // 7 days in seconds

/**
 * Generates a short-lived access token for API authentication.
 * @param userId - The unique identifier of the user to generate token for.
 * @returns The generated access token and its expiry time in seconds.
 */
async function generateAccessToken(userId: string): Promise<{
  accessToken: string;
  expiresIn: number;
}> {
  const { token, expiresIn } = await generateToken(
    userId,
    "access",
    ACCESS_TOKEN_EXPIRY,
    env.JWT_SECRET.release(),
  );
  return { accessToken: token, expiresIn };
}

/**
 * Generates a long-lived refresh token for obtaining new access tokens.
 * @param userId - The unique identifier of the user to generate token for.
 * @returns The generated refresh token and its expiry time in seconds.
 */
async function generateRefreshToken(userId: string): Promise<{
  refreshToken: string;
  expiresIn: number;
}> {
  const { token, expiresIn } = await generateToken(
    userId,
    "refresh",
    REFRESH_TOKEN_EXPIRY,
    env.JWT_REFRESH_SECRET.release(),
  );
  return { refreshToken: token, expiresIn };
}

/**
 * Verifies an access token and extracts its payload.
 * @param token - The JWT access token to verify.
 * @returns The decoded JWT payload if valid, null if invalid or expired.
 */
export async function verifyAccessToken(
  token: string,
): Promise<JwtPayload | null> {
  return verifyToken(token, env.JWT_SECRET.release(), "access");
}

/**
 * Verifies a refresh token and extracts its payload.
 * @param token - The JWT refresh token to verify.
 * @returns The decoded JWT payload if valid, null if invalid or expired.
 */
export async function verifyRefreshToken(
  token: string,
): Promise<JwtPayload | null> {
  return verifyToken(token, env.JWT_REFRESH_SECRET.release(), "refresh");
}

// ============ Registration Token Functions ============

/**
 * Generates a short-lived registration token for a verified phone number.
 * Issued by `verifyOtp` when no user account exists yet, and consumed by
 * `POST /users` to prove that the caller just passed OTP for the phone.
 * @param input - Object containing the verified phone number.
 * @returns The registration token string and its expiry time in seconds.
 */
export async function generateRegistrationToken({
  phone,
}: {
  /** The phone number that has just been OTP-verified. */
  phone: string;
}): Promise<{
  /** The signed registration JWT. */
  registrationToken: string;
  /** Token validity in seconds. */
  expiresIn: number;
}> {
  const { token, expiresIn } = await generateToken(
    phone,
    "registration",
    REGISTRATION_TOKEN_EXPIRY,
    env.JWT_SECRET.release(),
  );
  return { registrationToken: token, expiresIn };
}

/**
 * Verifies a registration token and extracts its payload.
 * @param input - Object containing the token to verify.
 * @returns The decoded registration payload if valid, null if invalid or expired.
 */
export async function verifyRegistrationToken({
  token,
}: {
  /** The registration JWT to verify. */
  token: string;
}): Promise<JwtPayload | null> {
  return verifyToken(token, env.JWT_SECRET.release(), "registration");
}

// ============ Auth Token Generation ============

/** JWT access and refresh tokens with expiry metadata. */
interface AuthTokens {
  /** The short-lived access token. */
  accessToken: string;
  /** The long-lived refresh token. */
  refreshToken: string;
  /** Access token validity in seconds. */
  accessTokenExpiresIn: number;
  /** Refresh token validity in seconds. */
  refreshTokenExpiresIn: number;
}

/**
 * Generates both access and refresh tokens for a user.
 * @param input - Object containing the user ID.
 * @returns The generated access and refresh tokens with their expiry times.
 */
export async function generateAuthTokens({
  userId,
}: {
  /** The unique identifier of the user. */
  userId: string;
}): Promise<AuthTokens> {
  const [accessTokenResult, refreshTokenResult] = await Promise.all([
    generateAccessToken(userId),
    generateRefreshToken(userId),
  ]);

  return {
    accessToken: accessTokenResult.accessToken,
    refreshToken: refreshTokenResult.refreshToken,
    accessTokenExpiresIn: accessTokenResult.expiresIn,
    refreshTokenExpiresIn: refreshTokenResult.expiresIn,
  };
}
