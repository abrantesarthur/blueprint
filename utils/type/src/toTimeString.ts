import { toHHMM } from "./toHHMM";

/**
 * Converts a Date to a HH:MM time string.
 * @param date - The date to convert.
 * @returns The time string in HH:MM format.
 */
export function toTimeString(date: Date): string {
  // date.toTimeString() returns "10:00:00 GMT+0000 (...)"; extract just "10:00"
  return toHHMM(date.toTimeString().slice(0, 8));
}
