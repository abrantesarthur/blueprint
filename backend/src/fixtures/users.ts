import type { NewUser } from "../db";
import {
  Entity,
  FIRST_NAMES,
  LAST_NAMES,
  makeEmail,
  makeId,
  pick,
} from "./helpers";

let userIndex = 0;

/** Number of users to generate for dev seeding. */
const USER_COUNT = 10;

/**
 * Generates a user record.
 * @returns A new user record.
 */
function generateUser(): NewUser {
  userIndex++;
  const firstName = pick(FIRST_NAMES);
  const lastName = pick(LAST_NAMES);

  return {
    id: makeId(Entity.User, userIndex),
    email: makeEmail(firstName, lastName, userIndex),
    firstName,
    lastName,
  };
}

/** All generated user records for dev seeding. */
export const users: NewUser[] = [];

for (let i = 0; i < USER_COUNT; i++) {
  users.push(generateUser());
}
