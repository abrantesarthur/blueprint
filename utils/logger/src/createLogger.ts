import pino from "pino";

/** Structured logger instance produced by {@link createLogger}. */
export type Logger = pino.Logger;

/**
 * The log levels accepted by {@link createLogger}, ordered from most to least
 * severe. `silent` disables all output.
 */
export const LOG_LEVELS = [
  "fatal",
  "error",
  "warn",
  "info",
  "debug",
  "trace",
  "silent",
] as const;

/** A log level accepted by {@link createLogger}. */
export type LogLevel = (typeof LOG_LEVELS)[number];

/**
 * Checks whether an arbitrary string is a valid {@link LogLevel}.
 * @param value - The string to check (e.g. a raw configuration value).
 * @returns Whether the string is one of {@link LOG_LEVELS}.
 */
export function isLogLevel(value: string): value is LogLevel {
  return (LOG_LEVELS as readonly string[]).includes(value);
}

/** A minimal sink for serialized log lines, matching pino's stream contract. */
export interface LogDestination {
  /**
   * Writes one serialized log line (a JSON object terminated by a newline).
   * @param line - The serialized log line.
   */
  write: (line: string) => void;
}

/** Options for {@link createLogger}. */
export interface CreateLoggerOptions {
  /** Minimum level to emit; `silent` disables all output. */
  level: LogLevel;
  /**
   * Sink the serialized lines are written to. Defaults to stdout — injectable
   * so tests can capture output without touching process streams.
   */
  destination?: LogDestination;
}

/**
 * Creates a structured logger that writes one JSON object per line.
 *
 * The logger is environment-agnostic by design: it reads no environment
 * variables and knows nothing about any framework — the consumer decides the
 * level (and, in tests, the destination) and passes them in.
 *
 * @param options - The logger options ({@link CreateLoggerOptions}).
 * @returns A pino {@link Logger} writing JSON lines to the destination.
 */
export function createLogger({
  level,
  destination,
}: CreateLoggerOptions): Logger {
  return destination === undefined
    ? pino({ level })
    : pino({ level }, destination);
}
