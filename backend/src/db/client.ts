import { drizzle } from "drizzle-orm/bun-sql";

import { env } from "../config";
import * as schema from "./schema";

export const db = drizzle({
  connection: {
    url: env.DATABASE_URL.release(),
    tls: env.DATABASE_SSL,
  },
  schema,
  casing: "snake_case",
});

/** The Drizzle database client instance type. */
export type Database = typeof db;

/** Transaction type for use in functions that accept an optional transaction. */
export type Transaction = Parameters<Database["transaction"]>[0] extends (
  tx: infer T,
) => unknown
  ? T
  : never;
