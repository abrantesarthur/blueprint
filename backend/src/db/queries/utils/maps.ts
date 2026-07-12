import {
  arrayContains,
  arrayOverlaps,
  type Column,
  count,
  countDistinct,
  eq,
  gt,
  gte,
  lt,
  lte,
  ne,
  type SQL,
  sql,
  type SQLWrapper,
} from "drizzle-orm";

/**
 * A generic filter operator function.
 * Scalar operators (eq, gte, etc.) and array operators (arrayContains, arrayOverlaps)
 * have incompatible overloaded signatures but share the same (column, value) → SQL
 * calling convention at runtime.
 */
type OperatorFn = (left: SQLWrapper, right: unknown) => SQL;

/** Operator functions for comparisons and array operations. */
export const filterOperators = {
  eq,
  gte,
  lte,
  gt,
  lt,
  ne,
  contains: arrayContains as OperatorFn,
  overlaps: arrayOverlaps as OperatorFn,
};

/**
 * Computes the SQL AVG of a column and maps the result to a JavaScript number.
 * Drizzle's built-in `avg()` maps with `String` because PostgreSQL returns
 * `numeric` for AVG over integers. This wrapper uses `Number` instead so
 * callers receive a numeric value (or `null` for empty groups).
 * @param col - The Drizzle column to average.
 * @returns A SQL expression typed as `number`.
 */
const numericAvg = (col: Column): ReturnType<typeof sql<number>> =>
  sql<number>`round(avg(${col}), 2)`.mapWith(Number);

/** Map of aggregate function names to their Drizzle implementations. */
export const aggregateFns = {
  count,
  countDistinct,
  avg: numericAvg,
} as const;
