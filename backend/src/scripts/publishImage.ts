import AsyncArg from "@blueprint/async-arg-utils";
import {
  exec,
  logFailure,
  logSuccess,
  promiseSpinner,
} from "@blueprint/script-utils";

/**
 * Bitwarden organization the GHCR credentials live under. Hardcoded so this
 * deploy script can resolve its secrets without depending on an env file; it is
 * not application config and never changes per environment. `BWS_ACCESS_TOKEN`
 * (the actual secret) still comes from the shell environment.
 */
process.env["BWS_ORGANIZATION_ID"] = "<your-bws-organization-id>";

/** Container registry host the image is pushed to. */
const REGISTRY = "ghcr.io";

/**
 * Fully-qualified image repository: the `backend` package under your GitHub
 * organization. Replace `your-org` with your organization's name.
 */
const IMAGE = `${REGISTRY}/your-org/backend`;

/**
 * Target platforms for the published manifest list: `linux/amd64` for the
 * x86-64 production droplet and `linux/arm64` so the image still runs natively
 * on Apple Silicon dev machines. Building for a single host arch (the default
 * `docker build` behavior) leaves the droplet unable to pull a matching
 * manifest.
 */
const PLATFORMS = "linux/amd64,linux/arm64";

/**
 * Name of the dedicated `buildx` builder. Multi-platform builds require the
 * `docker-container` driver; the default `docker` driver cannot emit a manifest
 * list.
 */
const BUILDER_NAME = "blueprint-deploy";

/**
 * Deploy-time GHCR credentials, fetched from Bitwarden via the same machinery
 * (AsyncArg + the embedded WASM SDK) the app uses for runtime secrets. These
 * are infra credentials,
 * NOT application config, so they deliberately live here and not in
 * `config/loadEnv.ts` (the running container never authenticates to GHCR).
 */
const ghcrConfig = {
  GHCR_USERNAME: AsyncArg.string({
    bwsName: "GHCR_USERNAME",
    description: "GitHub username used to authenticate against GHCR",
    minLength: 1,
  }),
  GHCR_TOKEN: AsyncArg.string({
    bwsName: "GHCR_TOKEN",
    description:
      "GitHub PAT with `write:packages` scope, used to push images to GHCR",
    sensitive: true,
    minLength: 1,
  }),
};

/**
 * Runs a git command and returns its trimmed stdout.
 * @param gitArgs - Arguments passed to `git`.
 * @returns The trimmed stdout, or "" when the command exits non-zero.
 */
async function git(gitArgs: string[]): Promise<string> {
  try {
    return await exec(["git", ...gitArgs], { returnStdout: true });
  } catch {
    return "";
  }
}

/**
 * Authenticates the local Docker daemon against GHCR by piping the token to
 * `docker login --password-stdin`, so the secret never appears in argv.
 * @param params - The authentication inputs.
 * @param params.username - The GHCR username.
 * @param params.token - The GHCR token (write:packages scope).
 * @throws Error if `docker login` exits non-zero.
 */
async function dockerLogin({
  username,
  token,
}: {
  /** The GHCR username. */
  username: string;
  /** The GHCR token with write:packages scope. */
  token: string;
}): Promise<void> {
  await exec(
    ["docker", "login", REGISTRY, "-u", username, "--password-stdin"],
    { input: token, silent: true },
  );
}

/**
 * Ensures a `docker-container` `buildx` builder exists for multi-platform
 * builds, creating it on first run. The builder is referenced explicitly via
 * `--builder` at build time, so the user's default builder selection is left
 * untouched.
 * @throws Error if creating the builder exits non-zero.
 */
async function ensureBuildxBuilder(): Promise<void> {
  try {
    await exec(["docker", "buildx", "inspect", BUILDER_NAME], { silent: true });
  } catch {
    await exec(
      [
        "docker",
        "buildx",
        "create",
        "--name",
        BUILDER_NAME,
        "--driver",
        "docker-container",
        "--bootstrap",
      ],
      { silent: true },
    );
  }
}

/** Builds the backend image, pushes it to GHCR, and tags it `latest` + git SHA. */
async function main(): Promise<void> {
  const repoRoot = await git(["rev-parse", "--show-toplevel"]);
  if (!repoRoot) {
    logFailure("Not inside a git checkout — cannot resolve the build context.");
    process.exit(1);
  }

  const sha = (await git(["rev-parse", "--short", "HEAD"])) || "unknown";
  const tags = [`${IMAGE}:latest`, `${IMAGE}:${sha}`];

  try {
    const [username, token] = await promiseSpinner(
      Promise.all([
        ghcrConfig.GHCR_USERNAME.fetch(),
        ghcrConfig.GHCR_TOKEN.fetch(),
      ]),
      "Fetching GHCR credentials...",
    );

    await promiseSpinner(
      dockerLogin({ username, token: token.release() }),
      `Logging in to ${REGISTRY}...`,
    );

    await promiseSpinner(
      ensureBuildxBuilder(),
      `Preparing buildx builder "${BUILDER_NAME}"...`,
    );

    // Build from the monorepo root so workspace packages and bun.lock resolve.
    // `buildx --push` builds every target platform and pushes the resulting
    // manifest list in one step, so no separate `docker push` is needed.
    await exec([
      "docker",
      "buildx",
      "build",
      "--builder",
      BUILDER_NAME,
      "--platform",
      PLATFORMS,
      "-f",
      `${repoRoot}/backend/Dockerfile`,
      ...tags.flatMap((tag) => ["-t", tag]),
      "--push",
      repoRoot,
    ]);
  } catch (error) {
    logFailure(error instanceof Error ? error.message : String(error));
    process.exit(1);
  } finally {
    AsyncArg.cleanup();
  }

  logSuccess(`Pushed ${tags.join(" and ")}`);
}

main();
