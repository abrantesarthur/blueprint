/**
 * Computes the HMAC-SHA256 of `message` keyed by `key` and returns it as a
 * lowercase hex string. Matches the algorithm used by webhook signatures
 * such as Meta's `X-Hub-Signature-256` header.
 *
 * @param options - The signing inputs.
 * @returns The signature as a lowercase hex string.
 */
export async function hmacSha256Hex({
  message,
  key,
}: {
  /** The bytes to sign. */
  message: string;
  /** The HMAC key. */
  key: string;
}): Promise<string> {
  const encoder = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    encoder.encode(message),
  );

  const bytes = new Uint8Array(signature);
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}
