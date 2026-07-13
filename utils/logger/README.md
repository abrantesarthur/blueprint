# @blueprint/logger-utils

Structured JSON logging built on [pino](https://getpino.io): one JSON object
per line to stdout, so the platform — not the app — handles log storage.

- `createLogger` — factory returning a pino logger. The level is passed in by
  the consumer (dependency injection): this package reads no environment
  variables and imports nothing from any workspace or framework.
- `LOG_LEVELS` / `LogLevel` / `isLogLevel` — the accepted levels and a type
  guard for validating raw configuration values.

```ts
import { createLogger } from "@blueprint/logger-utils";

const logger = createLogger({ level: "info" });
logger.info({ port: 3000 }, "server started");
```
