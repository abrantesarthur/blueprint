import ora from "ora";

/**
 * Prints a fail message with a red cross.
 *
 * @param text - The text to display.
 */
export function logFailure(text: string): void {
  console.log();
  ora(text).fail();
}
