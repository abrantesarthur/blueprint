/**
 * Computes a SHA-256 hash of the given input and returns it as a hex string.
 * Used for OTP codes and request tokens — neither is stored in plaintext, so
 * a database leak does not expose usable values.
 * @param input - The plaintext string to hash.
 * @returns The 64-character lowercase hex digest.
 */
export function hashSha256(input: string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(input);
  return hasher.digest("hex");
}
