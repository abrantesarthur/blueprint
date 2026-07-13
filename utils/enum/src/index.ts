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

/**
 * Template example enum. Illustrates the single-source-of-truth pattern for
 * enums shared between TypeBox validation and Drizzle `pgEnum` columns:
 * define the TypeBox Union here, derive the TypeScript type via `Static`,
 * and derive the value tuple via {@link getSchemaValues}. Replace with your
 * own domain enums.
 */
export const exampleStatusSchema = t.Union([
  t.Literal("active"),
  t.Literal("archived"),
]);

// ============ Derived TypeScript Types ============

/** Template example status type derived from {@link exampleStatusSchema}. */
export type ExampleStatus = Static<typeof exampleStatusSchema>;

// ============ Derived Value Arrays (for Drizzle pgEnum) ============

/** Template example status values for Drizzle `pgEnum`. */
export const EXAMPLE_STATUS_VALUES = getSchemaValues(exampleStatusSchema);
