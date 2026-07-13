# @blueprint/crypto-utils

Small, dependency-free cryptographic helpers built on the Web Crypto / Node
`crypto` primitives.

- `aesGcm` — AES-256-GCM encrypt/decrypt (encryption at rest).
- `hashSha256` — SHA-256 hashing.
- `hmacSha256Hex` — HMAC-SHA256, hex-encoded (e.g. webhook signature verification).
- `timingSafeEqual` — constant-time comparison to avoid timing attacks.
