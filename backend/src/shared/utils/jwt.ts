import { env } from "../../config";
import { generateToken, type JwtPayload, verifyToken } from "./jws";

const ACCESS_TOKEN_EXPIRY = 24 * 60 * 60; // 1 day in seconds

/**
 * Generates a short-lived access token for API authentication.
 * @param input - Object containing the user ID.
 * @returns The generated access token and its expiry time in seconds.
 */
export async function generateAccessToken({
  userId,
}: {
  /** The unique identifier of the user to generate the token for. */
  userId: string;
}): Promise<{
  /** The signed access token. */
  accessToken: string;
  /** Token validity in seconds. */
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
 * Verifies an access token and extracts its payload.
 * @param token - The JWT access token to verify.
 * @returns The decoded JWT payload if valid, null if invalid or expired.
 */
export async function verifyAccessToken(
  token: string,
): Promise<JwtPayload | null> {
  return verifyToken(token, env.JWT_SECRET.release(), "access");
}
