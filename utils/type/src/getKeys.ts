/**
 * A typed version of Object.keys that preserves key types.
 *
 * @param obj - The object to get keys from.
 * @returns An array of keys with proper types.
 */
export function getKeys<K extends string>(obj: Record<K, unknown>): K[] {
  return Object.keys(obj) as K[];
}
