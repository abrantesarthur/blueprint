import { randomBytes } from "node:crypto";

import { describe, expect, test } from "bun:test";

import { decodeAes256Key, decryptAesGcm, encryptAesGcm } from "../aesGcm";

describe("crypto/aesGcm.ts", () => {
  const key = randomBytes(32);

  describe("decodeAes256Key", () => {
    test("decodes a base64-encoded 32-byte key", () => {
      const base64Key = randomBytes(32).toString("base64");
      expect(decodeAes256Key(base64Key)).toHaveLength(32);
    });

    test("rejects a key that does not decode to 32 bytes", () => {
      const shortKey = randomBytes(16).toString("base64");
      expect(() => decodeAes256Key(shortKey)).toThrow(
        "AES-256 key must decode to 32 bytes, got 16",
      );
    });
  });

  describe("encryptAesGcm / decryptAesGcm", () => {
    test("round-trips a value back to the original plaintext", () => {
      const plaintext = "EAAG-long-lived-access-token-value";
      const ciphertext = encryptAesGcm({ plaintext, key });

      expect(decryptAesGcm({ ciphertext, key })).toBe(plaintext);
    });

    test("produces ciphertext that differs from the plaintext", () => {
      const plaintext = "EAAG-long-lived-access-token-value";
      const ciphertext = encryptAesGcm({ plaintext, key });

      expect(ciphertext).not.toBe(plaintext);
      expect(ciphertext).not.toContain(plaintext);
    });

    test("produces a different ciphertext each call (random iv)", () => {
      const plaintext = "EAAG-long-lived-access-token-value";

      expect(encryptAesGcm({ plaintext, key })).not.toBe(
        encryptAesGcm({ plaintext, key }),
      );
    });

    test("fails GCM authentication when the ciphertext is tampered with", () => {
      const ciphertext = encryptAesGcm({ plaintext: "secret", key });
      const bytes = Buffer.from(ciphertext, "base64");
      const lastIndex = bytes.length - 1;
      bytes[lastIndex] = bytes[lastIndex]! ^ 0xff;
      const tampered = bytes.toString("base64");

      expect(() => decryptAesGcm({ ciphertext: tampered, key })).toThrow();
    });

    test("fails to decrypt with a different key", () => {
      const ciphertext = encryptAesGcm({ plaintext: "secret", key });

      expect(() =>
        decryptAesGcm({ ciphertext, key: randomBytes(32) }),
      ).toThrow();
    });

    test("rejects a payload shorter than the iv + auth tag", () => {
      const tooShort = randomBytes(8).toString("base64");

      expect(() => decryptAesGcm({ ciphertext: tooShort, key })).toThrow(
        "AES-256-GCM payload is too short to be valid",
      );
    });
  });
});
