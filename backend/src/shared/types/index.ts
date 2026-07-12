export type { AuthUser } from "@blueprint/api-utils";

/** Input parameters for offset-based pagination. */
export interface PaginationInput {
  /** Maximum number of items to return. */
  limit?: number;
  /** Number of items to skip. */
  offset?: number;
}
