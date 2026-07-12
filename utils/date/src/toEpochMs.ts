import { toDateString } from "@blueprint/type-utils";

import { ISO_DATE_PATTERN, TIME_PATTERN } from "./patterns";

const ISO_DATE_RE = new RegExp(ISO_DATE_PATTERN);
const TIME_RE = new RegExp(TIME_PATTERN);

/**
 * Returns the epoch milliseconds for a local `(date, time)` pair, where
 * `date` is either a `Date` (converted via the local YYYY-MM-DD components)
 * or an already-formatted YYYY-MM-DD string, and `time` is `HH:MM`. The
 * format of both inputs is validated internally so the helper cannot
 * silently emit `NaN` for a malformed value.
 *
 * @param args - The lookup arguments.
 * @returns The epoch milliseconds at `date T time` in local time.
 * @throws Error when `date` or `time` is not in the expected format.
 */
export function toEpochMs({
  date,
  time,
}: {
  /** Local date, either a `Date` or a `YYYY-MM-DD` string. */
  date: Date | string;
  /** Local `HH:MM` start time. */
  time: string;
}): number {
  const dateStr = typeof date === "string" ? date : toDateString(date);
  if (!ISO_DATE_RE.test(dateStr)) {
    throw new Error(`Expected a YYYY-MM-DD date, got "${dateStr}"`);
  }
  if (!TIME_RE.test(time)) {
    throw new Error(`Expected an HH:MM time, got "${time}"`);
  }
  return new Date(`${dateStr}T${time}:00`).getTime();
}
