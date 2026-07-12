import { exec, promiseSpinner } from "@blueprint/script-utils";
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
  const proc = spawn({
    cmd: ["lsof", "-ti", `tcp:${port}`, "-sTCP:LISTEN"],
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const pids = output
    .split("\n")
    .map((pid) => pid.trim())
    .filter((pid) => pid.length > 0);

  if (pids.length === 0) return;

  await exec(["kill", "-9", ...pids], { silent: true });
}

/** Kills any running cloudflared tunnel processes. */
async function killCloudflared(): Promise<void> {
  const proc = spawn({
    cmd: ["pgrep", "-f", "cloudflared"],
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = await new Response(proc.stdout).text();
  await proc.exited;

  const pids = output
    .split("\n")
    .map((pid) => pid.trim())
    .filter((pid) => pid.length > 0);

  if (pids.length === 0) return;

  await exec(["kill", "-9", ...pids], { silent: true });
}

/** Tears down the local dev environment: kills the backend listener, tunnel, and stops docker compose. */
async function main(): Promise<void> {
  const port = Number(process.env["PORT"]);
  if (!Number.isFinite(port) || port <= 0) {
    throw new Error(
      "PORT env variable is missing or invalid; cannot identify backend listener to kill",
    );
  }

  await promiseSpinner(
    killPortListeners({ port }),
    "Killing backend server...",
  );
  await promiseSpinner(killCloudflared(), "Killing cloudflared tunnel...");
  await promiseSpinner(
    exec(["docker", "compose", "down", "-v"], { silent: true }),
    "Stopping containers...",
  );
}

main();
