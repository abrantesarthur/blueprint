export { ISO_DATE_PATTERN, TIME_PATTERN } from "@blueprint/date-utils";

/** Regex pattern that rejects strings containing any digit. */
export const NO_DIGITS_PATTERN = "^[^\\d]*$";

/**
 * Regex pattern that anchors the leading `YYYY-MM-DDTHH:MM` of an ISO 8601
 * date-time. Deliberately does NOT terminate the expression so the trailing
 * `:SS.sssZ` (or timezone offset) produced by `Date.toISOString()` is allowed
 * without the schema needing to enumerate every serializer variant. Pairs with
 * `format: "date-time"` so the full string still has to parse as a valid
 * date-time.
 */
export const ISO_DATE_TIME_PATTERN = "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}";
