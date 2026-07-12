import { beforeEach, describe, expect, mock, test } from "bun:test";

/**
 * Narrows an unknown value to a plain object record.
 * @param value - The value to test.
 * @returns True when `value` is a non-null object.
 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** A secret fixture the fake wasm client serves. */
interface SecretFixture {
  /** The secret id. */
  id: string;
  /** The secret key. */
  key: string;
  /** The secret value. */
  value: string;
  /** The secret note. */
  note?: string;
  /** The project the secret belongs to. */
  projectId?: string;
}

const ORGANIZATION_ID = "org-123";
const PROJECT_ID = "project-1";
const BASE_SECRETS: SecretFixture[] = [
  {
    id: "id-jwt",
    key: "JWT_SECRET",
    value: "jwt-value",
    note: "jwt note",
    projectId: PROJECT_ID,
  },
  {
    id: "id-db",
    key: "POSTGRES_PASSWORD",
    value: "db-value",
    note: "",
    projectId: PROJECT_ID,
  },
];

/** Mutable secret store the fake wasm client serves and mutates. */
let SECRETS: SecretFixture[] = [];

/** Shared spy state the fake wasm client records into. */
const harness = {
  /** Count of `secrets.list` commands run. */
  listCalls: 0,
  /** Count of `secrets.get` commands run, keyed by requested id. */
  getCalls: [] as string[],
  /** Count of `projects.list` commands run. */
  projectListCalls: 0,
  /** Project ids served by `projects.list`. */
  projectIds: [PROJECT_ID],
  /** Count of `client.free()` calls. */
  freed: 0,
  /** Auto-increment counter for created secret ids. */
  nextId: 1,
};

/**
 * Routes a JSON command string to a typed descriptor without `any`/`as`.
 * @param input - The JSON-encoded command.
 * @returns A descriptor of the command kind.
 */
function parseCommand(input: string):
  | { kind: "login"; token: string }
  | { kind: "list" }
  | { kind: "get"; id: string }
  | { kind: "projects-list" }
  | {
      kind: "create";
      key: string;
      value: string;
      note: string;
      projectIds: string[];
    }
  | {
      kind: "update";
      id: string;
      key: string;
      value: string;
      note: string;
      projectIds: string[];
    }
  | { kind: "delete"; ids: string[] }
  | { kind: "unknown" } {
  const cmd: unknown = JSON.parse(input);
  if (!isRecord(cmd)) {
    return { kind: "unknown" };
  }
  const login = cmd["accessTokenLogin"];
  if (isRecord(login) && typeof login["accessToken"] === "string") {
    return { kind: "login", token: login["accessToken"] };
  }
  const projects = cmd["projects"];
  if (isRecord(projects) && isRecord(projects["list"])) {
    return { kind: "projects-list" };
  }
  const secrets = cmd["secrets"];
  if (isRecord(secrets)) {
    if (isRecord(secrets["list"])) {
      return { kind: "list" };
    }
    const get = secrets["get"];
    if (isRecord(get) && typeof get["id"] === "string") {
      return { kind: "get", id: get["id"] };
    }
    const create = secrets["create"];
    if (
      isRecord(create) &&
      typeof create["key"] === "string" &&
      typeof create["value"] === "string" &&
      typeof create["note"] === "string" &&
      Array.isArray(create["projectIds"])
    ) {
      return {
        kind: "create",
        key: create["key"],
        value: create["value"],
        note: create["note"],
        projectIds: create["projectIds"].filter(
          (id): id is string => typeof id === "string",
        ),
      };
    }
    const update = secrets["update"];
    if (
      isRecord(update) &&
      typeof update["id"] === "string" &&
      typeof update["key"] === "string" &&
      typeof update["value"] === "string" &&
      typeof update["note"] === "string" &&
      Array.isArray(update["projectIds"])
    ) {
      return {
        kind: "update",
        id: update["id"],
        key: update["key"],
        value: update["value"],
        note: update["note"],
        projectIds: update["projectIds"].filter(
          (id): id is string => typeof id === "string",
        ),
      };
    }
    const del = secrets["delete"];
    if (isRecord(del) && Array.isArray(del["ids"])) {
      return {
        kind: "delete",
        ids: del["ids"].filter((id): id is string => typeof id === "string"),
      };
    }
  }
  return { kind: "unknown" };
}

/** A fake wasm-bindgen client returning canned Secrets Manager responses. */
class FakeClient {
  /**
   * @param _settings - Ignored JSON settings.
   * @param _logLevel - Ignored log level.
   */
  constructor(_settings?: string, _logLevel?: number) {}

  /**
   * Routes a JSON command to a canned response envelope.
   * @param input - The JSON-encoded command.
   * @returns The canned `{ success, data, errorMessage }` envelope.
   */
  async run_command(input: string): Promise<unknown> {
    const command = parseCommand(input);
    switch (command.kind) {
      case "login":
        return command.token === "bad-token"
          ? { success: false, errorMessage: "invalid access token" }
          : { success: true, data: null };
      case "list":
        harness.listCalls += 1;
        return {
          success: true,
          data: {
            data: SECRETS.map(({ id, key }) => ({
              id,
              key,
              organizationId: ORGANIZATION_ID,
            })),
          },
        };
      case "get": {
        harness.getCalls.push(command.id);
        const found = SECRETS.find((secret) => secret.id === command.id);
        return { success: true, data: found };
      }
      case "projects-list":
        harness.projectListCalls += 1;
        return {
          success: true,
          data: {
            data: harness.projectIds.map((id) => ({
              id,
              organizationId: ORGANIZATION_ID,
              name: `project-${id}`,
            })),
          },
        };
      case "create": {
        const created: SecretFixture = {
          id: `id-created-${harness.nextId++}`,
          key: command.key,
          value: command.value,
          note: command.note,
          projectId: command.projectIds[0],
        };
        SECRETS.push(created);
        return { success: true, data: created };
      }
      case "update": {
        const existing = SECRETS.find((secret) => secret.id === command.id);
        if (!existing) {
          return { success: false, errorMessage: "secret not found" };
        }
        existing.key = command.key;
        existing.value = command.value;
        existing.note = command.note;
        existing.projectId = command.projectIds[0];
        return { success: true, data: existing };
      }
      case "delete":
        SECRETS = SECRETS.filter((secret) => !command.ids.includes(secret.id));
        return {
          success: true,
          data: { data: command.ids.map((id) => ({ id, error: null })) },
        };
      default:
        return { success: false, errorMessage: "unknown command" };
    }
  }

  /** Records that the client was freed. */
  free(): void {
    harness.freed += 1;
  }
}

mock.module("../wasm", () => ({
  /** @returns A fake glue module exposing the fake client and log levels. */
  getBitwardenWasm: async (): Promise<{
    BitwardenClient: typeof FakeClient;
    LogLevel: { Error: number };
  }> => ({
    BitwardenClient: FakeClient,
    LogLevel: { Error: 4 },
  }),
}));

const { createBitwardenClient } = await import("../client");

describe("bitwarden/client.ts", () => {
  describe("createBitwardenClient", () => {
    beforeEach(() => {
      harness.listCalls = 0;
      harness.getCalls = [];
      harness.projectListCalls = 0;
      harness.projectIds = [PROJECT_ID];
      harness.freed = 0;
      harness.nextId = 1;
      SECRETS = BASE_SECRETS.map((secret) => ({ ...secret }));
    });

    test("resolves a secret value, listing once then getting by id", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      const value = await client.getSecretByKey({ key: "JWT_SECRET" });

      expect(value).toBe("jwt-value");
      expect(harness.listCalls).toBe(1);
      expect(harness.getCalls).toEqual(["id-jwt"]);
    });

    test("caches resolved values without re-listing or re-getting", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      await client.getSecretByKey({ key: "JWT_SECRET" });
      const second = await client.getSecretByKey({ key: "JWT_SECRET" });

      expect(second).toBe("jwt-value");
      expect(harness.listCalls).toBe(1);
      expect(harness.getCalls).toEqual(["id-jwt"]);
    });

    test("reuses the cached identifier map across different keys", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      await client.getSecretByKey({ key: "JWT_SECRET" });
      const db = await client.getSecretByKey({ key: "POSTGRES_PASSWORD" });

      expect(db).toBe("db-value");
      expect(harness.listCalls).toBe(1);
      expect(harness.getCalls).toEqual(["id-jwt", "id-db"]);
    });

    test("returns undefined for an unknown key without a get", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      const value = await client.getSecretByKey({ key: "DOES_NOT_EXIST" });

      expect(value).toBeUndefined();
      expect(harness.listCalls).toBe(1);
      expect(harness.getCalls).toEqual([]);
    });

    test("throws when the access-token login fails", async () => {
      await expect(
        createBitwardenClient({
          accessToken: "bad-token",
          organizationId: ORGANIZATION_ID,
        }),
      ).rejects.toThrow("invalid access token");
    });

    test("cleanup frees the wasm client and clears cached values", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      await client.getSecretByKey({ key: "JWT_SECRET" });
      client.cleanup();

      expect(harness.freed).toBe(1);
    });
  });

  describe("upsertSecretByKey", () => {
    beforeEach(() => {
      harness.listCalls = 0;
      harness.getCalls = [];
      harness.projectListCalls = 0;
      harness.projectIds = [PROJECT_ID];
      harness.freed = 0;
      harness.nextId = 1;
      SECRETS = BASE_SECRETS.map((secret) => ({ ...secret }));
    });

    test("creates a new secret under the sole project", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      const result = await client.upsertSecretByKey({
        key: "NEW_SECRET",
        value: "new-value",
      });

      expect(result).toEqual({ id: "id-created-1", created: true });
      expect(harness.projectListCalls).toBe(1);
      expect(SECRETS.find((secret) => secret.key === "NEW_SECRET")).toEqual({
        id: "id-created-1",
        key: "NEW_SECRET",
        value: "new-value",
        note: "",
        projectId: PROJECT_ID,
      });
    });

    test("creates under an explicit projectId without listing projects", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      const result = await client.upsertSecretByKey({
        key: "NEW_SECRET",
        value: "new-value",
        projectId: "project-explicit",
      });

      expect(result).toEqual({ id: "id-created-1", created: true });
      expect(harness.projectListCalls).toBe(0);
      expect(
        SECRETS.find((secret) => secret.key === "NEW_SECRET")?.projectId,
      ).toBe("project-explicit");
    });

    test("updates an existing secret, preserving its note and project", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      const result = await client.upsertSecretByKey({
        key: "JWT_SECRET",
        value: "rotated-value",
      });

      expect(result).toEqual({ id: "id-jwt", created: false });
      expect(SECRETS.find((secret) => secret.id === "id-jwt")).toEqual({
        id: "id-jwt",
        key: "JWT_SECRET",
        value: "rotated-value",
        note: "jwt note",
        projectId: PROJECT_ID,
      });
    });

    test("caches the written value so a follow-up get skips the network", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      await client.upsertSecretByKey({ key: "NEW_SECRET", value: "cached" });
      const value = await client.getSecretByKey({ key: "NEW_SECRET" });

      expect(value).toBe("cached");
      expect(harness.getCalls).toEqual([]);
    });

    test("throws when multiple projects exist and no projectId is given", async () => {
      harness.projectIds = [PROJECT_ID, "project-2"];
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      await expect(
        client.upsertSecretByKey({ key: "NEW_SECRET", value: "v" }),
      ).rejects.toThrow(/Multiple Bitwarden projects/);
    });

    test("throws when no project is accessible", async () => {
      harness.projectIds = [];
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      await expect(
        client.upsertSecretByKey({ key: "NEW_SECRET", value: "v" }),
      ).rejects.toThrow(/No Bitwarden project/);
    });
  });

  describe("deleteSecretByKey", () => {
    beforeEach(() => {
      harness.listCalls = 0;
      harness.getCalls = [];
      harness.projectListCalls = 0;
      harness.projectIds = [PROJECT_ID];
      harness.freed = 0;
      harness.nextId = 1;
      SECRETS = BASE_SECRETS.map((secret) => ({ ...secret }));
    });

    test("deletes an existing secret and returns true", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      const deleted = await client.deleteSecretByKey({ key: "JWT_SECRET" });

      expect(deleted).toBe(true);
      expect(
        SECRETS.find((secret) => secret.key === "JWT_SECRET"),
      ).toBeUndefined();
    });

    test("returns false for an unknown key", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      const deleted = await client.deleteSecretByKey({ key: "MISSING" });

      expect(deleted).toBe(false);
    });

    test("a deleted key resolves to undefined afterwards", async () => {
      const client = await createBitwardenClient({
        accessToken: "good-token",
        organizationId: ORGANIZATION_ID,
      });

      await client.getSecretByKey({ key: "JWT_SECRET" });
      await client.deleteSecretByKey({ key: "JWT_SECRET" });
      const value = await client.getSecretByKey({ key: "JWT_SECRET" });

      expect(value).toBeUndefined();
    });
  });
});
