import { hashSha256 } from "@blueprint/crypto-utils";

import { REQUEST_TOKEN_BYTES } from "../constants";

/**
 * Generates a cryptographically random request token for OTP flow binding.
 *
 * The request token ties an OTP verification attempt to the device/session that
 * initiated it. The plaintext token is returned to the client; the hashed version
 * is stored in the database. During verification, the client must present the
 * plaintext token, which is then hashed and compared against the stored hash.
 *
 * @returns An object with `plaintext` (64-char hex, sent to client) and
 *          `hashed` (SHA-256 of plaintext, stored in DB).
 */
export function generateRequestToken(): { plaintext: string; hashed: string } {
  // Generate 32 random bytes → 64-char hex string.
  // 256 bits of entropy makes collision/guessing astronomically unlikely.
  const bytes = crypto.getRandomValues(new Uint8Array(REQUEST_TOKEN_BYTES));
  const plaintext = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  const hashed = hashSha256(plaintext);
  return { plaintext, hashed };
}
