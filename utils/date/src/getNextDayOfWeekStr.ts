import { getFutureDateStr } from "./getFutureDateStr";

/**
 * Finds the next occurrence of a specific day of week as YYYY-MM-DD string.
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday).
 * @returns Date string for next occurrence.
 */
export function getNextDayOfWeekStr(dayOfWeek: number): string {
  const today = new Date();
  const currentDay = today.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  return getFutureDateStr(daysUntil);
}
