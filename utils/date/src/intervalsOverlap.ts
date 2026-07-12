/**
 * Checks whether two intervals overlap (exclusive boundaries).
 * Works with any comparable type (Date, string in HH:MM format, number, etc.).
 * @param a - The first interval, with a start and end time.
 * @param b - The second interval, with a start and end time.
 * @returns True if the intervals overlap.
 */
export function intervalsOverlap<T extends Date | string | number>(
  a: { startTime: T; endTime: T },
  b: { startTime: T; endTime: T },
): boolean {
  return a.startTime < b.endTime && a.endTime > b.startTime;
}
