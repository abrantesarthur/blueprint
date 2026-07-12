/** Payload structure for JWT tokens used in authentication. */
export interface JwtPayload {
  /** The unique identifier of the authenticated user (phone or userId). */
  id: string;
  /** The type of token - access for short-lived API auth, refresh for obtaining new tokens. */
  type: "access" | "refresh" | "registration";
  /** Issued at timestamp in seconds since Unix epoch. */
  iat: number;
  /** Expiration timestamp in seconds since Unix epoch. */
  exp: number;
}

/**
 * Decodes a URL-safe Base64 string back to its original form.
 * @param data - The URL-safe Base64 encoded string to decode.
 * @returns The decoded original string.
 */
function base64UrlDecode(data: string): string {
  const padded = data + "=".repeat((4 - (data.length % 4)) % 4);
  return Buffer.from(
    padded.replace(/-/g, "+").replace(/_/g, "/"),
    "base64",
  ).toString();
}

/**
 * Encodes a string to URL-safe Base64 format.
 * @param data - The string to encode.
 * @returns The URL-safe Base64 encoded string.
 */
function base64UrlEncode(data: string): string {
  return Buffer.from(data)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * Creates an HMAC-SHA256 signature for JWT token parts.
 * @param header - The Base64URL encoded JWT header.
 * @param payload - The Base64URL encoded JWT payload.
 * @param secret - The secret key used for signing.
 * @returns The Base64URL encoded signature.
 */
async function createSignature(
  header: string,
  payload: string,
  secret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`${header}.${payload}`);
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, data);
  return base64UrlEncode(String.fromCharCode(...new Uint8Array(signature)));
}

/**
 * Verifies an HMAC-SHA256 signature against expected value.
 * @param header - The Base64URL encoded JWT header.
 * @param payload - The Base64URL encoded JWT payload.
 * @param signature - The signature to verify.
 * @param secret - The secret key used for verification.
 * @returns True if the signature is valid, false otherwise.
 */
async function verifySignature(
  header: string,
  payload: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  const expectedSignature = await createSignature(header, payload, secret);
  return signature === expectedSignature;
}

/**
 * Generates a JWT token with the specified parameters.
 * Internal function - use generateAccessToken, generateRefreshToken, or generateRegistrationToken instead.
 * @param id - The unique identifier of the user to generate token for.
 * @param type - The type of token to generate.
 * @param expiresIn - The token expiry duration in seconds.
 * @param secret - The secret key used for signing.
 * @returns The generated token string and its expiry time in seconds.
 */
export async function generateToken(
  id: string,
  type: "access" | "refresh" | "registration",
  expiresIn: number,
  secret: string,
): Promise<{ token: string; expiresIn: number }> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const payload = base64UrlEncode(
    JSON.stringify({
      id,
      type,
      iat: now,
      exp: now + expiresIn,
    }),
  );
  const signature = await createSignature(header, payload, secret);
  return {
    token: `${header}.${payload}.${signature}`,
    expiresIn,
  };
}

/**
 * Verifies a JWT token and extracts its payload.
 * Internal function - use verifyAccessToken or verifyRefreshToken instead.
 * @param token - The JWT token to verify.
 * @param secret - The secret key used for verification.
 * @param expectedType - The expected token type (access or refresh).
 * @returns The decoded JWT payload if valid, null if invalid or expired.
 */
export async function verifyToken(
  token: string,
  secret: string,
  expectedType: "access" | "refresh" | "registration",
): Promise<JwtPayload | null> {
  try {
    const [header, payload, signature] = token.split(".");
    if (!header || !payload || !signature) return null;

    const isValid = await verifySignature(header, payload, signature, secret);
    if (!isValid) return null;

    const decoded = JSON.parse(base64UrlDecode(payload)) as JwtPayload;

    if (decoded.type !== expectedType) return null;
    if (decoded.exp < Math.floor(Date.now() / 1000)) return null;

    return decoded;
  } catch {
    return null;
  }
}
