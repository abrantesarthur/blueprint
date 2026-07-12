/**
 * Coerces a UUID into a signed 32-bit integer by taking the first 8 hex chars
 * and casting to Int32. This is a lossy hash (96 bits discarded) — suitable
 * for Postgres advisory-lock keys but not for anything requiring uniqueness.
 * @param uuid - The UUID string (with or without hyphens).
 * @returns A signed 32-bit integer in the range [-2^31, 2^31 - 1].
 */
export function uuidToInt32(uuid: string): number {
  return parseInt(uuid.replace(/-/g, "").slice(0, 8), 16) | 0;
}
