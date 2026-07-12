import ora from "ora";

/**
 * Starts a spinner for a promise.
 *
 * @param promise - The promise to test and display a spinner for.
 * @param text - The text to display by the spinner.
 * @returns The resolved value of the promise.
 */
export async function promiseSpinner<T>(
  promise: Promise<T>,
  text: string,
): Promise<T> {
  console.log();
  const spinner = ora(text).start();

  try {
    const result = await promise;
    spinner.succeed();
    return result;
  } catch (error) {
    spinner.fail();
    throw error;
  }
}
