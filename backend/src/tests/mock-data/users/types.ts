import type { Role } from "@blueprint/enum-utils";

/** Explicitly defined fields we care about in user fixtures. */
export interface MockUser {
  /** Unique identifier. */
  id: string;
  /** Email address. */
  email: string;
  /** First name. */
  firstName: string;
  /** Last name. */
  lastName: string;
  /** Phone number in E.164 format. */
  phone: string;
  /** User role. */
  role: Role;
}
