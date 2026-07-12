/**
 * Resolves after the given number of milliseconds. Thin promise wrapper over
 * `setTimeout`, useful for retry backoffs, polling loops, and tests that
 * need to mock waiting.
 *
 * @param ms - Milliseconds to wait. Values `<= 0` resolve on the next tick.
 * @returns A promise that resolves after `ms` milliseconds.
 */
export async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });
}
