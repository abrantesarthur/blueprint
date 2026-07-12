/**
 * Compares two equal-length strings in constant time. Falls back to a fast
 * `false` when lengths differ — leaking only the length bound, never the
 * contents.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns True if the strings have equal length and equal contents.
 */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}
