import AsyncArg from "@blueprint/async-arg-utils";
import { isLogLevel, LOG_LEVELS, type LogLevel } from "@blueprint/logger-utils";
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

  // Logging
  LOG_LEVEL: AsyncArg.string({
    envName: "LOG_LEVEL",
    description: `Minimum structured-log level (one of: ${LOG_LEVELS.join(", ")})`,
    default: "info",
  }),

  // Rate limiting
  TRUST_PROXY: AsyncArg.boolean({
    envName: "TRUST_PROXY",
    description:
      "Whether to trust proxy headers (x-forwarded-for) for client IP extraction",
    default: false,
  }),

  // Local development
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
  /** Runtime environment (e.g. development, production). */
  RUNTIME_ENVIRONMENT: string;
  /** Server port. */
  PORT: number;
  /** Minimum structured-log level for the backend logger. */
  LOG_LEVEL: LogLevel;
  /** Whether to trust proxy headers for client IP extraction. */
  TRUST_PROXY: boolean;
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

/**
 * Fetches `LOG_LEVEL` and narrows it to a valid log level.
 * @returns The validated log level.
 * @throws Error if the value is not one of {@link LOG_LEVELS}.
 */
async function fetchLogLevel(): Promise<LogLevel> {
  const value = await envConfig.LOG_LEVEL.fetch();
  if (!isLogLevel(value)) {
    throw new Error(
      `LOG_LEVEL must be one of: ${LOG_LEVELS.join(", ")} (got "${value}")`,
    );
  }
  return value;
}

/** Cached promise so concurrent/repeated calls share a single Bitwarden fetch. */
let pending: Promise<Env> | undefined;

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
    RUNTIME_ENVIRONMENT: await envConfig.RUNTIME_ENVIRONMENT.fetch(),
    PORT: await envConfig.PORT.fetch(),
    LOG_LEVEL: await fetchLogLevel(),
    TRUST_PROXY: await envConfig.TRUST_PROXY.fetch(),
    CLOUDFLARE_TUNNEL_TOKEN: await envConfig.CLOUDFLARE_TUNNEL_TOKEN.fetch(),
    CLOUDFLARE_TUNNEL_HOSTNAME:
      await envConfig.CLOUDFLARE_TUNNEL_HOSTNAME.fetch(),
  };

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
