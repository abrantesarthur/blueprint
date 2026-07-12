# CLAUDE.md

This file provides guidance to Claude Code when working in this repository.

## Project Overview

Blueprint is a reusable full-stack monorepo template. It ships with an example vertical slice — a phone-OTP `auth` module and a `users` profile module — that demonstrates the repo patterns end-to-end (schema → queries → module → fixtures → seeders → tests). Replace the example slice with your own domain while keeping the conventions below.

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
│       ├── integrations/     # Outbound third-party API clients (otp/ delivery stub)
│       ├── modules/          # Feature modules (auth/ and users/ examples)
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

3. The example modules are `auth/` (phone-OTP login flow) and `users/` (profile management). Use them as the reference implementation when adding new modules.

4. OTP delivery goes through the stub integration in `backend/src/integrations/otp/` (`sendOtp`). In development it logs the code to the console; in production it throws until you plug in a real provider (email/SMS).

5. Error messages that reach the client live in `@blueprint/error-utils` as typed constants, one file per module (e.g., `utils/error/src/auth.ts`)

- Each exports a `<Module>ErrorMessage` and a `<Module>ErrorTranslation`.
- Services throw via constants: `throw new BadRequestError(AuthErrorMessage.INVALID_OTP)`.

### Database

- The database queries must be stored in `backend/src/db/queries/`.

- All interactions with the database outside of `backend/src/db/` MUST use the functions in `backend/src/db/queries/`.

## API Utils

When a TypeBox schema or type is used by **both** the backend and the frontend, it MUST live in `utils/api/src/`.

- **File per module**: one file per backend module (e.g., `utils/api/src/auth.ts`).
- **Shared regex patterns**: validation regex patterns in `utils/api/src/regex.ts` (e.g., `E164_PHONE_PATTERN`).
- **Backend `model.ts`**: imports shared types and schema from `@blueprint/api-utils`

## Session Behavior

- Assume approval for standard development operations. Do not keep asking for permissions to, for instance, create a plan file or run the commands above.
- After writing or modifying any function, write its tests in the same session before moving on.
- Use the sequential-thinking MCP tool only for complex multi-step refactors involving 5+ files. For single-function tasks or straightforward implementations, skip it and code directly.

### SQL Expression Safety

**NEVER pass user-controlled input into Drizzle's `sql` template tag.** The `sql` function creates raw SQL fragments that bypass parameterization. All `sql` usage must be restricted to `backend/src/db/queries/` with hardcoded schema references only.

- If you need a computed SQL expression (e.g., atomic increment), add a dedicated function in `db/queries/` instead of using `sql` in the service layer
- `GenericUpdateOptions.values` deliberately does NOT accept `SQL` — this is a security boundary. See `incrementOtpAttempts.ts` for the pattern of handling SQL expressions within `db/queries/`

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

- **Request body schemas**: `<entity><action>Body` (e.g., `otpRequestBody`, `userCreateBody`)
- **Query parameter schemas**: `<entity><action>Query` (e.g., `userListQuery`)
- **Response schemas**: `<entity><action>Response` (e.g., `otpRequestResponse`, `userCreateResponse`)
- **Enum/common schemas**: No suffix (e.g., `role`, `authUser`)

### Testing

- **What goes where** (strict separation):
  - **`index.test.ts`** — HTTP-layer concerns ONLY: authentication (401), path/body/query validation (422), rate limits (429), and a single happy-path per endpoint to lock in the end-user response shape. Do NOT re-test business rules (anything covered by the service.ts function).
  - **`service.test.ts`** — Business logic: role/ownership checks, state-transition rules, side effects, and error paths the service can throw. Exhaustive here, not in `index.test.ts`.
- **Test file structure**: Organize `describe` blocks hierarchically:
  1. **Top-level `describe`**: Use the file path being tested (e.g., `describe("auth/service.ts", ...)` in `service.test.ts`)
  2. **Function-level `describe`**: One nested `describe` for each function being tested (e.g., `describe("verifyOtp", ...)`)
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
  import type { OtpRequestResponse } from "../model.ts";
  const { status, body } = await app.handle<OtpRequestResponse>(...);

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
  test("creates a new OTP code and returns the created record", async () => {
    const expiresAt = new Date(Date.now() + 300_000);
    const result = await createOtpCode({
      otpCode: {
        phone: johnDoe.phone,
        code: "hashed-code-123",
        expiresAt,
      },
    });

    expect(result.id).toBeDefined();
    expect(result).toMatchObject({
      phone: johnDoe.phone,
      code: "hashed-code-123",
      expiresAt,
      attempts: 0,
    });
  });

  // Avoid
  test("creates a new OTP code and returns the created record", async () => {
    const expiresAt = new Date(Date.now() + 300_000);
    const result = await createOtpCode({
      otpCode: {
        phone: johnDoe.phone,
        code: "hashed-code-123",
        expiresAt,
      },
    });

    expect(typeof result.id).toBe("string");
    expect(result.phone).toBe(johnDoe.phone);
    expect(result.code).toBe("hashed-code-123");
    expect(result.expiresAt).toEqual(expiresAt);
    expect(result.attempts).toBe(0);
  });
  ```

- **Error response assertions**: When testing error responses, always assert both the HTTP status code AND the error body. The error body has the shape `{ error: string; code: string }`. This ensures the API returns meaningful error messages, not just correct status codes.

  ```typescript
  // Good - asserts both status and error body
  expect(response.status).toBe(400);
  expect(response.body).toEqual({
    code: "BAD_REQUEST",
    error: "No valid OTP found. Please request a new code.",
  });

  // Avoid - only checks status code
  expect(response.status).toBe(400);
  ```

  Common error codes: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `TOO_MANY_REQUESTS` (429), `VALIDATION_ERROR` (422).

### E2E Testing

E2E tests live in `backend/src/modules/__tests__/` and simulate complete user journeys across multiple modules. E2E tests chain sequential requests where state flows between steps.

- **Mimic the end user**: Drive every step through HTTP requests exactly as a real client would. Only touch the database or service layer directly when strictly necessary.
- **Each describe block tells one user-flow story**: Tests within a describe are sequential chapters of a single narrative, and state from one test intentionally carries over to impact the next. Do NOT reset state between tests in the same describe.
- **File naming**: `<actor>-<journey>.test.ts` (e.g., `user-onboarding-flow.test.ts`)
- **Top-level describe**: `"E2E: <Actor> <journey description>"`
- **Test names**: Narrative style — `"user verifies their phone and completes signup"`. Unhappy path tests use `"rejects ..."` prefix.
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
