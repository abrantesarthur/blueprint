import {
  type TNull,
  type TSchema,
  type TUnion,
  Type as t,
} from "@sinclair/typebox";

/**
 * Wraps a TypeBox schema to also accept null, equivalent to Elysia's `t.Nullable()`.
 * @param schema - The TypeBox schema to make nullable.
 * @returns A union of the schema and null.
 */
export function Nullable<T extends TSchema>(schema: T): TUnion<[T, TNull]> {
  return t.Union([schema, t.Null()]);
}
