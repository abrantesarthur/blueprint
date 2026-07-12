import { E164_PHONE_PATTERN } from "@blueprint/api-utils";
import { sql } from "drizzle-orm";
import {
  check,
  integer,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { timestamps } from "./helpers";

/** OTP codes table - stores verification codes for phone authentication. */
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: uuid().primaryKey().defaultRandom(),
    phone: varchar({ length: 16 }).notNull().unique(),
    code: varchar({ length: 64 }).notNull(),
    requestToken: varchar({ length: 64 }).notNull(),
    expiresAt: timestamp({ precision: 3 }).notNull(),
    attempts: integer().notNull().default(0),
    ...timestamps,
  },
  (table) => [
    check(
      "otp_phone_format",
      sql`${table.phone} ~ '${sql.raw(E164_PHONE_PATTERN)}'`,
    ),
  ],
);

/** An OTP code record retrieved from the database. */
export type OtpCode = typeof otpCodes.$inferSelect;

/** Data required to create a new OTP code record. */
export type NewOtpCode = typeof otpCodes.$inferInsert;
