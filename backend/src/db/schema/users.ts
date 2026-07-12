import { E164_PHONE_PATTERN, NO_DIGITS_PATTERN } from "@blueprint/api-utils";
import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { roleEnum } from "./enums";
import { timestamps } from "./helpers";

/** Users table - stores user and admin accounts. */
export const users = pgTable(
  "users",
  {
    id: uuid().primaryKey().defaultRandom(),
    email: varchar({ length: 255 }).unique(),
    firstName: varchar({ length: 100 }).notNull(),
    lastName: varchar({ length: 100 }).notNull(),
    phone: varchar({ length: 16 }).unique().notNull(),
    phoneVerified: boolean().default(false).notNull(),
    role: roleEnum().default("user").notNull(),
    otpRequestedAt: timestamp({ precision: 3 }),
    ...timestamps,
  },
  (table) => [
    check(
      "first_name_no_digits",
      sql`${table.firstName} ~ '${sql.raw(NO_DIGITS_PATTERN)}'`,
    ),
    check(
      "last_name_no_digits",
      sql`${table.lastName} ~ '${sql.raw(NO_DIGITS_PATTERN)}'`,
    ),
    check(
      "phone_format",
      sql`${table.phone} ~ '${sql.raw(E164_PHONE_PATTERN)}'`,
    ),
  ],
);

/** A user record retrieved from the database. */
export type User = typeof users.$inferSelect;

/** Data required to create a new user record. */
export type NewUser = typeof users.$inferInsert;
