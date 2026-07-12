import { toDateString } from "./toDateString";

/**
 * Converts a Date to a YYYYMMDD integer using local date components
 * (e.g. 2026-04-20 → 20260420). Suitable for Postgres int4 advisory-lock
 * keys: fits within int4 for dates up to year ~2147.
 * @param date - The date to convert.
 * @returns The date packed as a base-10 integer in YYYYMMDD form.
 */
export function toYyyymmddInt(date: Date): number {
  return parseInt(toDateString(date).replace(/-/g, ""), 10);
}
