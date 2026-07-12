import { TIME_FORMAT_REGEX } from "./regex";

/**
 * Asserts that a time string is in valid HH:MM or HH:MM:SS format.
 * @param time - The time string to validate.
 * @throws Error if the time format is invalid.
 */
export function assertValidTimeFormat(time: string): void {
  if (!TIME_FORMAT_REGEX.test(time)) {
    throw new Error(
      `Invalid time format: "${time}". Expected HH:MM or HH:MM:SS`,
    );
  }
}
