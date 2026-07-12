import { toDateString } from "@blueprint/type-utils";

import { addDays } from "./addDays";

/**
 * Gets a past date as YYYY-MM-DD string.
 * @param daysAgo - Number of days ago.
 * @returns Past date string.
 */
export function getPastDateStr(daysAgo: number): string {
  return toDateString(addDays({ days: -daysAgo }));
}
