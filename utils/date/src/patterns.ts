/** Regex pattern for `YYYY-MM-DD` local date strings. */
export const ISO_DATE_PATTERN = "^\\d{4}-\\d{2}-\\d{2}$";

/**
 * Regex pattern for `HH:MM` time format.
 * Matches values from `00:00` to `23:59`.
 */
export const TIME_PATTERN = "^([01][0-9]|2[0-3]):[0-5][0-9]$";
