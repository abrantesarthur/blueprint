import { cors } from "@elysiajs/cors";
import { Elysia } from "elysia";

import { usersModule } from "./modules";
import { onError } from "./shared/hooks";
import { logger } from "./shared/logger";
import { globalIpRateLimitPlugin } from "./shared/middleware/rateLimit";
import { requestLoggerPlugin } from "./shared/middleware/requestLogger";

/**
 * Creates the Elysia app instance.
 * @returns Configured Elysia app (without .listen() called).
 */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createApp() {
  return (
    new Elysia({ normalize: true })
      .use(requestLoggerPlugin({ logger }))
      .use(
        cors({
          // FIXME: configure this properly in production
          origin: true,
          credentials: true,
        }),
      )
      .onError(onError)
      .use(globalIpRateLimitPlugin)
      // Health check
      .get("/health", () => ({
        status: "ok",
        timestamp: new Date().toISOString(),
      }))
      // API modules (JWT auth)
      .group("/api", (app) => app.use(usersModule))
  );
}
