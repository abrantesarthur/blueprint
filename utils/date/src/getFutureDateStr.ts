import { toDateString } from "@blueprint/type-utils";

import { addDays } from "./addDays";

/**
 * Gets a future date as YYYY-MM-DD string.
 * @param daysFromNow - Number of days from today.
 * @returns Future date string.
 */
export function getFutureDateStr(daysFromNow: number): string {
  return toDateString(addDays({ days: daysFromNow }));
}
