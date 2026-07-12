/**
 * A typed version of Object.entries that preserves key and value types.
 *
 * @param obj - The object to get entries from.
 * @returns An array of [key, value] tuples with proper types.
 */
export function getEntries<K extends string, V>(obj: Record<K, V>): [K, V][] {
  return Object.entries(obj) as [K, V][];
}
