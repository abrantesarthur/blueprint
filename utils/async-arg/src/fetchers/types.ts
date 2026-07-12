/** Interface for fetching raw string values from a source. */
export interface Fetcher {
  /**
   * Fetches a value by name from the source.
   * @param name - The name/key to fetch
   * @returns The raw string value, or undefined if not found
   */
  fetch(name: string): Promise<string | undefined>;

  /**
   * Clears any cached data held by this fetcher.
   * Optional - only implement if the fetcher uses caching.
   */
  cleanup: () => void;
}
