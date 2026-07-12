import AsyncArg from "@blueprint/async-arg-utils";
import { Secret } from "@transcend-io/secret-value";

/**
 * Database environment configuration definitions, shared between the full
 * application loader ({@link ../loadEnv}) and the DB-only loader below.
 *
 * `POSTGRES_HOST` / `POSTGRES_PORT` / `POSTGRES_DB` / `POSTGRES_USER` /
 * `POSTGRES_PASSWORD` are only known at orchestration run time (the managed
 * instance generates them), so the orchestrator injects them into the
 * backend container's environment.
 */
export const dbEnvConfig = {
  BWS_ACCESS_TOKEN: AsyncArg.string({
    envName: "BWS_ACCESS_TOKEN",
    description: "Bitwarden access token",
    sensitive: true,
    minLength: 1,
  }),
  POSTGRES_HOST: AsyncArg.string({
    envName: "POSTGRES_HOST",
    description: "PostgreSQL host",
    minLength: 2,
  }),
  POSTGRES_PORT: AsyncArg.number({
    envName: "POSTGRES_PORT",
    description: "PostgreSQL port",
    min: 1000,
    max: 65535,
  }),
  POSTGRES_DB: AsyncArg.string({
    envName: "POSTGRES_DB",
    description: "PostgreSQL database name",
    minLength: 2,
  }),
  POSTGRES_USER: AsyncArg.string({
    envName: "POSTGRES_USER",
    description: "PostgreSQL user",
    minLength: 2,
  }),
  POSTGRES_PASSWORD: AsyncArg.string({
    envName: "POSTGRES_PASSWORD",
    description: "PostgreSQL password",
    sensitive: true,
    minLength: 12,
  }),
  POSTGRES_SSLMODE: AsyncArg.string({
    envName: "POSTGRES_SSLMODE",
    description:
      "libpq-style SSL mode for the PostgreSQL connection. Managed providers (e.g. DigitalOcean) only accept encrypted connections, so production sets this to `require`. Bun's SQL client ignores PGSSLMODE/POSTGRES_SSLMODE on its own, so this value is read here and translated into an explicit TLS flag.",
    default: "disable",
  }),
};

/**
 * SSL modes that require an encrypted connection. Mirrors libpq semantics:
 * `disable`/`allow`/`prefer` permit (or omit) plaintext, whereas `require`
 * and the `verify-*` modes mandate TLS.
 */
const TLS_REQUIRING_SSL_MODES = new Set([
  "require",
  "verify-ca",
  "verify-full",
]);

/**
 * Translates a libpq-style SSL mode into a boolean TLS flag for Bun's SQL
 * client, which (unlike libpq) does not interpret `sslmode` itself.
 * @param sslMode - The libpq SSL mode (e.g. `disable`, `require`, `verify-full`).
 * @returns `true` when the mode mandates an encrypted connection.
 */
export function sslModeRequiresTls(sslMode: string): boolean {
  return TLS_REQUIRING_SSL_MODES.has(sslMode.trim().toLowerCase());
}

/** The shape of the database environment configuration. */
export interface DbEnv {
  /** PostgreSQL connection URL. */
  DATABASE_URL: Secret<string>;
  /** Whether the PostgreSQL connection must use TLS (derived from `POSTGRES_SSLMODE`). */
  DATABASE_SSL: boolean;
  /** PostgreSQL user. */
  DATABASE_USER: string;
  /** PostgreSQL db name. */
  DATABASE_NAME: string;
}

/**
 * Fetches and assembles the database environment from {@link dbEnvConfig}.
 * Does NOT clean up the AsyncArg cache — the caller decides when to clean up,
 * so the full loader can keep fetching its remaining secrets afterwards.
 * @returns The validated database environment configuration.
 */
export async function fetchDbEnv(): Promise<DbEnv> {
  const [dbHost, dbPort, dbName, dbUser, dbPassword, dbSslMode] =
    await Promise.all([
      dbEnvConfig.POSTGRES_HOST.fetch(),
      dbEnvConfig.POSTGRES_PORT.fetch(),
      dbEnvConfig.POSTGRES_DB.fetch(),
      dbEnvConfig.POSTGRES_USER.fetch(),
      dbEnvConfig.POSTGRES_PASSWORD.fetch(),
      dbEnvConfig.POSTGRES_SSLMODE.fetch(),
    ]);

  return {
    DATABASE_URL: new Secret(
      `postgresql://${dbUser}:${dbPassword.release()}@${dbHost}:${dbPort}/${dbName}`,
    ),
    DATABASE_SSL: sslModeRequiresTls(dbSslMode),
    DATABASE_USER: dbUser,
    DATABASE_NAME: dbName,
  };
}

/**
 * Loads only database environment configuration.
 * Use this for scripts that only need database access (e.g., migrations).
 * @returns The validated database environment configuration.
 */
export async function loadDbEnv(): Promise<DbEnv> {
  await dbEnvConfig.BWS_ACCESS_TOKEN.fetch();

  const result = await fetchDbEnv();

  AsyncArg.cleanup();

  return result;
}
