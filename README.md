# Blueprint Monorepo

A reusable full-stack monorepo template: Bun + Elysia + PostgreSQL (Drizzle ORM) backend, Next.js frontend scaffold, and shared utility packages. It ships with an example vertical slice — a minimal `users` CRUD module — that demonstrates the repo patterns end-to-end (schema → queries → module → fixtures → seeders → tests) with a green test suite.

## Workspaces

| Workspace              | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| [backend](./backend)   | Backend API (Elysia + Bun + PostgreSQL)                            |
| [frontend](./frontend) | Next.js frontend scaffold                                          |
| [utils/\*](./utils)    | Shared packages (api, enum, error, time, date, type, script, etc.) |

## What's Included

- **Example vertical slice**: `users` entity + minimal `users` CRUD module (create, fetch, update, delete), with JWT bearer-token auth middleware, fixtures, seeders, and full test coverage.
- **Guardrails**: pre-commit hooks, CI workflow, ESLint (JSDoc enforcement), custom validators (schema naming, query imports, db usage, SQL safety, test-only markers), and knip dead-code detection.
- **Conventions**: see [CLAUDE.md](./CLAUDE.md) for the full set of repo conventions.

## Prerequisites

- [Bun](https://bun.sh/) runtime
- A Bitwarden Secrets Manager access token (`BWS_ACCESS_TOKEN`) and organization
  id (`BWS_ORGANIZATION_ID`). Secrets are fetched in-process via the embedded
  WASM SDK — the `bws` CLI is **not** required.

## Getting Started

```bash
# Clone your copy of the template
git clone <your-repo-url>
cd blueprint-monorepo

# Run setup script (installs Bun, dependencies, pre-commit hooks)
./scripts/setup.sh

# Start the backend development server
cd backend
bun dev
```

## Adapting This Blueprint

1. Rename the `@blueprint/*` package scope and the `blueprint-monorepo` name to your project's.
2. Set your `BWS_ORGANIZATION_ID` (and Bitwarden secrets) or swap in your own secrets provider.
3. Replace the `<replace-me>` placeholders in `maestro.yaml` (domain, project name, image, Cloudflare account, Bitwarden ids) to configure deployment.
4. Replace the example `users` slice with your own domain entities, following the same schema → queries → module → fixtures → seeders → tests pattern.
5. Regenerate database migrations: `cd backend && bun run db:generate`.

## Structure

```
blueprint-monorepo/
├── backend/           # Backend API workspace
├── frontend/          # Next.js frontend workspace
├── utils/             # Shared utility packages
├── package.json       # Root workspace configuration
└── tsconfig.base.json # Shared TypeScript configuration
```
