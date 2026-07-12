import { customType, timestamp } from "drizzle-orm/pg-core";

/**
 * A custom `time` column that normalizes the value to `HH:MM` format on read.
 * PostgreSQL returns `time` values with seconds (e.g., `"08:00:00"`); this
 * strips them so the application always sees `"08:00"`.
 */
export const hhmmTime = customType<{ data: string }>({
  dataType() {
    return "time";
  },
  fromDriver(value: unknown): string {
    return (value as string).slice(0, 5);
  },
});

/**
 * A `jsonb` column that stores objects correctly under the `bun-sql` driver.
 *
 * Drizzle's built-in `jsonb()` JSON-stringifies the value before binding and
 * Bun's SQL driver stringifies again, producing a double-encoded JSON *string*
 * that raw jsonb operators (`->>`, `@>`) can't read (the ORM hides this by
 * symmetrically double-decoding on read). Passing the value through unchanged
 * lets Bun serialize it exactly once, so the column holds a real jsonb object.
 *
 * The emitted DDL type is identical to `jsonb()`, so swapping to this type
 * needs no migration. Narrow the stored shape with `.$type<T>()` at the call
 * site, exactly as with the built-in `jsonb()`.
 */
export const jsonbObject = customType<{ data: unknown }>({
  dataType() {
    return "jsonb";
  },
  toDriver(value: unknown): unknown {
    return value;
  },
});

/**
 * Common timestamp columns for database tables.
 * Includes createdAt (set on insert) and updatedAt (auto-updated on changes).
 */
export const timestamps = {
  createdAt: timestamp({ precision: 3 }).notNull().defaultNow(),
  updatedAt: timestamp({ precision: 3 })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};
