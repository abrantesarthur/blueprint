import { Secret } from "@transcend-io/secret-value";
import { mock } from "bun:test";

import { createTestDb, TEST_DATABASE_URL } from "./db";

/**
 * Test database instance created in preload.
 * Exported so setup.ts can re-export it for test files.
 */
export const testDb = createTestDb();

/**
 * Mock the db client module BEFORE any test file imports.
 * This ensures all service files use the test database. `closeDb` is a
 * no-op: the test runner owns the test database's lifecycle.
 */
mock.module("../db/client.ts", () => ({
  db: testDb,
  closeDb: async (): Promise<void> => {},
}));

/**
 * Mock the config module to avoid loading env from Bitwarden.
 * This prevents jwt.ts and other modules from triggering loadEnv().
 */
mock.module("../config/index.ts", () => ({
  env: {
    DATABASE_URL: new Secret(TEST_DATABASE_URL),
    JWT_SECRET: new Secret("test-jwt-secret-at-least-32-chars"),
    RUNTIME_ENVIRONMENT: "test",
    PORT: 3000,
    LOG_LEVEL: "silent",
    TRUST_PROXY: false,
    CLOUDFLARE_TUNNEL_TOKEN: new Secret(""),
    CLOUDFLARE_TUNNEL_HOSTNAME: "",
  },
}));
