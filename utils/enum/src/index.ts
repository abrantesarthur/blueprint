import { type Static, Type as t } from "@sinclair/typebox";

/** TypeBox Literal schema shape. */
interface TLiteral<T extends string> {
  /** The literal value. */
  const: T;
}

/** TypeBox Union schema shape containing Literal types. */
interface TUnion<T extends TLiteral<string>[]> {
  /** Array of literal schemas in the union. */
  anyOf: T;
}

/**
 * Extracts the string literal values from a TypeBox Union of Literals schema.
 * Returns a readonly tuple compatible with Drizzle's pgEnum.
 * @param schema - A TypeBox Union schema containing Literal string types
 * @returns Readonly tuple of the literal values
 */
function getSchemaValues<T extends TUnion<TLiteral<string>[]>>(
  schema: T,
): readonly [T["anyOf"][0]["const"], ...T["anyOf"][number]["const"][]] {
  return schema.anyOf.map(
    (s: TLiteral<string>) => s.const,
  ) as unknown as readonly [
    T["anyOf"][0]["const"],
    ...T["anyOf"][number]["const"][],
  ];
}

// ============ TypeBox Schemas (Single Source of Truth) ============

/** TypeBox schema for user roles. */
export const roleSchema = t.Union([t.Literal("user"), t.Literal("admin")]);

// ============ Derived TypeScript Types ============

/** User role type. */
export type Role = Static<typeof roleSchema>;

// ============ Derived Value Arrays (for Drizzle pgEnum) ============

/** User role values. */
export const ROLE_VALUES = getSchemaValues(roleSchema);
