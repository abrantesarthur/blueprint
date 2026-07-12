import type { Fetcher } from "./types";

/** Fetcher implementation for environment variables. */
export const envFetcher: Fetcher = {
  async fetch(name: string): Promise<string | undefined> {
    return Bun.env[name];
  },
  cleanup: () => {},
};
