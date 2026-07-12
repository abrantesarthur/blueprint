/**
 * Returns a new array with duplicates removed, determined by a key derived from each item.
 * The first occurrence of each key is kept.
 *
 * @param iterable - The array of items to deduplicate.
 * @param getKey - A function that extracts the uniqueness key from each item.
 * @returns A new array containing only the first item for each unique key.
 */
export function uniqueBy<T, K>(iterable: T[], getKey: (item: T) => K): T[] {
  const seen = new Set<K>();

  return iterable.filter((item) => {
    const key = getKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
