import { assertValidTimeFormat } from "./assertValidTimeFormat";

/**
 * Normalizes a time string to HH:MM format (strips seconds if present).
 * @param time - Time string in HH:MM or HH:MM:SS format.
 * @returns Time string in HH:MM format.
 * @throws Error if time format is invalid.
 */
export function toHHMM(time: string): string {
  assertValidTimeFormat(time);
  return time.slice(0, 5);
}
