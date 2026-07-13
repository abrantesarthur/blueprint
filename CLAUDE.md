# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

Blueprint is a reusable full-stack monorepo template. It ships with an example vertical slice — a minimal `users` CRUD module — that demonstrates the repo patterns end-to-end (schema → queries → module → fixtures → seeders → tests). Replace the example slice with your own domain while keeping the conventions below.

## Tech Stack

### Backend

- **Runtime**: Bun
- **Framework**: Elysia (fast Bun-native web framework)
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM

## Available Commands

### Root

- `bun install` — Install all workspace dependencies

### Backend (run from backend/)

- `bun run dev` — Start the backend development workflow
- `bun run dev:backend` — Run only the backend server in watch mode
- `bun run dev:db` — Start only the PostgreSQL container
- `bun run dev:down` — Stop local Docker services and remove volumes
- `bun run test` — Run the backend test suite
- `bun run lint` — Run ESLint
- `bun run db:generate` — Generate Drizzle migrations
- `bun run db:check` — Check Drizzle schema and migration state
- `bun run db:push` — Push schema changes to the database
- `bun run db:migrate` — Apply database migrations
- `bun run db:studio` — Open Drizzle Studio
- `bun run db:validate` — Validate the database setup
- `bun run db:seed` — Seed the database
- `bun run db:down` — Remove the PostgreSQL container and its Docker volume
- `bun run db:check-migrations` — Verify migration files are in sync
- `bun run validate:schemas` — Validate TypeBox schema naming
- `bun run validate:query-imports` — Validate query file imports
- `bun run validate:test-only` — Validate test-only code usage boundaries
- `bun run validate:db-usage` — Validate database access usage boundaries
- `bun run validate:sql-usage` — Validate safe SQL usage rules

IMPORTANT: to run tests, you MUST be in `backend/` folder and run `bun run test`!

## Project Structure

The project consists of 3 main workspaces

- `backend`: endpoints, business logic, and database.
- `frontend`: Next.js app scaffold.
- `utils`: code utilities shared between workspaces.

More details:

```
blueprint-monorepo/
├── backend/                  # Backend API (Elysia + Bun)
│   └── src/
│       ├── app.ts            # Elysia app setup
│       ├── index.ts          # Entry point
│       ├── config/           # Environment validation (TypeBox)
│       ├── db/               # Database client, schema, queries
│       │   ├── queries/      # Centralized query functions (by entity)
│       │   └── schema/       # Drizzle ORM schema definitions
│       ├── fixtures/         # Seed data shared by seeders and tests
│       ├── integrations/     # Outbound third-party API clients
│       ├── modules/          # Feature modules (users/ example)
│       │   └── __tests__/    # E2E tests (cross-module user journeys)
│       ├── shared/           # Middleware, utilities, types, constants
│       │   └── utils/        # Error handling classes and JWT utilities
│       └── tests/            # Test setup and mock data/fixtures
├── frontend/                 # Next.js frontend scaffold
├── utils/                    # Shared utility packages
│   ├── api/                  # TypeBox API schemas shared between backend and frontend
│   ├── async-arg/            # Typed async loaders for env/config values
│   ├── bitwarden/            # Bitwarden Secrets Manager client (embedded WASM SDK)
│   ├── crypto/               # Symmetric encryption helpers
│   ├── date/                 # Helpers for computing dates
│   ├── enum/                 # Single-source-of-truth TypeBox enum schemas
│   ├── error/                # Shared error codes, types, messages, and HTTP status mappings
│   ├── script/               # CLI script helpers (exec, spinner, success/failure logging)
│   ├── time/                 # time-duration constants in milliseconds (e.g., ONE_SECOND)
│   └── type/                 # generic type helpers (e.g., RequiredField, uniqueBy)
├── package.json              # Root workspace config
└── tsconfig.base.json        # Shared TypeScript config
```

## Backend

1. Each module `backend/src/modules/<module>/` follows this pattern:

- `index.ts` - Elysia routes with controller logic
- `model.ts` - TypeBox schemas for request/response validation
- `service.ts` - Business logic and database queries
- `__tests__` - `index.test.ts` and `service.test.ts` tests for the module.

2. The `backend/src/modules/__tests__/` directory contains E2E tests covering cross-module user journeys.

3. The example module is `users/` (minimal CRUD). Use it as the reference implementation when adding new modules.

4. Error messages that reach the client live in `@blueprint/error-utils` as typed constants, one file per module (e.g., `utils/error/src/users.ts`)

- Each exports a `<Module>ErrorMessage` and a `<Module>ErrorTranslation`.
- Services throw via constants: `throw new ConflictError(UserErrorMessage.EMAIL_ALREADY_EXISTS)`.

### Database

- The database queries must be stored in `backend/src/db/queries/`.

- All interactions with the database outside of `backend/src/db/` MUST use the functions in `backend/src/db/queries/`.

- Query functions are **hand-written per entity** with direct Drizzle and concrete types — no generic query engine. Each entity directory (e.g., `db/queries/users/`) exposes:
  - `find<Entity>s({ where?, orderBy?, limit?, offset?, tx? })` — returns full rows (`Entity[]`). `where` is a small declarative equality-filter object over concrete columns, combined with AND.
  - `find<Entity>({ where, tx? })` — the single throwing single-row finder; throws `NotFoundError` when no row matches. There is no nullable variant: callers that need maybe-semantics catch `NotFoundError` or call `find<Entity>s` and inspect the array.
  - `create<Entity>s` / `update<Entity>s` / `delete<Entity>s` — direct Drizzle insert/update/delete with `.returning()`. Update and delete require at least one `where` filter.

- Query functions always return full rows — no dynamic column selection. Callers narrow the shape themselves.

- Complex needs (aggregates, group by, having, joins) are NOT generalized: when a real query needs them, add a bespoke query function for that case in `db/queries/`.

- Drizzle operators (`eq`, `and`, `sql`, ...) must never leak outside `backend/src/db/` — services and modules only call the query functions.

## API Utils

When a TypeBox schema or type is used by **both** the backend and the frontend, it MUST live in `utils/api/src/`.

- **File per module**: one file per backend module (e.g., `utils/api/src/users.ts`).
- **Shared regex patterns**: validation regex patterns in `utils/api/src/regex.ts` (e.g., `NO_DIGITS_PATTERN`).
- **Backend `model.ts`**: imports shared types and schema from `@blueprint/api-utils`

## Session Behavior

- Assume approval for standard development operations. Do not keep asking for permissions to, for instance, create a plan file or run the commands above.
- After writing or modifying any function, write its tests in the same session before moving on.
- Use the sequential-thinking MCP tool only for complex multi-step refactors involving 5+ files. For single-function tasks or straightforward implementations, skip it and code directly.

### SQL Expression Safety

**NEVER pass user-controlled input into Drizzle's `sql` template tag.** The `sql` function creates raw SQL fragments that bypass parameterization. All `sql` usage must be restricted to `backend/src/db/queries/` with hardcoded schema references only.

- If you need a computed SQL expression (e.g., atomic increment), add a dedicated function in `db/queries/` instead of using `sql` in the service layer
- Update query functions accept plain column values only (e.g., `UserUpdateValues`), never `SQL` — this is a security boundary. If a query needs a SQL expression in its update values, write a dedicated `db/queries/` function with the expression hardcoded in its `.set()` call

### Code Style

- JSDoc comments MUST be written on interfaces (including their properties), types, functions (do not forget to specify @returns comment), and interface fields. This is enforced by ESLint!
- Explicit TypeScript return types on functions
- Explicit type annotations on function parameters.
- Only add comments to code changes when the code itself cannot convey non-obvious intent.
- Never write multi-line rationale or "why this matters" essays next to simple changes.
- **No narrating comments**: Don't write comments that re-describe what the next line literally does (e.g. `// Blur the input` above `input.blur()`).
- **No historical comments**: Don't leave comments about what the code _used to_ do or what bug a change fixed — `git blame` and commit messages already cover that.
- **No type casting**: Avoid using `as` type assertions. Instead, use type guards, proper typing, or, if Value.Decode from ` @sinclair/typebox/value` when possible. If a cast is truly unavoidable (e.g., interfacing with an untyped library), add a comment explaining why.
- **Function arguments as objects**: Functions should use a single object parameter with named properties instead of positional arguments. This improves readability and makes adding optional parameters easier:

  ```typescript
  // Good
  export async function updateUser({
    userId,
    user,
    tx,
  }: {
    /** The unique identifier of the user. */
    userId: string;
    /** The user fields to update. */
    user: UserUpdateBody;
    /** Optional database transaction. */
    tx?: Transaction;
  }): Promise<UserResponse> {
    // ...
  }

  // Avoid
  export async function updateUser(
    userId: string,
    user: UserUpdateBody,
    tx?: Transaction,
  ): Promise<UserResponse> {
    // ...
  }
  ```

### Time Constants

Use `@blueprint/time-utils` when defining time-related constants in milliseconds:

```typescript
import { ONE_MINUTE, ONE_HOUR } from "@blueprint/time-utils";

const CACHE_TTL = 2 * ONE_HOUR;
const TIMEOUT = 30 * ONE_MINUTE;
```

Available constants (all in milliseconds): `ONE_MS`, `ONE_SECOND`, `ONE_MINUTE`, `ONE_HOUR`, `ONE_DAY`, `ONE_WEEK`

### Schema Naming Conventions

TypeBox schemas in `model.ts` files follow these naming conventions:

- **Request body schemas**: `<entity><action>Body` (e.g., `userCreateBody`, `userUpdateBody`)
- **Query parameter schemas**: `<entity><action>Query` (e.g., `userListQuery`)
- **Response schemas**: `<entity><action>Response` (e.g., `userResponse`, `userListResponse`)
- **Enum/common schemas**: No suffix (e.g., `authUser`, `uuidParam`)

### Testing

- **What goes where** (strict separation):
  - **`index.test.ts`** — HTTP-layer concerns ONLY: authentication (401), path/body/query validation (422), rate limits (429), and a single happy-path per endpoint to lock in the end-user response shape. Do NOT re-test business rules (anything covered by the service.ts function).
  - **`service.test.ts`** — Business logic: role/ownership checks, state-transition rules, side effects, and error paths the service can throw. Exhaustive here, not in `index.test.ts`.
- **Test file structure**: Organize `describe` blocks hierarchically:
  1. **Top-level `describe`**: Use the file path being tested (e.g., `describe("users/service.ts", ...)` in `service.test.ts`)
  2. **Function-level `describe`**: One nested `describe` for each function being tested (e.g., `describe("getUser", ...)`)
  3. **Test cases**: Individual `test` blocks inside each function's `describe`
- **Running specific tests**: When validating changes, tag the relevant `describe` or `test` blocks with `.only` (e.g., `describe.only(...)`, `test.only(...)`) so that `bun run test` executes only those tests instead of the full suite. This speeds up the feedback loop significantly.
- **Helper functions**: When interacting with the database, you MUST use helpers in `@backend/src/db/queries`. Do not, in any circumstance, interact directly with the database via `testDb`.
- **Fixtures over direct database operations**: You must use existing fixtures rather than call `testDb.insert()` or `testDb.update()` directly in tests. Prefer to reuse fixtures. Only create a new fixture if strictly necessary.
- **State isolation**: E2E tests in `backend/src/modules/` can carry state from one test to the other. In `index.test.ts` and `service.test.ts` files, however, `describe` or `test` block must clean up any state it modifies.
  - If a `describe` seeds data in `beforeAll`, clear it in `afterAll`.
  - If tests within a `describe` modify seeded data, use `afterEach` to restore it via `agent.seed` rather than creating custom restore helpers.
- **Response typing in index tests**: When testing endpoints with `app.handle<>`, use the endpoint's return type from the model instead of inline type definitions:

  ```typescript
  // Good
  import type { UserResponse } from "../model.ts";
  const { status, body } = await app.handle<UserResponse>(...);

  // Avoid
  const { status, body } = await app.handle<{
    success: boolean;
    expiresAt: string;
    ...
  }>(...);
  ```

- **Success response assertions**: When testing success responses, prefer checking the exact structure of the response.

  ```typescript
  // Good
  test("creates a new user and returns the created record", async () => {
    const [result] = await createUsers({
      data: [
        {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
        },
      ],
    });

    expect(result!.id).toBeDefined();
    expect(result).toMatchObject({
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
    });
  });

  // Avoid
  test("creates a new user and returns the created record", async () => {
    const [result] = await createUsers({
      data: [
        {
          firstName: "John",
          lastName: "Doe",
          email: "john.doe@example.com",
        },
      ],
    });

    expect(typeof result!.id).toBe("string");
    expect(result!.firstName).toBe("John");
    expect(result!.lastName).toBe("Doe");
    expect(result!.email).toBe("john.doe@example.com");
  });
  ```

- **Error response assertions**: When testing error responses, always assert both the HTTP status code AND the error body. The error body has the shape `{ error: string; code: string }`. This ensures the API returns meaningful error messages, not just correct status codes.

  ```typescript
  // Good - asserts both status and error body
  expect(response.status).toBe(409);
  expect(response.body).toEqual({
    code: "CONFLICT",
    error: "A user with this email address already exists",
  });

  // Avoid - only checks status code
  expect(response.status).toBe(409);
  ```

  Common error codes: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `TOO_MANY_REQUESTS` (429), `VALIDATION_ERROR` (422).

### E2E Testing

E2E tests live in `backend/src/modules/__tests__/` and simulate complete user journeys across multiple modules. E2E tests chain sequential requests where state flows between steps.

- **Mimic the end user**: Drive every step through HTTP requests exactly as a real client would. Only touch the database or service layer directly when strictly necessary.
- **Each describe block tells one user-flow story**: Tests within a describe are sequential chapters of a single narrative, and state from one test intentionally carries over to impact the next. Do NOT reset state between tests in the same describe.
- **File naming**: `<actor>-<journey>.test.ts` (e.g., `user-onboarding-flow.test.ts`)
- **Top-level describe**: `"E2E: <Actor> <journey description>"`
- **Test names**: Narrative style — `"user creates an account and updates their profile"`. Unhappy path tests use `"rejects ..."` prefix.
- **Test order matters**: Tests are sequential; each step builds on the previous step's state
- **Shared state**: Declare `let` variables at the describe level (e.g., `let accessToken: string`)
- **Rate limiting**: Disable via `setRateLimitEnabled(false)` in `beforeAll`
- **Unhappy paths**: Weave error cases (422, 400, 403, 409) naturally before the corrected happy-path step. Assert both status code and error body `{ code, error }`.

### Git Operations

**NEVER merge, push, or modify the `main` branch without explicit user permission.**

- Do NOT merge feature branches into `main`
- Do NOT push commits to `main`
- Do NOT fast-forward `main` to match another branch
- Do NOT interpret "sync branches" or similar language as permission to merge into `main`

When asked to rebase or sync branches:

1. Only rebase the feature branch onto `main`
2. Only force-push the feature branch to its remote
3. STOP there - do not touch `main` in any way

**Merging into `main` requires the user to explicitly say "merge into main" or "push to main".**

The user reviews changes via GitHub Pull Requests before any merge to `main` occurs.

### Pre-commit Hooks

This project uses the [pre-commit](https://pre-commit.com/) Python framework to run automated checks before each commit. The configuration lives in `.pre-commit-config.yaml` at the repository root.

#### Setup

Install pre-commit (if not already installed):

```bash
# macOS
brew install pre-commit

# or via pip
pip install pre-commit
```

Install the git hooks:

```bash
pre-commit install
```

#### Hook Configuration

Hooks are defined in `.pre-commit-config.yaml` and organized into two repos:

**Local hooks** (custom project checks): `lint`, `format`, `typecheck`, `typecheck-frontend`, `db-validate`, `check-migrations`, `validate-schemas`, `validate-query-imports`, `validate-db-usage`, `validate-sql-usage`, `validate-test-only`, `validate-css-tokens`, `knip`

**External hooks** (from `pre-commit/pre-commit-hooks`): `check-merge-conflict`, `detect-private-key`, `check-case-conflict`, `trailing-whitespace`

#### Custom Validation Scripts

Custom hook scripts live next to the workspace they validate:

- Backend validators live in `backend/src/scripts/` and are invoked via npm scripts in `backend/package.json`.
- Frontend validators live in `frontend/scripts/` and are invoked via npm scripts in `frontend/package.json`.

#### Adding New Hooks

1. Create a validation script in the matching workspace (`backend/src/scripts/` or `frontend/scripts/`) following the existing patterns
2. Add an npm script in that workspace's `package.json`
3. Add the hook entry in `.pre-commit-config.yaml` with `entry: bun run --cwd <workspace> <script>`

### MCP Tools

- **Paper**: We use [paper](https://app.paper.design) MCP server to create page designs. It's the skin.
  - **NEVER remove or modify existing artboards when creating a new one.** Creating a new artboard must be an additive operation — existing artboards and their contents must remain untouched. Always verify via `get_basic_info` that all pre-existing artboards are still present after creating a new artboard.
- **shadcn/ui**: We use the shadcn ([https://ui.shadcn.com/docs/mcp](https://ui.shadcn.com/docs/mcp)) mcp server to fetch the primitive components (e.g., dropdowns, date pickers, forms) that we customize with our own visual identity. It's the skeleton.
