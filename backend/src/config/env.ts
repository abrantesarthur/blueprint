import { loadEnv } from "./loadEnv";

/** Validated environment configuration loaded at startup. */
export const env = await loadEnv().catch((error: Error) => {
  console.error(`error: ${error.message}`);
  if (error.stack) {
    const stackLines = error.stack.split("\n").slice(1);
    console.error(stackLines.join("\n"));
  }
  process.exit(1);
});
