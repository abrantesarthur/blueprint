import {
  type BitwardenSecretsClient,
  createBitwardenClient,
} from "@blueprint/bitwarden-utils";

import type { Fetcher } from "./types";

/**
 * Cached client promise so concurrent/repeated fetches share a single login +
 * secret list. Reset by {@link bwsFetcher.cleanup}.
 */
let clientPromise: Promise<BitwardenSecretsClient> | undefined;

/**
 * Lazily creates the Bitwarden client from bootstrap env values.
 *
 * `BWS_ACCESS_TOKEN` / `BWS_ORGANIZATION_ID` are read from `process.env`
 * directly: they must exist before any Bitwarden fetching can happen, and
 * importing them from the backend's `env.ts` would create a circular dependency
 * (bwsFetcher → env → loadEnv → bwsFetcher).
 * @returns The authenticated Bitwarden secrets client.
 * @throws Error when the bootstrap env values are missing.
 */
function getClient(): Promise<BitwardenSecretsClient> {
  if (!clientPromise) {
    const accessToken = process.env["BWS_ACCESS_TOKEN"];
    const organizationId = process.env["BWS_ORGANIZATION_ID"];
    if (!accessToken) {
      throw new Error("BWS_ACCESS_TOKEN is not set.");
    }
    if (!organizationId) {
      throw new Error("BWS_ORGANIZATION_ID is not set.");
    }
    clientPromise = createBitwardenClient({
      accessToken,
      organizationId,
    });
  }
  return clientPromise;
}

/**
 * Fetcher implementation for Bitwarden secrets, backed by the embedded WASM SDK
 * (`@blueprint/bitwarden-utils`). Requires `BWS_ACCESS_TOKEN` and
 * `BWS_ORGANIZATION_ID` to be set in the environment.
 */
export const bwsFetcher: Fetcher = {
  async fetch(name: string): Promise<string | undefined> {
    const client = await getClient();
    return client.getSecretByKey({ key: name });
  },

  cleanup(): void {
    if (clientPromise) {
      const pending = clientPromise;
      clientPromise = undefined;
      void pending.then((client) => client.cleanup()).catch(() => {});
    }
  },
};
