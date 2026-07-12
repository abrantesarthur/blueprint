import { drizzle } from "drizzle-orm/bun-sql";

import * as schema from "../db/schema";

/** Test database configuration constants. */
export const TEST_DB = {
  HOST: "localhost",
  PORT: 5433,
  NAME: "blueprint_test",
  USER: "test_user",
  PASSWORD: "test_password",
} as const;

/** Test database connection URL. */
export const TEST_DATABASE_URL = `postgresql://${TEST_DB.USER}:${TEST_DB.PASSWORD}@${TEST_DB.HOST}:${TEST_DB.PORT}/${TEST_DB.NAME}`;

/**
 * Creates a test database client.
 * @returns A configured Drizzle database instance.
 */
export function createTestDb(): ReturnType<typeof drizzle<typeof schema>> {
  return drizzle(TEST_DATABASE_URL, {
    schema,
    casing: "snake_case",
  });
}

/** The test Drizzle database client instance type. */
export type TestDatabase = ReturnType<typeof createTestDb>;
