import { generateAccessToken } from "../shared/utils/jwt";

/**
 * Generates a valid access token for testing.
 * @param userId - The user ID to include in the token.
 * @returns A valid JWT access token.
 */
async function generateTestAccessToken(userId: string): Promise<string> {
  const { accessToken } = await generateAccessToken({ userId });
  return accessToken;
}

/**
 * Generates access tokens for multiple users.
 * @param userIds - Record mapping token names to user IDs.
 * @returns Record mapping token names to generated tokens.
 */
export async function generateTestAccessTokens<
  T extends Record<string, string>,
>(userIds: T): Promise<Record<keyof T, string>> {
  const entries = Object.entries(userIds);
  const tokens = await Promise.all(
    entries.map(async ([key, userId]) => [
      key,
      await generateTestAccessToken(userId),
    ]),
  );
  return Object.fromEntries(tokens) as Record<keyof T, string>;
}

/**
 * Creates authorization headers with a Bearer token.
 * @param token - The JWT token.
 * @returns Headers object with Authorization header.
 */
export function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}
