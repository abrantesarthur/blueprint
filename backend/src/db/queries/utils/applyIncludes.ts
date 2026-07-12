import {
  createTableRelationsHelpers,
  eq,
  getTableName,
  type SQL,
  type Table,
} from "drizzle-orm";
import {
  getTableConfig,
  type PgColumn,
  type PgSelect,
  type PgTable,
} from "drizzle-orm/pg-core";

import * as schema from "../../schema";
import type { IncludeOption } from "./types";

/**
 * Drizzle relations object shape. Mirrors the structure produced by
 * `relations(table, ...)`.
 */
interface DrizzleRelations {
  /** The source table for these relations. */
  table: Table;
  /** Function that, given relation helpers, returns each named relation entry. */
  config: (helpers: ReturnType<typeof createTableRelationsHelpers>) => Record<
    string,
    {
      referencedTable: Table;
      relationName?: string;
      config?: { fields?: PgColumn[]; references?: PgColumn[] };
      constructor?: { name: string };
    }
  >;
}

/**
 * Type guard for Drizzle relations objects exported from the schema barrel.
 * @param value - Candidate value.
 * @returns True when the value is a Drizzle relations object.
 */
function isDrizzleRelations(value: unknown): value is DrizzleRelations {
  return (
    value !== null &&
    typeof value === "object" &&
    "table" in (value as object) &&
    "config" in (value as object) &&
    typeof (value as DrizzleRelations).config === "function"
  );
}

/**
 * Locates the Drizzle `relations(...)` object whose source table matches the
 * given table, by scanning the schema barrel exports.
 * @param table - The Drizzle table to look up.
 * @returns The matching relations object, or null if none is registered.
 */
function findRelationsForTable(table: Table): DrizzleRelations | null {
  const tableName = getTableName(table);
  for (const value of Object.values(schema)) {
    if (isDrizzleRelations(value) && getTableName(value.table) === tableName) {
      return value;
    }
  }
  return null;
}

/**
 * Resolves a join condition between two tables using the schema's `relations`
 * graph. Used to disambiguate when FK auto-detection finds multiple candidate
 * FKs between the same pair of tables. The caller-supplied `relationName`
 * matches the relation key on `fromTable`'s relations object.
 *
 * Resolution strategy:
 * 1. Find the entry in `fromTable`'s relations whose key equals `relationName`.
 * 2. If it is a `one(...)` relation, its `fields`/`references` directly yield
 *    the join condition.
 * 3. If it is a `many(...)` relation (no fields/references), look up the
 *    inverse `one(...)` on `toTable` whose Drizzle `relationName` matches —
 *    that side carries the FK columns.
 *
 * @param fromTable - The parent table for the join.
 * @param toTable - The table being joined.
 * @param relationName - Relation key on `fromTable`'s relations to follow.
 * @returns A join condition SQL expression, or null if it cannot be resolved.
 */
function resolveJoinByRelationName(
  fromTable: Table,
  toTable: Table,
  relationName: string,
): SQL | null {
  const fromRelations = findRelationsForTable(fromTable);
  if (!fromRelations) return null;

  const fromConfig = fromRelations.config(
    createTableRelationsHelpers(fromTable),
  );
  const rel = fromConfig[relationName];
  if (!rel) return null;

  if (getTableName(rel.referencedTable) !== getTableName(toTable)) {
    return null;
  }

  const fromFields = rel.config?.fields;
  const fromReferences = rel.config?.references;
  if (
    fromFields &&
    fromFields.length > 0 &&
    fromReferences &&
    fromReferences.length > 0
  ) {
    return eq(fromFields[0]!, fromReferences[0]!);
  }

  // `many(...)` side: the FK columns live on the inverse `one(...)` declared
  // on the target table. Pair them up via the Drizzle `relationName` so we
  // pick the correct inverse when several FKs connect the same two tables.
  const drizzleRelationName = rel.relationName;
  const toRelations = findRelationsForTable(toTable);
  if (!toRelations) return null;

  const toConfig = toRelations.config(createTableRelationsHelpers(toTable));
  for (const inverseRel of Object.values(toConfig)) {
    if (inverseRel.constructor?.name !== "One") continue;
    if (getTableName(inverseRel.referencedTable) !== getTableName(fromTable)) {
      continue;
    }
    if (
      drizzleRelationName !== undefined &&
      inverseRel.relationName !== drizzleRelationName
    ) {
      continue;
    }

    const fields = inverseRel.config?.fields;
    const references = inverseRel.config?.references;
    if (fields && fields.length > 0 && references && references.length > 0) {
      return eq(fields[0]!, references[0]!);
    }
  }

  return null;
}

/**
 * Resolves the foreign-key join condition between two tables.
 *
 * Checks `fromTable`'s foreign keys first (forward direction), then falls
 * back to `toTable`'s foreign keys (reverse direction). When either side
 * yields multiple matches and a `relationName` is provided, the schema's
 * declared relations are consulted via {@link resolveJoinByRelationName} to
 * disambiguate. Throws if no FK is found, or if the ambiguity cannot be
 * resolved.
 *
 * @param fromTable - The table owning the join source.
 * @param toTable - The table being joined to.
 * @param relationName - Optional relation key on `fromTable` used to
 * disambiguate when multiple FKs connect the two tables.
 * @returns An `eq()` SQL expression suitable for join conditions.
 */
export function getJoinCondition(
  fromTable: Table,
  toTable: Table,
  relationName?: string,
): SQL {
  const fromConfig = getTableConfig(fromTable as PgTable);
  const toName = getTableName(toTable);

  // Forward: fromTable has FK pointing to toTable
  const forwardMatches = fromConfig.foreignKeys.filter(
    (fk) => getTableName(fk.reference().foreignTable) === toName,
  );

  if (forwardMatches.length === 1) {
    const ref = forwardMatches[0]!.reference();
    return eq(ref.columns[0]!, ref.foreignColumns[0]!);
  }

  if (forwardMatches.length > 1) {
    if (relationName) {
      const cond = resolveJoinByRelationName(fromTable, toTable, relationName);
      if (cond) return cond;
    }
    throw new Error(
      `Ambiguous foreign key: ${getTableName(fromTable)} has ${forwardMatches.length} FKs pointing to ${toName}. Provide a "relationName" matching a relation in ${getTableName(fromTable)}'s relations to disambiguate.`,
    );
  }

  // Reverse: toTable has FK pointing to fromTable
  const toConfig = getTableConfig(toTable as PgTable);
  const fromName = getTableName(fromTable);

  const reverseMatches = toConfig.foreignKeys.filter(
    (fk) => getTableName(fk.reference().foreignTable) === fromName,
  );

  if (reverseMatches.length === 1) {
    const ref = reverseMatches[0]!.reference();
    return eq(ref.columns[0]!, ref.foreignColumns[0]!);
  }

  if (reverseMatches.length > 1) {
    if (relationName) {
      const cond = resolveJoinByRelationName(fromTable, toTable, relationName);
      if (cond) return cond;
    }
    throw new Error(
      `Ambiguous foreign key: ${toName} has ${reverseMatches.length} FKs pointing to ${fromName}. Provide a "relationName" matching a relation in ${fromName}'s relations to disambiguate.`,
    );
  }

  throw new Error(
    `No foreign key found between "${fromName}" and "${toName}".`,
  );
}

/**
 * Recursively applies join clauses (`innerJoin` or `leftJoin`) to a dynamic
 * query based on the include tree. Each include item is joined to its parent
 * table using the FK condition resolved by {@link getJoinCondition}.
 * When `required` is `false`, a left join is used; otherwise, an inner join.
 *
 * No-op when `include` is `undefined` or empty.
 *
 * @param options - The options for applying includes.
 * @param options.query - The dynamic Drizzle query to mutate.
 * @param options.mainTable - The parent table for the current include level.
 * @param options.include - The include tree (may be nested).
 */
export function applyIncludes<Q extends PgSelect>({
  query,
  mainTable,
  include,
}: {
  /** The dynamic Drizzle query to mutate. */
  query: Q;
  /** The parent table for the current include level. */
  mainTable: Table;
  /** The include tree (may be nested). */
  include?: IncludeOption<Table>[];
}): void {
  if (!include || include.length === 0) return;

  for (const item of include) {
    // Aliased tables bypass FK auto-detection, so both the alias itself
    // and any nested children must supply an explicit "on" condition.
    if (item.alias) {
      if (!item.on) {
        throw new Error(
          `Include for "${getTableName(item.table)}" with alias "${getTableName(item.alias)}" must provide an explicit "on" condition (FK auto-detection is not supported on aliased tables).`,
        );
      }

      for (const nested of item.include ?? []) {
        if (!nested.on) {
          throw new Error(
            `Nested include for "${getTableName(nested.table)}" under aliased table "${getTableName(item.alias)}" must provide an explicit "on" condition (FK auto-detection is not supported on aliased tables).`,
          );
        }
      }
    }

    const joinTarget = item.alias ?? item.table;
    const condition =
      item.on ?? getJoinCondition(mainTable, item.table, item.relationName);

    if (item.required === false) {
      query.leftJoin(joinTarget, condition);
    } else {
      query.innerJoin(joinTarget, condition);
    }

    applyIncludes({
      query,
      mainTable: item.alias ?? item.table,
      include: item.include,
    });
  }
}
