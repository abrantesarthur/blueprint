import { spawn } from "bun";

/** Options for the exec function. */
interface ExecOptions {
  /** If true, suppresses stdout and stderr output. Defaults to false. */
  silent?: boolean;
  /** Environment variables to pass to the subprocess. Merged with current env. */
  env?: Record<string, string>;
  /** String written to the subprocess's stdin, then closed (e.g. for `--password-stdin`). */
  input?: string;
  /** If true, returns the subprocess's trimmed stdout. Defaults to false. */
  returnStdout?: boolean;
}

/**
 * Executes a command and throws if it fails.
 *
 * @param cmd - The command to execute as an array of strings.
 * @param options - Options for command execution.
 * @returns The subprocess's trimmed stdout when `returnStdout` is true, otherwise an empty string.
 * @throws Error if the command exits with a non-zero code; the message includes stderr when it was piped.
 */
export async function exec(
  cmd: string[],
  options: ExecOptions = {},
): Promise<string> {
  const { silent = false, env, input, returnStdout = false } = options;
  const piped = silent || returnStdout;

  const proc = spawn({
    cmd,
    stdin: input !== undefined || piped ? "pipe" : "inherit",
    stdout: piped ? "pipe" : "inherit",
    stderr: piped ? "pipe" : "inherit",
    env: env ? { ...process.env, ...env } : undefined,
  });

  if (input !== undefined) {
    proc.stdin?.write(input);
    await proc.stdin?.end();
  }

  const exitCode = await proc.exited;
  const stdout = piped ? (await new Response(proc.stdout).text()).trim() : "";

  if (exitCode !== 0) {
    const stderr = piped ? (await new Response(proc.stderr).text()).trim() : "";
    throw new Error(
      `Command failed with exit code ${exitCode}${stderr ? `: ${stderr}` : ""}`,
    );
  }

  return returnStdout ? stdout : "";
}
