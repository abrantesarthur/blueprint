/**
 * A typed version of Object.fromEntries that preserves key and value types.
 *
 * @param entries - An array of [key, value] tuples to convert into an object.
 * @returns An object with proper key and value types.
 */
export function fromEntries<K extends string, V>(
  entries: [K, V][],
): Record<K, V> {
  return Object.fromEntries(entries) as Record<K, V>;
}
