import { spawn, type Subprocess } from "bun";

/**
 * Starts a command and returns the subprocess handle without waiting for completion.
 * Use this for long-running processes that need manual lifecycle management.
 *
 * @param cmd - The command to execute as an array of strings.
 * @returns The subprocess handle.
 */
export function execStart(cmd: string[]): Subprocess {
  return spawn({
    cmd,
    stdout: "inherit",
    stderr: "inherit",
  });
}
