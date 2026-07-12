/**
 * Parses a YYYY-MM-DD string as a local-time Date (midnight in the host timezone).
 *
 * `new Date("2026-04-13")` is parsed as UTC midnight, which shifts to the previous
 * calendar day in timezones behind UTC (e.g. America/Sao_Paulo, UTC-3).
 * Appending `T00:00:00` forces local-time parsing per the ECMAScript spec.
 * @param dateString - Date string in YYYY-MM-DD format.
 * @returns Date object at local midnight for the given calendar date.
 */
export function toLocalDate(dateString: string): Date {
  return new Date(dateString + "T00:00:00");
}
