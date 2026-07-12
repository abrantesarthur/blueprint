/**
 * Returns a new Date offset by the given number of days.
 * @param options - The options.
 * @returns A new Date object at midnight, offset by `days` from `from`.
 */
export function addDays({
  from = new Date(),
  days = 1,
}: {
  /** Base date. Defaults to today. */
  from?: Date | string;
  /** Number of days to add (can be negative). Defaults to 1. */
  days?: number;
} = {}): Date {
  const result = new Date(from);
  result.setDate(result.getDate() + days);
  result.setHours(0, 0, 0, 0);
  return result;
}
