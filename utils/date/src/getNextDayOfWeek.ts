import { addDays } from "./addDays";

/**
 * Finds the next occurrence of a specific day of week as Date object.
 * @param dayOfWeek - Day of week (0=Sunday, 6=Saturday).
 * @returns Date object for next occurrence (midnight local time).
 */
export function getNextDayOfWeek(dayOfWeek: number): Date {
  const today = new Date();
  const currentDay = today.getDay();
  let daysUntil = dayOfWeek - currentDay;
  if (daysUntil <= 0) {
    daysUntil += 7;
  }
  return addDays({ days: daysUntil });
}
