import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Application-level AES-256-GCM encryption for values stored at rest.
 *
 * The wire format is `base64(iv ‖ ciphertext ‖ authTag)`, which keeps the iv
 * and GCM authentication tag self-contained in the stored string. Callers own
 * key management (loading, rotation); these helpers only encrypt/decrypt with a
 * 32-byte key handed in.
 */

/** AES-256-GCM cipher identifier. */
const ALGORITHM = "aes-256-gcm";
/** AES-256 key length in bytes. */
const KEY_LENGTH = 32;
/** Recommended GCM initialization-vector length in bytes. */
const IV_LENGTH = 12;
/** GCM authentication-tag length in bytes. */
const AUTH_TAG_LENGTH = 16;

/**
 * Decodes and validates a base64-encoded AES-256 key.
 * @param base64Key - The base64-encoded 32-byte key.
 * @returns The decoded 32-byte key buffer.
 * @throws Error when the decoded key is not exactly 32 bytes.
 */
export function decodeAes256Key(base64Key: string): Buffer {
  const key = Buffer.from(base64Key, "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error(
      `AES-256 key must decode to ${KEY_LENGTH} bytes, got ${key.length}`,
    );
  }
  return key;
}

/**
 * Encrypts a value for storage at rest with AES-256-GCM.
 * @param args - The encrypt arguments.
 * @param args.plaintext - The cleartext value to encrypt.
 * @param args.key - The 32-byte AES-256 key from {@link decodeAes256Key}.
 * @returns Base64-encoded `iv ‖ ciphertext ‖ authTag` payload.
 */
export function encryptAesGcm({
  plaintext,
  key,
}: {
  /** The cleartext value to encrypt. */
  plaintext: string;
  /** The 32-byte AES-256 key. */
  key: Buffer;
}): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString("base64");
}

/**
 * Decrypts a value previously produced by {@link encryptAesGcm}.
 * @param args - The decrypt arguments.
 * @param args.ciphertext - Base64-encoded `iv ‖ ciphertext ‖ authTag` payload.
 * @param args.key - The 32-byte AES-256 key from {@link decodeAes256Key}.
 * @returns The decrypted cleartext value.
 * @throws Error when the payload is malformed or the GCM tag fails to authenticate.
 */
export function decryptAesGcm({
  ciphertext,
  key,
}: {
  /** Base64-encoded `iv ‖ ciphertext ‖ authTag` payload. */
  ciphertext: string;
  /** The 32-byte AES-256 key. */
  key: Buffer;
}): string {
  const payload = Buffer.from(ciphertext, "base64");
  if (payload.length < IV_LENGTH + AUTH_TAG_LENGTH) {
    throw new Error("AES-256-GCM payload is too short to be valid");
  }

  const iv = payload.subarray(0, IV_LENGTH);
  const authTag = payload.subarray(payload.length - AUTH_TAG_LENGTH);
  const data = payload.subarray(IV_LENGTH, payload.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}
