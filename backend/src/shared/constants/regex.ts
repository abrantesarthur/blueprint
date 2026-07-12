/**
 * Regex pattern for UUID v4 format.
 * Used for cursor validation and other UUID fields.
 */
export const UUID_PATTERN =
  "^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$";

/**
 * Regex pattern for safe filenames.
 * Allows alphanumeric, hyphens, underscores, dots, and spaces.
 */
export const FILENAME_PATTERN = "^[\\w\\-. ]+$";

/**
 * Regex pattern for MIME types.
 * Matches standard format like "image/jpeg", "application/pdf".
 */
export const MIME_TYPE_PATTERN = "^[a-z]+\\/[a-z0-9\\-+.]+$";

/**
 * Regex pattern for ISO 8601 datetime strings.
 * Matches format like "2024-01-15T10:30:00".
 */
export const ISO_DATETIME_PATTERN =
  "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}:\\d{2}";

/**
 * Regex pattern for HTTP(S) URLs.
 * Basic validation for URLs starting with http:// or https://.
 */
export const URI_PATTERN = "^https?:\\/\\/[^\\s]+$";
