/**
 * Coerces an arbitrary string into a signed 32-bit integer using the FNV-1a
 * 32-bit hash. This is a lossy hash — suitable for Postgres advisory-lock
 * keys but not for anything requiring uniqueness.
 * @param value - The string to hash (e.g., a phone number like "+5538998601275").
 * @returns A signed 32-bit integer in the range [-2^31, 2^31 - 1].
 */
export function stringToInt32(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash | 0;
}
