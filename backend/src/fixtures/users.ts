import type { Role } from "@blueprint/enum-utils";

import type { NewUser } from "../db";
import {
  Entity,
  FIRST_NAMES,
  LAST_NAMES,
  makeEmail,
  makeId,
  makePhone,
  pick,
} from "./helpers";

let userIndex = 0;

/** Number of regular (non-admin) users to generate for dev seeding. */
const REGULAR_USER_COUNT = 10;

/**
 * Generates a user record for a given role.
 * @param role - User role.
 * @returns A new user record.
 */
function generateUser(role: Role): NewUser {
  userIndex++;
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);

  return {
    id: makeId(Entity.User, userIndex),
    email: makeEmail(firstName, lastName, userIndex),
    firstName,
    lastName,
    phone: makePhone(userIndex),
    phoneVerified: true,
    role,
  };
}

/** All generated user records for dev seeding. */
export const users: NewUser[] = [];

for (let i = 0; i < REGULAR_USER_COUNT; i++) {
  users.push(generateUser("user"));
}

// Generate 1 admin user
users.push(generateUser("admin"));
