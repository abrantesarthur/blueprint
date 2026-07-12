/**
 * Builds a Map keyed by the result of `getKey` for O(1) lookup by key.
 * Later items with the same key overwrite earlier ones.
 *
 * @param iterable - The array of items to index.
 * @param getKey - A function that extracts the key from each item.
 * @returns A Map from key to item.
 */
export function indexBy<T, K>(
  iterable: T[],
  getKey: (item: T) => K,
): Map<K, T> {
  return new Map(iterable.map((item) => [getKey(item), item]));
}
