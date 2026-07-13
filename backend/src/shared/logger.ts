import { createLogger, type Logger } from "@blueprint/logger-utils";

import { env } from "../config";

/**
 * The backend's shared structured logger: JSON lines to stdout, level taken
 * from the validated `LOG_LEVEL` env var (`silent` in tests via the mocked
 * config). Import this instance everywhere in `backend/src` instead of
 * constructing new loggers.
 */
export const logger: Logger = createLogger({ level: env.LOG_LEVEL });
