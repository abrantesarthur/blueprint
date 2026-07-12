import { assertValidTimeFormat } from "./assertValidTimeFormat";

/**
 * Checks if a time is aligned to specified minute boundaries.
 * @param options - The options object.
 * @returns True if aligned to one of the specified minute values.
 * @throws Error if time format is invalid.
 */
export function isTimeAligned({
  time,
  alignments = [0, 30],
}: {
  /** Time string in HH:MM or HH:MM:SS format. */
  time: string;
  /** Allowed minute values (default: [0, 30] for hour/half-hour). */
  alignments?: number[];
}): boolean {
  assertValidTimeFormat(time);
  const minutes = parseInt(time.slice(3, 5), 10);
  return alignments.includes(minutes);
}
