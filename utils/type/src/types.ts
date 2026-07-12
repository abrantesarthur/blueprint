/** Extracts only the required keys from a type. */
export type RequiredKeys<T> = {
  [K in keyof T]-?: undefined extends T[K] ? never : K;
}[keyof T];

/**
 * Requires at least one property from T to be present with a non-undefined value.
 * Useful for update operations where at least one value must be provided.
 */
export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<
  T,
  Exclude<keyof T, Keys>
> &
  {
    [K in Keys]-?: { [P in K]-?: NonNullable<T[P]> } & Partial<
      Pick<T, Exclude<Keys, K>>
    >;
  }[Keys];

/** Array type that requires at least one element. */
export type NonEmptyArray<T> = [T, ...T[]];

/**
 * Makes specific fields of T required while keeping others unchanged.
 *
 * @example
 * type User = { id: string; name?: string; email?: string }
 * type UserWithName = RequiredField<User, 'name'>
 * // { id: string; name: string; email?: string }
 */
export type RequiredField<T, K extends keyof T> = Omit<T, K> &
  Required<Pick<T, K>>;
