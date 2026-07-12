import { afterEach } from "bun:test";

/**
 * Sets up automatic cleanup of environment variables after each test.
 * Call this at the top of a describe block to restore Bun.env after each test.
 */
export const setupEnvCleanup = (): void => {
  const originalEnv = { ...Bun.env };
  afterEach(() => {
    for (const key in Bun.env) {
      if (!(key in originalEnv)) {
        delete Bun.env[key];
      }
    }
    Object.assign(Bun.env, originalEnv);
  });
};
