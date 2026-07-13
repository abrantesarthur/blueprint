# Blueprint Backend

Backend API workspace for the Blueprint monorepo. Ships with an example vertical slice — a minimal `users` CRUD module — that demonstrates the schema → queries → module → fixtures → seeders → tests pattern.

## Getting Started

```bash
# Start development server
bun dev

# Run linter
bun lint

# Database operations
bun db:generate  # Generate migrations
bun db:migrate   # Run migrations
bun db:studio    # Open Drizzle Studio
```

## Tech Stack

- **Runtime**: Bun
- **Framework**: Elysia
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM

## Environment Variables

Configuration is loaded and validated at startup by `src/config/loadEnv.ts`. Each
value comes from **exactly one** source:

- **Process environment** (`envName`) — set these on the host/container.
- **Bitwarden Secrets Manager** (`bwsName`) — resolved in-process at startup via
  the embedded WASM SDK (`@blueprint/bitwarden-utils`), using `BWS_ACCESS_TOKEN`
  and `BWS_ORGANIZATION_ID`. The `bws` CLI is **not** required (this is what lets
  the distroless production image resolve secrets — it has no shell or CLI).

### Set in the environment

| Variable              | Type    | Required | Default   | Purpose                                                                                                              |
| --------------------- | ------- | -------- | --------- | -------------------------------------------------------------------------------------------------------------------- |
| `BWS_ACCESS_TOKEN`    | string  | yes      | —         | Bitwarden machine-account token; bootstraps secret fetching.                                                         |
| `BWS_ORGANIZATION_ID` | string  | yes      | —         | Bitwarden organization id that scopes secret lookups.                                                                |
| `POSTGRES_HOST`       | string  | yes      | —         | PostgreSQL host. Provisioned and injected by the orchestrator.                                                       |
| `POSTGRES_PORT`       | number  | yes      | —         | PostgreSQL port (1000–65535). Injected by the orchestrator.                                                          |
| `POSTGRES_PASSWORD`   | string  | yes      | —         | PostgreSQL password. Generated and injected by the orchestrator.                                                     |
| `POSTGRES_SSLMODE`    | string  | no       | `disable` | libpq SSL mode. Set to `require` for managed Postgres (e.g. DigitalOcean), which only accepts encrypted connections. |
| `RUNTIME_ENVIRONMENT` | string  | yes      | —         | Runtime environment (e.g. `development`, `production`).                                                              |
| `PORT`                | number  | yes      | —         | Port the server listens on (1000–65535).                                                                             |
| `TRUST_PROXY`         | boolean | no       | `false`   | Trust `x-forwarded-for` for client IP (rate limiting).                                                               |

`DATABASE_URL` is **not** an input — it is constructed from the `POSTGRES_*` parts.

`POSTGRES_HOST`, `POSTGRES_PORT`, and `POSTGRES_PASSWORD` are only known at
orchestration run time (the managed instance generates them), so the orchestrator
injects them into the container environment. `POSTGRES_DB` and `POSTGRES_USER`
must exist _before_ the instance is provisioned, so they are sourced from
Bitwarden to keep the orchestrator and backend in agreement on the values.

Bun's SQL client does **not** honor `PGSSLMODE`/`POSTGRES_SSLMODE` the way
`libpq`/`psql` does, so `POSTGRES_SSLMODE` is read in `loadEnv.ts`, translated
into an explicit TLS flag (`DATABASE_SSL`), and passed to both the runtime
Drizzle client and `drizzle-kit` migrations. Managed Postgres providers present
a publicly-trusted certificate, so `require` works without a custom CA.

### Resolved from Bitwarden — do NOT set as environment variables

`POSTGRES_DB`, `POSTGRES_USER`, `JWT_SECRET`, `CLOUDFLARE_TUNNEL_TOKEN`, and
`CLOUDFLARE_TUNNEL_HOSTNAME`.
