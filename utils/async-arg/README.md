# @blueprint/async-arg-utils

A utility package for defining asynchronous arguments that can be fetched from various sources (environment variables, Bitwarden secrets, etc.).

## Prerequisites

### Bitwarden Secrets Manager (optional)

If using `bwsName` to fetch secrets from Bitwarden, set these environment
variables with your machine-account credentials:

1. `BWS_ACCESS_TOKEN` — the machine-account access token
2. `BWS_ORGANIZATION_ID` — the organization id whose secrets to read

Secrets are fetched in-process via [`@blueprint/bitwarden-utils`](../bitwarden)
(the embedded Bitwarden WASM SDK); no `bws` CLI install is required.

## Usage

```ts
import AsyncArg from "@blueprint/async-arg-utils";

// Define an async argument from environment
export const SERVER_PORT = AsyncArg.number({
  description: "The port where the backend server is hosted.",
  envName: "SERVER_PORT",
});

// Or from Bitwarden secrets
export const API_KEY = AsyncArg.number({
  description: "The API key for external service.",
  bwsName: "API_KEY",
});

// Fetch the value when needed
const port = await SERVER_PORT.fetch();
```

## API

### `AsyncArg.number(options)`

Creates a number argument.

**Options:**

- `description` (string): Description of the argument
- `envName` (string): Environment variable name (mutually exclusive with `bwsName`)
- `bwsName` (string): Bitwarden secret name (mutually exclusive with `envName`)
- `default` (T, optional): Default value to use if fetch fails
- `sensitive` (boolean, optional): If true, wraps value in `Secret<T>` to prevent accidental logging

**Example with default:**

```ts
export const SERVER_PORT = AsyncArg.number({
  description: "The port where the backend server is hosted.",
  envName: "SERVER_PORT",
  default: 3000,
});
```

**Example with sensitive value:**

```ts
import AsyncArg from "@blueprint/async-arg-utils";

export const API_KEY = AsyncArg.number({
  description: "The API key for external service.",
  bwsName: "API_KEY",
  sensitive: true,
});

const apiKey = await API_KEY.fetch(); // Secret<number>

console.log(apiKey); // [redacted]
const actual = apiKey.release(); // number (unwrapped)
```

### `AsyncArg.string(options)`

Creates a string argument.

**Options:** Same as `AsyncArg.number`.

**Example:**

```ts
export const DB_HOST = AsyncArg.string({
  description: "Database host",
  envName: "DB_HOST",
  default: "localhost",
});
```

### `AsyncArg.boolean(options)`

Creates a boolean argument. Parses `"true"` and `"false"` (case-insensitive).

**Options:** Same as `AsyncArg.number`.

**Example:**

```ts
export const DEBUG_MODE = AsyncArg.boolean({
  description: "Enable debug mode",
  envName: "DEBUG",
  default: false,
});
```

## Future Improvements

1. **Caching**: Consider adding a caching feature in case performance or repeated requests to Bitwarden become a concern.
