import { createLogger } from "@blueprint/logger-utils";

import { loadEnv } from "./loadEnv";

/** Validated environment configuration loaded at startup. */
export const env = await loadEnv().catch((error: Error) => {
  // The shared logger's level comes from this very config, so a bare
  // default-level logger is built for the one event it can never carry.
  createLogger({ level: "fatal" }).fatal(
    { err: error },
    "environment validation failed",
  );
  process.exit(1);
});
