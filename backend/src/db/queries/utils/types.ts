import type { NonEmptyArray, RequireAtLeastOne } from "@blueprint/type-utils";
import { SQL, type Table } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";

import type { PaginationInput } from "../../../shared/types";
import type { Transaction } from "../../client";
import type { User, users } from "../../schema/users";

/** Comparison operator for filters. */
type FilterOperator =
  | "eq"
  | "gte"
  | "lte"
  | "gt"
  | "lt"
  | "ne"
  | "in"
  | "contains"
  | "overlaps";

/** Explicit filter with operator and value. */
type ExplicitFilter<T> =
  | {
      /** The values to check membership against. */
      value: T[];
      /** The set-membership operator. */
      operator: "in";
    }
  | {
      /** The value to compare against. */
      value: T;
      /** The comparison operator to apply. */
      operator: Exclude<FilterOperator, "in">;
    };

/**
 * Having option for filtering grouped/aggregated results.
 * Keys can be aggregate aliases (always number) or grouped entity column keys (typed per column).
 *
 * If an aggregate alias collides with an entity column name, the column type takes
 * precedence (the alias is excluded from the aggregate side via `Exclude`).
 *
 * @template Entity - The entity type.
 * @template A - The aggregate alias literal type(s).
 * @template K - The groupBy column keys.
 */
export type HavingOption<
  Entity,
  A extends string = string,
  K extends keyof Entity = never,
> = { [P in Exclude<A, keyof Entity>]?: ExplicitFilter<number> } & {
  [P in K]?: ExplicitFilter<Entity[P]>;
};

/** Options for an included (joined) entity. */
export interface IncludeOption<
  T extends Table,
  K extends keyof T["$inferSelect"] = keyof T["$inferSelect"],
> {
  /**  The table to include */
  table: T;
  /** Columns to select from the joined entity. When omitted, all columns are selected. */
  attributes?: readonly K[];
  /** Nested includes for further joins from this table. */
  include?: IncludeOption<Table>[];
  /** An aliased table reference (from Drizzle's `alias()`). When provided, this table is used as the join target instead of `table`. Enables self-joins. */
  alias?: Table;
  /** A manual join condition. When provided, used instead of FK auto-detection via `getJoinCondition`. Required when `alias` is set (since alias breaks FK resolution). */
  on?: SQL;
  /** Whether this join is required. When true (default), uses an inner join. When false, uses a left join. */
  required?: boolean;
  /** Semantic relationship name used as the key in nested results (e.g., "user", "student"). Defaults to singularized table name at runtime, and the With* default at the type level. */
  relationName?: string;
}

/**
 * Extracts the relation name from an include item. Falls back to `Default` when
 * the include does not specify a `relationName` field.
 * @template Inc - The include item to extract from.
 * @template Default - The default relation name (singular entity name).
 */
type GetRelationName<Inc, Default extends string> = Inc extends {
  relationName: infer RN extends string;
}
  ? RN
  : Default;

/** Nested user inclusion with configurable result key. */
type WithUser<
  Key extends string = "user",
  K extends keyof User = keyof User,
  Required extends boolean = true,
> = {
  /** The included user. */
  [P in Key]: Required extends true ? Pick<User, K> : Pick<User, K> | null;
};

/**
 * A filter value can be:
 * - A simple value (implicit eq operator)
 * - An explicit filter with operator
 * - An array of explicit filters (AND combined)
 */
export type FilterValue<T> = T | ExplicitFilter<T> | ExplicitFilter<T>[];

/** Base column filters - direct column to value mappings. */
export type ColumnFilters<Entity> = {
  [K in keyof Entity]?: FilterValue<Entity[K]>;
};

/**
 * AND logical operator clause.
 * @template Entity - The entity type being filtered.
 * @template NonEmpty - If true, requires at least one condition.
 * @template JoinFilters - Optional typed dot-notation joined-column filters.
 */
export interface AndClause<
  Entity,
  NonEmpty extends boolean = false,
  JoinFilters extends object = object,
> {
  /** Conditions to combine with AND. */
  and: NonEmpty extends true
    ? NonEmptyArray<WhereOption<Entity, NonEmpty, JoinFilters>>
    : WhereOption<Entity, false, JoinFilters>[];
  /** Mutually exclusive with 'or'. */
  or?: never;
  /** Mutually exclusive with 'not'. */
  not?: never;
}

/**
 * OR logical operator clause.
 * @template Entity - The entity type being filtered.
 * @template NonEmpty - If true, requires at least one condition.
 * @template JoinFilters - Optional typed dot-notation joined-column filters.
 */
export interface OrClause<
  Entity,
  NonEmpty extends boolean = false,
  JoinFilters extends object = object,
> {
  /** Conditions to combine with OR. */
  or: NonEmpty extends true
    ? NonEmptyArray<WhereOption<Entity, NonEmpty, JoinFilters>>
    : WhereOption<Entity, false, JoinFilters>[];
  /** Mutually exclusive with 'and'. */
  and?: never;
  /** Mutually exclusive with 'not'. */
  not?: never;
}

/**
 * NOT logical operator clause.
 * @template Entity - The entity type being filtered.
 * @template NonEmpty - If true, requires the nested condition to be non-empty.
 * @template JoinFilters - Optional typed dot-notation joined-column filters.
 */
export interface NotClause<
  Entity,
  NonEmpty extends boolean = false,
  JoinFilters extends object = object,
> {
  /** Condition to negate. */
  not: WhereOption<Entity, NonEmpty, JoinFilters>;
  /** Mutually exclusive with 'and'. */
  and?: never;
  /** Mutually exclusive with 'or'. */
  or?: never;
}

/**
 * Where option: column filters OR logical operators (recursive).
 * @template Entity - The entity type being filtered.
 * @template NonEmpty - If true, requires at least one filter condition.
 * @template JoinFilters - An intersection of joined-table filter shapes
 *   (see {@link IncludeJoinWhereFilters}). Defaults to `object` (no joined
 *   filters allowed). When provided, callers may mix main-table filters with
 *   dot-notation keys referencing joined columns (e.g., `"users.firstName"`)
 *   in the same clause.
 */
export type WhereOption<
  Entity,
  NonEmpty extends boolean = false,
  JoinFilters extends object = object,
> =
  | (NonEmpty extends true
      ? RequireAtLeastOne<ColumnFilters<Entity> & JoinFilters>
      : ColumnFilters<Entity> & JoinFilters)
  | AndClause<Entity, NonEmpty, JoinFilters>
  | OrClause<Entity, NonEmpty, JoinFilters>
  | NotClause<Entity, NonEmpty, JoinFilters>;

/**
 * Type guard to check if a value is an ExplicitFilter.
 * @param value - The value to check.
 * @returns True if the value is an ExplicitFilter.
 */
export function isExplicitFilter<T>(
  value: FilterValue<T>,
): value is ExplicitFilter<T> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    "value" in value &&
    "operator" in value
  );
}

/**
 * Type guard to check if a clause is an AndClause.
 * @param clause - The clause to check.
 * @returns True if the clause is an AndClause.
 */
export function isAndClause<Entity>(
  clause: WhereOption<Entity>,
): clause is AndClause<Entity> {
  return (
    typeof clause === "object" &&
    clause !== null &&
    "and" in clause &&
    Array.isArray(clause.and)
  );
}

/**
 * Type guard to check if a clause is an OrClause.
 * @param clause - The clause to check.
 * @returns True if the clause is an OrClause.
 */
export function isOrClause<Entity>(
  clause: WhereOption<Entity>,
): clause is OrClause<Entity> {
  return (
    typeof clause === "object" &&
    clause !== null &&
    "or" in clause &&
    Array.isArray(clause.or)
  );
}

/**
 * Type guard to check if a clause is a NotClause.
 * @param clause - The clause to check.
 * @returns True if the clause is a NotClause.
 */
export function isNotClause<Entity>(
  clause: WhereOption<Entity>,
): clause is NotClause<Entity> {
  return (
    typeof clause === "object" &&
    clause !== null &&
    "not" in clause &&
    typeof clause.not === "object"
  );
}

/** Supported SQL aggregate functions. */
export type AggregateFunction = "count" | "countDistinct" | "avg";

/**
 * An aggregate expression to include in the select.
 * @template Entity - The entity type.
 * @template A - The aggregate alias literal type.
 * @template JAC - Dot-notation keys for aggregating over joined table columns.
 */
export type AggregateAttribute<
  Entity,
  A extends string,
  JAC extends string = never,
> =
  | { fn: "count"; column: (string & keyof Entity) | "*" | JAC; as: A }
  | {
      fn: Exclude<AggregateFunction, "count">;
      column: (string & keyof Entity) | JAC;
      as: A;
    };

/** Order direction for sorting. */
export type OrderDirection = "asc" | "desc";

/** Order by option derived from Entity - allows ordering by any column or aggregate alias. */
export type OrderByOption<
  Entity,
  K extends keyof Entity = keyof Entity,
  JOK extends string = never,
  A extends string = never,
> = {
  [P in K | JOK | A]?: OrderDirection;
};

/**
 * Base dot-notation key type for referencing a joined table's columns.
 * Derives the column names from the Drizzle `Table` type. The prefix
 * defaults to the table's own name, but callers may supply an explicit
 * alias string to type-check self-joins (e.g., `"sourceBooking"`).
 * @template T - A Drizzle table object (e.g., `typeof users`).
 * @template Alias - Prefix used in the dot-notation key. Defaults to `T["_"]["name"]`.
 * @public Building block for typed entity query wrappers.
 */
export type JoinColumn<
  T extends Table,
  Alias extends string = T["_"]["name"],
> = `${Alias}.${Extract<keyof T["$inferSelect"], string>}`;

/**
 * Dot-notation keys for filtering on a joined table's columns, preserving the
 * column's value type. Used internally by {@link IncludeJoinWhereFilters}.
 *
 * @template T - A Drizzle table object (e.g., `typeof users`).
 * @template Alias - Prefix used in the dot-notation key. Defaults to `T["_"]["name"]`.
 */
type JoinWhereFilter<T extends Table, Alias extends string = T["_"]["name"]> = {
  [K in Extract<
    keyof T["$inferSelect"],
    string
  > as `${Alias}.${K}`]?: FilterValue<T["$inferSelect"][K]>;
};

/**
 * Extracts the Drizzle Table that contributes columns for a single include item.
 * Prefers `alias` (self-join support) and falls back to `table`. Wrote out the
 * conditional this way (rather than combining `infer A extends Table` in one
 * step) because the property is declared optional and the one-step form
 * collapses literal alias tables to the wide `Table` interface.
 * @template Inc - A single include item.
 */
type IncludeItemTable<Inc> = Inc extends { alias: infer A }
  ? A extends Table
    ? A
    : Inc extends { table: infer T }
      ? T extends Table
        ? T
        : never
      : never
  : Inc extends { table: infer T }
    ? T extends Table
      ? T
      : never
    : never;

/**
 * Dot-notation prefix for a single include item (matches applyFilters'
 * runtime rule: alias table name when set, else base table name).
 * @template Inc - A single include item.
 */
type IncludeItemPrefix<Inc> =
  IncludeItemTable<Inc> extends Table
    ? IncludeItemTable<Inc>["_"]["name"]
    : never;

/**
 * Recursively collects dot-notation keys for every table in the include tuple.
 * Walks nested `include:` arrays. Parallel to `ResolveNestedIncludes` but
 * producing key literals instead of result shapes.
 * @template Inc - The include tuple.
 * @public Building block for typed entity query wrappers.
 */
export type IncludeJoinGroupByKeys<Inc> = Inc extends readonly [
  infer Head,
  ...infer Tail,
]
  ?
      | (IncludeItemTable<Head> extends Table
          ? JoinColumn<IncludeItemTable<Head>, IncludeItemPrefix<Head> & string>
          : never)
      | (Head extends { include: infer Nested extends readonly unknown[] }
          ? IncludeJoinGroupByKeys<Nested>
          : never)
      | IncludeJoinGroupByKeys<Tail>
  : never;

/**
 * Include-aware aggregate column keys. Semantic alias of {@link IncludeJoinGroupByKeys}.
 * @public Building block for typed entity query wrappers.
 */
export type IncludeJoinAggregateColumns<Inc> = IncludeJoinGroupByKeys<Inc>;

/**
 * Include-aware orderBy keys. Semantic alias of {@link IncludeJoinGroupByKeys}.
 * @public Building block for typed entity query wrappers.
 */
export type IncludeJoinOrderByKeys<Inc> = IncludeJoinGroupByKeys<Inc>;

/**
 * Recursive intersection of {@link JoinWhereFilter} shapes for every table in
 * the include tuple. Walks nested `include:` arrays. Empty-tuple and
 * missing-table cases collapse to `object` (not `never`) for compatibility
 * with `JWF extends object` in `countResources`.
 * @template Inc - The include tuple.
 * @public Building block for typed entity query wrappers.
 */
export type IncludeJoinWhereFilters<Inc> = Inc extends readonly [
  infer Head,
  ...infer Tail,
]
  ? (IncludeItemTable<Head> extends Table
      ? JoinWhereFilter<
          IncludeItemTable<Head>,
          IncludeItemPrefix<Head> & string
        >
      : object) &
      (Head extends { include: infer Nested extends readonly unknown[] }
        ? IncludeJoinWhereFilters<Nested>
        : object) &
      IncludeJoinWhereFilters<Tail>
  : object;

/** Generic options for find queries. */
export interface GenericFindOptions<
  Entity,
  Include,
  K extends keyof Entity = keyof Entity,
  A extends string = string,
  AK extends string & keyof Entity = string & keyof Entity,
  JGK extends string = never,
  JAC extends string = never,
  JOK extends string = never,
  JWF extends object = object,
> extends PaginationInput {
  /** The filters to apply. Accepts dot-notation keys when {@link JWF} is provided. */
  where?: WhereOption<Entity, false, JWF>;
  /** The tables to join against. */
  include?: Include;
  /** The order to sort results by. Supports main-table columns, dot-notation joined columns, and aggregate aliases. */
  orderBy?: OrderByOption<Entity, keyof Entity, JOK, NoInfer<A>>;
  /** Columns to group results by - either main-table or dot-notation joined columns. */
  groupBy?: readonly (K | JGK)[];
  /** Columns to select from the main table. When omitted, all columns are selected. */
  attributes?: AK[];
  /** Aggregate expressions to include in the select. When omitted, no aggregates are computed. */
  aggregates?: AggregateAttribute<Entity, A, JAC>[];
  /** Filters to apply after grouping (SQL HAVING clause). Accepts aggregate aliases and groupBy column keys. */
  having?: HavingOption<Entity, A, K>;
  /** Optional database transaction to run the query within. */
  tx?: Transaction;
}

/**
 * Generic options for finding a single entity.
 *
 * @template Entity - The entity type.
 * @template Include - The include tuple for joined tables.
 * @template K - The attribute column keys.
 * @template JWF - Typed joined-column filters exposed on `where`. Defaults to
 *   `object` (no joined filters). Entity wrappers bind this to their
 *   `*JoinWhereFilters` so `findOne*` callers get typed dot-notation
 *   `where` keys parallel to `findAll*` / `count*`.
 */
export type GenericFindOneOptions<
  Entity,
  Include,
  K extends keyof Entity,
  JWF extends object = object,
> = Pick<
  GenericFindOptions<
    Entity,
    Include,
    K,
    string,
    string & keyof Entity,
    never,
    never,
    never,
    JWF
  >,
  "where" | "include" | "attributes" | "orderBy" | "tx"
> & {
  /** Whether to require the entity to exist. If true (default), throws NotFoundError when not found. */
  require?: boolean;
};

/**
 * Generic options for count queries. Picks the count-relevant subset of
 * {@link GenericFindOptions}: `where`, `include`, `having`, `aggregates`,
 * and `tx`. The `groupBy` property is added directly with a dedicated `GB`
 * type parameter so that entity-specific count types can pass through a raw
 * tuple and preserve TypeScript's `const` type-parameter inference without
 * needing an intersection override.
 *
 * @template Entity - The entity type.
 * @template Include - The include tuple for joined tables.
 * @template K - Main-table groupBy column keys (used to type `having`).
 * @template JGK - Dot-notation joined-table groupBy keys.
 * @template A - Custom aggregate alias literal type(s) (e.g. `"rating"`). Defaults to `never` so `"count" | never = "count"`.
 * @template JAC - Dot-notation joined-table aggregate column keys.
 * @template GB - The groupBy tuple type. Defaults to `readonly (K | JGK)[]`.
 * @template JWF - Typed joined-column filters exposed on `where`. Defaults to `object` (no joined filters).
 */
export type GenericCountOptions<
  Entity,
  Include = never,
  K extends keyof Entity = keyof Entity,
  JGK extends string = never,
  A extends string = never,
  JAC extends string = never,
  GB extends readonly (keyof Entity | JGK)[] = readonly (K | JGK)[],
  JWF extends object = object,
> = Pick<
  GenericFindOptions<
    Entity,
    Include,
    K,
    "count" | A,
    never,
    JGK,
    JAC,
    never,
    JWF
  >,
  "where" | "include" | "having" | "aggregates" | "tx"
> & {
  /** Columns to group the count by. Supports main-table keys and dot-notation joined keys. */
  groupBy?: GB;
};

/**
 * Target column(s) for conflict detection during upsert operations.
 * @template Entity - The entity type whose columns can be targeted.
 */
type ConflictTarget<Entity> =
  | (string & keyof Entity)
  | (string & keyof Entity)[];

/**
 * Configuration for upsert behavior when a conflict is detected.
 * @template Entity - The entity type being upserted.
 */
export interface OnConflictDoUpdate<Entity> {
  /** The column(s) to detect conflicts on. */
  target: ConflictTarget<Entity>;
  /** The values to set when a conflict occurs. */
  set: RequireAtLeastOne<Partial<{ [K in keyof Entity]: Entity[K] }>>;
}

/**
 * Configuration for idempotent inserts. When a conflict is detected the row
 * is left as-is and the conflicting input is dropped from the returned set,
 * so callers can detect "already existed" by checking the returned length.
 * @template Entity - The entity type being inserted.
 */
export interface OnConflictDoNothing<Entity> {
  /** The column(s) to detect conflicts on. */
  target: ConflictTarget<Entity>;
}

/**
 * Generic options for create queries.
 * Derives the insert and select types from the Drizzle table, ensuring they
 * always stay in sync (impossible to mismatch entity and insert types).
 * @template T - The Drizzle table type.
 */
export interface GenericCreateOptions<T extends PgTable> {
  /** The data to insert (single record or array). */
  data: T["$inferInsert"] | T["$inferInsert"][];
  /** Optional upsert behavior when a conflict is detected. */
  onConflictDoUpdate?: OnConflictDoUpdate<T["$inferSelect"]>;
  /** Optional idempotent-insert behavior. Mutually exclusive with `onConflictDoUpdate`. */
  onConflictDoNothing?: OnConflictDoNothing<T["$inferSelect"]>;
  /** Optional database transaction to run the insert within. */
  tx?: Transaction;
}

/**
 * Safe update values — plain entity values only, no SQL expressions.
 * Used by service-facing option types to prevent SQL injection vectors.
 * @template Entity - The entity type.
 */
type GenericUpdateValues<Entity> = Partial<{
  [K in keyof Omit<Entity, "updatedAt" | "createdAt">]: Entity[K];
}>;

/** Generic options for update queries. */
export interface GenericUpdateOptions<Entity> {
  /** The filter to identify the entity. */
  where: WhereOption<Entity, true>;
  /** The values to update (excludes timestamp fields). */
  values: GenericUpdateValues<Entity>;
  /** Optional database transaction to run the query within. */
  tx?: Transaction;
}

/*
 * NOTE: If you need to create a query function that uses SQL expressions in
 * update values (e.g., atomic increments), define the values type inline in
 * that function's .set() call rather than using GenericUpdateOptions.
 * GenericUpdateOptions deliberately excludes SQL to prevent injection
 * vectors from the service layer.
 */

/** Generic options for delete queries. */
export interface GenericDeleteOptions<Entity> {
  /** The filter to identify the entities to delete. */
  where: WhereOption<Entity, true>;
  /** Optional database transaction to run the query within. */
  tx?: Transaction;
}

/**
 * Combines a base type with named aggregate fields. When `Alias` is a
 * concrete literal, adds `Record<Alias, number>` to the base. When `Alias`
 * is the unresolved generic `string`, no fields are added (no-op).
 *
 * @example
 * // Literal alias — adds { count: number }:
 * WithAggregate<{ city: string }, "count">
 * // => { city: string; count: number }
 *
 * // Unresolved alias — no-op:
 * WithAggregate<{ city: string }, string>
 * // => { city: string }
 *
 * **Caveat:** all aggregates are typed as `number`, but SQL `AVG()` returns
 * `null` when every input value is NULL. Callers using `avg` aggregates
 * should apply a runtime fallback (e.g. `?? null`) even though TypeScript
 * won't require it.
 */
export type WithAggregate<Base, Alias extends string> = Base &
  (string extends Alias ? object : Record<Alias, number>);

/**
 * Resolves the selected attribute keys from an include item, defaulting to all keys of the model.
 *
 * @example
 * // Given User = { id: string; name: string; email: string }
 *
 * ResolveIncludeItemAttributes<{ attributes: readonly ["id", "name"] }, User>
 * // => "id" | "name"
 *
 * ResolveIncludeItemAttributes<{ attributes: readonly ["id", "invalid"] }, User>
 * // => "id" | keyof User  (invalid keys fall back to all keys)
 *
 * ResolveIncludeItemAttributes<{}, User>
 * // => keyof User  (no attributes specified, selects all)
 */
type ResolveIncludeItemAttributes<Inc, T extends Table> = Inc extends {
  attributes: readonly (infer K)[];
}
  ? K extends keyof T["$inferSelect"]
    ? K
    : keyof T["$inferSelect"]
  : keyof T["$inferSelect"];

/**
 * Determines whether an include item is required (inner join) based on its `required` field.
 * Defaults to `true` when `required` is omitted, matching the runtime behavior.
 *
 * @example
 * IsIncludeItemRequired<{ required: true }>   // => true
 * IsIncludeItemRequired<{ required: false }>  // => false
 * IsIncludeItemRequired<{}>                   // => true (default)
 */
type IsIncludeItemRequired<Inc> = Inc extends {
  required: false;
}
  ? false
  : true;

/**
 * Type-level mirror of the runtime `isFilterOnlyJoin` helper in
 * `executeQuery.ts`. An include is filter-only when its `attributes` is
 * literally an empty tuple (so no columns from this table are selected) AND
 * every nested include is itself filter-only. Filter-only joins exist purely
 * to constrain or aggregate the main query — they MUST NOT contribute a key
 * to the resolved result type.
 *
 * Detected via `[K] extends [never]`: when `attributes: []` (preserved as
 * `readonly []` thanks to the `const` type-parameter at call sites), the
 * inferred element type `K` collapses to `never`.
 *
 * @template Inc - The include item to inspect.
 */
type IsFilterOnlyJoin<Inc> = Inc extends {
  attributes: readonly (infer K)[];
}
  ? [K] extends [never]
    ? Inc extends { include: infer Nested extends readonly unknown[] }
      ? AreAllFilterOnly<Nested>
      : true
    : false
  : false;

/**
 * Recursive companion to {@link IsFilterOnlyJoin}: a tuple of includes is
 * "all filter-only" iff every element is itself filter-only. The empty tuple
 * is vacuously true (matches the runtime behavior of an `include: []` parent).
 *
 * @template Inc - A tuple of include items.
 */
type AreAllFilterOnly<Inc extends readonly unknown[]> = Inc extends readonly [
  infer Head,
  ...infer Tail,
]
  ? IsFilterOnlyJoin<Head> extends true
    ? Tail extends readonly unknown[]
      ? AreAllFilterOnly<Tail>
      : true
    : false
  : true;

/**
 * Resolves a single include item to its nested With* type.
 * Child includes are composed INTO the parent's type via NestedType.
 * The result key is determined by `relationName` (if specified) or defaults to
 * the singular entity name.
 *
 * Filter-only joins (see {@link IsFilterOnlyJoin}) collapse to `object` so
 * they vanish from the resulting intersection — matching the runtime behavior
 * in `executeQuery.restructureRow`.
 *
 * Falls back to `object` (no-op in intersections) for unrecognized tables.
 *
 * @example
 * ResolveIncludeItemNested<{ table: typeof users }>
 * // => { user: Pick<User, keyof User> }
 *
 * ResolveIncludeItemNested<{ table: typeof users; relationName: "student" }>
 * // => { student: Pick<User, keyof User> }
 *
 * ResolveIncludeItemNested<{ table: typeof users; attributes: readonly [] }>
 * // => object  (filter-only: no result key)
 */
type ResolveIncludeItemNested<Inc> =
  IsFilterOnlyJoin<Inc> extends true
    ? object
    : Inc extends { table: typeof users }
      ? WithUser<
          GetRelationName<Inc, "user">,
          ResolveIncludeItemAttributes<Inc, typeof users>,
          IsIncludeItemRequired<Inc>
        >
      : object;

/**
 * Recursively resolves an include tuple into an intersection of nested With* types.
 * Order-independent: the same set of includes produces the same type regardless of order.
 *
 * @example
 * // Single required join:
 * ResolveNestedIncludes<[{ table: typeof users }]>
 * // => { user: Pick<User, keyof User> }
 *
 * // Optional join:
 * ResolveNestedIncludes<[{ table: typeof users; required: false }]>
 * // => { user: Pick<User, keyof User> | null }
 *
 * // Custom relation name:
 * ResolveNestedIncludes<[{ table: typeof users; relationName: "student" }]>
 * // => { student: Pick<User, keyof User> }
 *
 * @template Inc - The include tuple (readonly).
 */
type ResolveNestedIncludes<Inc extends readonly unknown[]> =
  Inc extends readonly [infer Head, ...infer Tail]
    ? ResolveIncludeItemNested<Head> & ResolveNestedIncludes<Tail>
    : object;

/**
 * Main entry point for resolving nested include results.
 * Unwraps the root entity to the top level and nests includes under relationship names.
 *
 * @example
 * // An entity with a users include:
 * ResolveIncludeNested<[{ table: typeof users }], Entity>
 * // => Pick<Entity, keyof Entity> & { user: Pick<User, keyof User> }
 *
 * @template Inc - The include tuple.
 * @template Entity - The main entity type.
 * @template EntityK - The entity column keys to select. Defaults to all columns.
 * @public Building block for typed entity query wrappers.
 */
export type ResolveIncludeNested<
  Inc extends readonly unknown[],
  Entity,
  EntityK extends keyof Entity = keyof Entity,
> = Pick<Entity, EntityK> & ResolveNestedIncludes<Inc>;

/**
 * Pluralizes a singular relation name to match the table name used in dot-notation keys.
 * Reverses the runtime `singularize` function at the type level.
 * @example
 * Pluralize<"user">     // => "users"
 * Pluralize<"category"> // => "categories"  (ends in "y" → "ies")
 */
type Pluralize<S extends string> = S extends `${infer Prefix}y`
  ? `${Prefix}ies`
  : `${S}s`;

/**
 * Extracts column names from dot-notation groupBy keys for a given relation name.
 * Supports both singular relation names (result keys) and plural table names (SQL keys)
 * so that groupBy keys like `"users.firstName"` match the result key `"user"`.
 */
type ExtractJoinedColumns<
  Keys,
  RelationName extends string,
> = Keys extends `${Pluralize<RelationName>}.${infer Col}`
  ? Col
  : Keys extends `${RelationName}.${infer Col}`
    ? Col
    : never;

/**
 * Narrows a resolved include type to only the columns present in the
 * groupBy tuple. Each table's type is Pick'd to only the grouped columns.
 * Preserves nullability for left-join results.
 *
 * @example
 * // Given Resolved = { users: Pick<User, keyof User> }
 * // and   GB       = readonly ["city", "users.firstName"]
 *
 * NarrowIncludeByGroupBy<Resolved, GB>
 * // => { users: Pick<User, "firstName"> }
 *
 * // With a left join (Resolved = { users: Pick<User, keyof User> | null }):
 * NarrowIncludeByGroupBy<Resolved, GB>
 * // => { users: Pick<User, "firstName"> | null }
 * @public Building block for typed entity query wrappers.
 */
export type NarrowIncludeByGroupBy<Resolved, GB extends readonly string[]> = {
  [K in keyof Resolved]:
    | Pick<
        NonNullable<Resolved[K]>,
        ExtractJoinedColumns<GB[number], K & string> &
          keyof NonNullable<Resolved[K]>
      >
    | Extract<Resolved[K], null>;
};
