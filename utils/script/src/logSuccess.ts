import ora from "ora";

/**
 * Prints a success message with a green checkmark.
 *
 * @param text - The text to display.
 */
export function logSuccess(text: string): void {
  console.log();
  ora(text).succeed();
}
