import type { User } from "../../schema";

/**
 * Equality filters for selecting user rows.
 * All provided fields are combined with AND.
 */
export interface UserWhere {
  /** Match by the user's unique identifier. */
  id?: string;
  /** Match by email address. Pass `null` to match users without an email. */
  email?: string | null;
  /** Match by first name. */
  firstName?: string;
  /** Match by last name. */
  lastName?: string;
}

/** Sort specification for user queries. */
export interface UserOrderBy {
  /** The user column to sort by. */
  column: keyof User;
  /** The sort direction. */
  direction: "asc" | "desc";
}

/** Mutable user columns accepted by `updateUsers`. */
export type UserUpdateValues = Partial<
  Pick<User, "email" | "firstName" | "lastName">
>;
