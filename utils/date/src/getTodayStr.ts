import { toDateString } from "@blueprint/type-utils";

/**
 * Gets today's date as YYYY-MM-DD string.
 * @returns Today's date string.
 */
export function getTodayStr(): string {
  return toDateString(new Date());
}
