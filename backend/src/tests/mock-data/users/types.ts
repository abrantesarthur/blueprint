/** Explicitly defined fields we care about in user fixtures. */
export interface MockUser {
  /** Unique identifier. */
  id: string;
  /** Email address, or null when the user has none. */
  email: string | null;
  /** First name. */
  firstName: string;
  /** Last name. */
  lastName: string;
}
