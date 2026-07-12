/**
 * Groups items in an array by a key derived from each item.
 *
 * @param iterable - The array of items to group.
 * @param getKey - A function that extracts the grouping key from each item.
 * @returns A Map where each key maps to an array of items with that key.
 */
export function groupBy<T, K>(
  iterable: T[],
  getKey: (item: T) => K,
): Map<K, T[]> {
  return iterable.reduce((groupedItems, item) => {
    const groupedKey = getKey(item);
    return groupedItems.set(groupedKey, [
      ...(groupedItems.get(groupedKey) ?? []),
      item,
    ]);
  }, new Map<K, T[]>());
}
