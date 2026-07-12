import { ROLE_VALUES } from "@blueprint/enum-utils";
import { pgEnum } from "drizzle-orm/pg-core";

/** Enum for user roles (user, admin). */
export const roleEnum = pgEnum("role_enum", ROLE_VALUES);
