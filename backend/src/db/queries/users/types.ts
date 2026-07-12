import type { User, users } from "../../schema";
import type {
  GenericCreateOptions,
  GenericDeleteOptions,
  GenericFindOneOptions,
  GenericFindOptions,
  GenericUpdateOptions,
} from "../utils";

/** Options for creating user records. */
export type CreateUsersOptions = GenericCreateOptions<typeof users>;

/** Include options for finding users. */
export type UsersInclude = [];

/** Filter options for finding users. */
export type FindUsersOptions<
  T extends UsersInclude,
  K extends keyof User = keyof User,
  A extends string = string,
  AK extends keyof User = keyof User,
> = GenericFindOptions<User, T, K, A, AK>;

/** Filter options for finding a single user. */
export type FindOneUserOptions<T extends UsersInclude> = GenericFindOneOptions<
  User,
  T,
  keyof User
>;

/** Update options for users. */
export type UpdateUserOptions = GenericUpdateOptions<User>;

/** Delete options for users. */
export type DeleteUserOptions = GenericDeleteOptions<User>;
