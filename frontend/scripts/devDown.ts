import { spawn } from "bun";

/**
 * Kills any process listening on the given TCP port.
 * @param port - The TCP port whose listener(s) should be killed.
 */
async function killPortListeners({
  port,
}: {
  /** The TCP port whose listener(s) should be killed. */
  port: number;
}): Promise<void> {
  const lsof = spawn({
    cmd: ["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"],
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(lsof.stdout).text();
  await lsof.exited;

  const pids = output
    .split("\n")
    .map((pid) => pid.trim())
    .filter((pid) => pid.length > 0);

  if (pids.length === 0) return;

  await spawn({
    cmd: ["kill", "-9", ...pids],
    stdout: "inherit",
    stderr: "inherit",
  }).exited;
}

/** Tears down the frontend dev server by killing whatever is listening on PORT. */
async function main(): Promise<void> {
  const port = Number(process.env["PORT"]);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(
      "PORT env variable is missing or invalid; cannot identify frontend listener to kill",
    );
  }

  await killPortListeners({ port });
}

main();
