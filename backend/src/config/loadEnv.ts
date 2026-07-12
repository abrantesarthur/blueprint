import AsyncArg from "@blueprint/async-arg-utils";
import { Secret } from "@transcend-io/secret-value";

import { type DbEnv, dbEnvConfig, fetchDbEnv } from "./loadDbEnv";

export { sslModeRequiresTls } from "./loadDbEnv";

/**
 * Environment configuration definitions using AsyncArg.
 *
 * `envName` values are read from the process environment; `bwsName` values are
 * fetched from Bitwarden Secrets Manager (via `BWS_ACCESS_TOKEN` /
 * `BWS_ORGANIZATION_ID`). Sensitive values are wrapped in Secret<T> to prevent
 * accidental logging.
 *
 * Database and `BWS_ACCESS_TOKEN` definitions are shared with the DB-only
 * loader via {@link dbEnvConfig}.
 */
const envConfig = {
  ...dbEnvConfig,
  // Bitwarden Secrets Manager
  BWS_ORGANIZATION_ID: AsyncArg.string({
    envName: "BWS_ORGANIZATION_ID",
    description: "Bitwarden organization ID (scopes secret lookups)",
    minLength: 1,
  }),

  // JWT (secrets - cryptographic keys)
  JWT_SECRET: AsyncArg.string({
    bwsName: "JWT_SECRET",
    description: "JWT signing secret",
    sensitive: true,
    minLength: 32,
  }),
  JWT_REFRESH_SECRET: AsyncArg.string({
    bwsName: "JWT_REFRESH_SECRET",
    description: "JWT refresh token signing secret",
    sensitive: true,
    minLength: 32,
  }),

  // Runtime
  RUNTIME_ENVIRONMENT: AsyncArg.string({
    envName: "RUNTIME_ENVIRONMENT",
    description: "Runtime environment (e.g. development, production)",
    minLength: 1,
  }),

  // Server
  PORT: AsyncArg.number({
    envName: "PORT",
    description: "Server port",
    min: 1000,
    max: 65535,
  }),

  // Rate limiting
  TRUST_PROXY: AsyncArg.boolean({
    envName: "TRUST_PROXY",
    description:
      "Whether to trust proxy headers (x-forwarded-for) for client IP extraction",
    default: false,
  }),

  // Local development
  MOCK_OTP: AsyncArg.boolean({
    envName: "MOCK_OTP",
    description:
      "When true, OTP requests skip real OTP delivery and the OTP is forced to '000000'. Never enable in production.",
    default: false,
  }),
  CLOUDFLARE_TUNNEL_TOKEN: AsyncArg.string({
    bwsName: "CLOUDFLARE_TUNNEL_TOKEN",
    description:
      "Cloudflare named-tunnel token used by `bun run dev --tunnel` to expose the local backend on a stable hostname. Dev-only; empty in environments without a named tunnel.",
    sensitive: true,
    default: "",
  }),
  CLOUDFLARE_TUNNEL_HOSTNAME: AsyncArg.string({
    bwsName: "CLOUDFLARE_TUNNEL_HOSTNAME",
    description:
      "Public hostname of the Cloudflare named tunnel (e.g. local.example.com), used only to print the dev tunnel URL. Empty when unset.",
    default: "",
  }),
};

/** The shape of the loaded environment configuration. */
interface Env extends DbEnv {
  /** JWT signing secret. */
  JWT_SECRET: Secret<string>;
  /** JWT refresh token signing secret. */
  JWT_REFRESH_SECRET: Secret<string>;
  /** Runtime environment (e.g. development, production). */
  RUNTIME_ENVIRONMENT: string;
  /** Server port. */
  PORT: number;
  /** Whether to trust proxy headers for client IP extraction. */
  TRUST_PROXY: boolean;
  /**
   * When true, OTP requests skip real OTP delivery and the verification
   * code is forced to a fixed value ("000000"). Never enable in production.
   */
  MOCK_OTP: boolean;
  /**
   * Cloudflare named-tunnel token for `bun run dev --tunnel` (dev-only).
   * Empty when no named tunnel is configured for the environment.
   */
  CLOUDFLARE_TUNNEL_TOKEN: Secret<string>;
  /**
   * Public hostname of the Cloudflare named tunnel, used only to print the
   * dev tunnel URL. Empty when unset.
   */
  CLOUDFLARE_TUNNEL_HOSTNAME: string;
}

/** Cached promise so concurrent/repeated calls share a single Bitwarden fetch. */
let pending: Promise<Env> | undefined;

/**
 * Guards against running with the mock OTP delivery flag enabled in production.
 * The mock skips the real OTP send and forces the code to a fixed value, so
 * leaving it enabled in production would let anyone authenticate as anyone.
 * @param params - The validation inputs.
 * @param params.mockEnabled - Whether `MOCK_OTP` is enabled.
 * @param params.runtimeEnvironment - The current `RUNTIME_ENVIRONMENT` value.
 * @throws Error when the mock is enabled and `RUNTIME_ENVIRONMENT` is "production".
 */
export function assertMockOtpNotInProduction({
  mockEnabled,
  runtimeEnvironment,
}: {
  /** Whether the mock OTP delivery is enabled. */
  mockEnabled: boolean;
  /** The current value of `RUNTIME_ENVIRONMENT`. */
  runtimeEnvironment: string;
}): void {
  if (mockEnabled && runtimeEnvironment === "production") {
    throw new Error(
      "MOCK_OTP must not be enabled when RUNTIME_ENVIRONMENT=production: it skips the real OTP send and forces a fixed code.",
    );
  }
}

/**
 * Fetches all environment configuration values (internal, not cached).
 * @returns The validated environment configuration object.
 */
async function doLoadEnv(): Promise<Env> {
  // The Bitwarden SDK reads BWS_ACCESS_TOKEN / BWS_ORGANIZATION_ID from the
  // environment; fetch them here to fail fast if either is missing.
  await Promise.all([
    envConfig.BWS_ACCESS_TOKEN.fetch(),
    envConfig.BWS_ORGANIZATION_ID.fetch(),
  ]);

  const dbEnv = await fetchDbEnv();

  const result: Env = {
    ...dbEnv,
    JWT_SECRET: await envConfig.JWT_SECRET.fetch(),
    JWT_REFRESH_SECRET: await envConfig.JWT_REFRESH_SECRET.fetch(),
    RUNTIME_ENVIRONMENT: await envConfig.RUNTIME_ENVIRONMENT.fetch(),
    PORT: await envConfig.PORT.fetch(),
    TRUST_PROXY: await envConfig.TRUST_PROXY.fetch(),
    MOCK_OTP: await envConfig.MOCK_OTP.fetch(),
    CLOUDFLARE_TUNNEL_TOKEN: await envConfig.CLOUDFLARE_TUNNEL_TOKEN.fetch(),
    CLOUDFLARE_TUNNEL_HOSTNAME:
      await envConfig.CLOUDFLARE_TUNNEL_HOSTNAME.fetch(),
  };

  assertMockOtpNotInProduction({
    mockEnabled: result.MOCK_OTP,
    runtimeEnvironment: result.RUNTIME_ENVIRONMENT,
  });

  // Clear Bitwarden fetcher cache to avoid keeping unnecessary data in memory
  AsyncArg.cleanup();

  return result;
}

/**
 * Loads all environment configuration values.
 * Sensitive values are wrapped in Secret<T> to prevent accidental logging.
 * Returns a cached result on subsequent calls to avoid duplicate Bitwarden fetches.
 * @returns The validated environment configuration object.
 * @throws Error if any required env variables are missing or invalid.
 */
export function loadEnv(): Promise<Env> {
  return (pending ??= doLoadEnv());
}
