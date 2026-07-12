import { type BitwardenWasm, getBitwardenWasm } from "./wasm";

/** An instance of the low-level wasm-bindgen client. */
type WasmClient = InstanceType<BitwardenWasm["BitwardenClient"]>;

/** A minimal Bitwarden Secrets Manager client backed by the embedded wasm SDK. */
export interface BitwardenSecretsClient {
  /**
   * Resolves a secret's plaintext value by its key, or `undefined` when no
   * secret with that key is accessible to the authenticated machine account.
   * Identifiers and resolved values are cached for the client's lifetime.
   * @param args - The lookup arguments.
   * @param args.key - The secret key (e.g. `"JWT_SECRET"`).
   * @returns The secret value, or `undefined` if not found.
   */
  getSecretByKey(args: {
    /** The secret key to resolve. */
    key: string;
  }): Promise<string | undefined>;
  /**
   * Creates or updates a secret by its key. Updates preserve the secret's
   * existing project assignment and note; creates require a project, resolved
   * to the organization's sole project unless `projectId` is given.
   * @param args - The upsert arguments.
   * @returns The secret id and whether it was newly created.
   */
  upsertSecretByKey(args: {
    /** The secret key to create or update. */
    key: string;
    /** The plaintext value to store. */
    value: string;
    /** Optional note; preserved on update when omitted. */
    note?: string;
    /** Project to create the secret under; defaults to the sole project. */
    projectId?: string;
  }): Promise<{
    /** The Bitwarden secret id. */
    id: string;
    /** True when the secret did not exist and was created. */
    created: boolean;
  }>;
  /**
   * Deletes a secret by its key.
   * @param args - The delete arguments.
   * @returns True when a secret was deleted, false when no such key exists.
   */
  deleteSecretByKey(args: {
    /** The secret key to delete. */
    key: string;
  }): Promise<boolean>;
  /** Clears cached secrets and frees the underlying wasm client. */
  cleanup(): void;
}

/**
 * Narrows an unknown value to a plain object record.
 * @param value - The value to test.
 * @returns True when `value` is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Runs a JSON command and unwraps the `{ success, data, errorMessage }` envelope.
 * @param client - The low-level wasm client.
 * @param command - The command object to JSON-encode and run.
 * @returns The command's `data` payload.
 * @throws Error when the SDK reports failure or returns an unexpected shape.
 */
async function runCommand(
  client: WasmClient,
  command: unknown,
): Promise<unknown> {
  const result = await client.run_command(JSON.stringify(command));
  const raw: unknown = typeof result === "string" ? JSON.parse(result) : result;
  if (!isRecord(raw)) {
    throw new Error("Unexpected Bitwarden response shape.");
  }
  if (raw["success"] === false) {
    const message = raw["errorMessage"];
    throw new Error(
      typeof message === "string" ? message : "Bitwarden command failed.",
    );
  }
  return raw["data"];
}

/**
 * Extracts a `key → id` map from a `secrets.list` response payload.
 * @param data - The unwrapped `secrets.list` payload.
 * @returns A map of secret key to secret id.
 * @throws Error when the payload is not the expected identifier list.
 */
function decodeIdentifiers(data: unknown): Map<string, string> {
  if (!isRecord(data) || !Array.isArray(data["data"])) {
    throw new Error("Unexpected Bitwarden secrets.list response.");
  }
  const map = new Map<string, string>();
  for (const item of data["data"]) {
    if (!isRecord(item)) {
      throw new Error("Unexpected Bitwarden secret identifier.");
    }
    const id = item["id"];
    const key = item["key"];
    if (typeof id !== "string" || typeof key !== "string") {
      throw new Error("Unexpected Bitwarden secret identifier.");
    }
    map.set(key, id);
  }
  return map;
}

/**
 * Extracts the plaintext value from a `secrets.get` response payload.
 * @param data - The unwrapped `secrets.get` payload.
 * @returns The secret's plaintext value.
 * @throws Error when the payload has no string `value`.
 */
function decodeSecretValue(data: unknown): string {
  if (!isRecord(data) || typeof data["value"] !== "string") {
    throw new Error("Unexpected Bitwarden secrets.get response.");
  }
  return data["value"];
}

/** A full secret record as returned by `secrets.get`/`create`/`update`. */
interface SecretRecord {
  /** The secret id. */
  id: string;
  /** The secret's plaintext value. */
  value: string;
  /** The secret's note. */
  note: string;
  /** The project the secret belongs to, when assigned. */
  projectId?: string;
}

/**
 * Extracts a full secret record from a `secrets.get`/`create`/`update`
 * response payload.
 * @param data - The unwrapped secret payload.
 * @returns The decoded secret record.
 * @throws Error when the payload is not the expected secret shape.
 */
function decodeSecretRecord(data: unknown): SecretRecord {
  if (
    !isRecord(data) ||
    typeof data["id"] !== "string" ||
    typeof data["value"] !== "string"
  ) {
    throw new Error("Unexpected Bitwarden secret response.");
  }
  return {
    id: data["id"],
    value: data["value"],
    note: typeof data["note"] === "string" ? data["note"] : "",
    ...(typeof data["projectId"] === "string"
      ? { projectId: data["projectId"] }
      : {}),
  };
}

/**
 * Extracts the project ids from a `projects.list` response payload.
 * @param data - The unwrapped `projects.list` payload.
 * @returns The accessible project ids.
 * @throws Error when the payload is not the expected project list.
 */
function decodeProjectIds(data: unknown): string[] {
  if (!isRecord(data) || !Array.isArray(data["data"])) {
    throw new Error("Unexpected Bitwarden projects.list response.");
  }
  return data["data"].map((item) => {
    if (!isRecord(item) || typeof item["id"] !== "string") {
      throw new Error("Unexpected Bitwarden project identifier.");
    }
    return item["id"];
  });
}

/**
 * Creates an authenticated Bitwarden Secrets Manager client.
 *
 * Logs in with the machine-account access token, then resolves secrets lazily:
 * the identifier list is fetched once (cached as `key → id`), and each value is
 * fetched on demand and cached.
 *
 * IMPORTANT: construct at most ONE client per process. The embedded WASM SDK
 * initializes a process-global logger inside its constructor, and that logger
 * can only be set once — a second construction (even after the first is freed)
 * panics with `SetLoggerError`. Share a single client for all reads and writes
 * rather than creating one per operation, and don't mix a direct client with
 * the AsyncArg `bwsFetcher`, which constructs its own.
 * @param args - The client configuration.
 * @param args.accessToken - The Bitwarden machine-account access token.
 * @param args.organizationId - The organization id whose secrets to list.
 * @returns An authenticated {@link BitwardenSecretsClient}.
 */
export async function createBitwardenClient({
  accessToken,
  organizationId,
}: {
  /** The Bitwarden machine-account access token. */
  accessToken: string;
  /** The organization id whose secrets to list. */
  organizationId: string;
}): Promise<BitwardenSecretsClient> {
  const wasm = await getBitwardenWasm();
  const client = new wasm.BitwardenClient(
    JSON.stringify({}),
    wasm.LogLevel["Error"],
  );

  await runCommand(client, { accessTokenLogin: { accessToken } });

  let secretIdMap: Map<string, string> | undefined;
  const values = new Map<string, string>();

  /**
   * Lazily fetches and caches the `key → id` identifier map.
   * @returns The cached identifier map.
   */
  async function getSecretIdMap(): Promise<Map<string, string>> {
    if (!secretIdMap) {
      const data = await runCommand(client, {
        secrets: { list: { organizationId } },
      });
      // eslint-disable-next-line require-atomic-updates -- benign: concurrent calls resolve to an identical identifier map
      secretIdMap = decodeIdentifiers(data);
    }
    return secretIdMap;
  }

  /**
   * Resolves the project a new secret should be created under: the explicit
   * `projectId` when given, otherwise the organization's sole project.
   * @param projectId - The explicit project id, if any.
   * @returns The resolved project id.
   * @throws Error when no project is accessible or the choice is ambiguous.
   */
  async function resolveProjectId(projectId?: string): Promise<string> {
    if (projectId !== undefined) {
      return projectId;
    }
    const ids = decodeProjectIds(
      await runCommand(client, { projects: { list: { organizationId } } }),
    );
    if (ids.length === 0) {
      throw new Error(
        "No Bitwarden project is accessible to this machine account; cannot create a secret.",
      );
    }
    const [first] = ids;
    if (ids.length > 1 || first === undefined) {
      throw new Error(
        "Multiple Bitwarden projects are accessible; pass an explicit projectId.",
      );
    }
    return first;
  }

  return {
    async getSecretByKey({
      key,
    }: {
      key: string;
    }): Promise<string | undefined> {
      const cached = values.get(key);
      if (cached !== undefined) {
        return cached;
      }
      const id = (await getSecretIdMap()).get(key);
      if (id === undefined) {
        return undefined;
      }
      const value = decodeSecretValue(
        await runCommand(client, { secrets: { get: { id } } }),
      );
      values.set(key, value);
      return value;
    },
    async upsertSecretByKey({
      key,
      value,
      note,
      projectId,
    }: {
      key: string;
      value: string;
      note?: string;
      projectId?: string;
    }): Promise<{ id: string; created: boolean }> {
      const ids = await getSecretIdMap();
      const existingId = ids.get(key);

      let record: SecretRecord;
      let created: boolean;
      if (existingId !== undefined) {
        const existing = decodeSecretRecord(
          await runCommand(client, { secrets: { get: { id: existingId } } }),
        );
        record = decodeSecretRecord(
          await runCommand(client, {
            secrets: {
              update: {
                id: existingId,
                organizationId,
                key,
                value,
                note: note ?? existing.note,
                projectIds:
                  projectId !== undefined
                    ? [projectId]
                    : existing.projectId !== undefined
                      ? [existing.projectId]
                      : [],
              },
            },
          }),
        );
        created = false;
      } else {
        record = decodeSecretRecord(
          await runCommand(client, {
            secrets: {
              create: {
                organizationId,
                key,
                value,
                note: note ?? "",
                projectIds: [await resolveProjectId(projectId)],
              },
            },
          }),
        );
        created = true;
      }

      ids.set(key, record.id);
      values.set(key, value);
      return { id: record.id, created };
    },
    async deleteSecretByKey({ key }: { key: string }): Promise<boolean> {
      const ids = await getSecretIdMap();
      const id = ids.get(key);
      if (id === undefined) {
        return false;
      }
      await runCommand(client, { secrets: { delete: { ids: [id] } } });
      ids.delete(key);
      values.delete(key);
      return true;
    },
    cleanup(): void {
      secretIdMap = undefined;
      values.clear();
      client.free();
    },
  };
}
