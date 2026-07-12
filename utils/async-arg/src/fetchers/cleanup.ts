import { bwsFetcher } from "./bwsFetcher";
import { envFetcher } from "./envFetcher";
import type { Fetcher } from "./types";

/** All registered fetchers. */
const fetchers: Fetcher[] = [bwsFetcher, envFetcher];

/**
 * Clears all fetcher caches.
 * Call after loading all required config to avoid keeping
 * unnecessary data in memory.
 */
export function cleanup(): void {
  for (const fetcher of fetchers) {
    fetcher.cleanup?.();
  }
}
