import {
  type ApiErrorResponse,
  ErrorCode,
  ErrorCodeToHttpStatus,
} from "@blueprint/error-utils";

/**
 * Error class for database query failures.
 * Extracts the underlying database error message from Drizzle's wrapped errors,
 * providing a more readable message (e.g., Postgres constraint violation details)
 * instead of the raw SQL dump.
 */
export class DbError extends Error {
  /**
   * Creates a new DbError from a caught query error.
   * @param error - The original error thrown by the query executor.
   */
  constructor(error: unknown) {
    const err = error instanceof Error ? error : undefined;
    const message =
      err?.cause instanceof Error
        ? err.cause.message
        : (err?.message ?? "Unknown database error");
    super(message, { cause: err });
    this.name = "DbError";
  }
}

/** Base application error class with HTTP status code and error code support. */
class AppError extends Error {
  /** The HTTP status code derived from the error code. */
  public statusCode: number;

  /** Optional structured metadata accompanying the error (e.g. counts). */
  public details: Record<string, unknown> | undefined;

  /**
   * Creates a new application error.
   * @param code - The error code, used to derive the HTTP status code.
   * @param message - The error message.
   * @param details - Optional structured metadata accompanying the error.
   */
  constructor(
    public code: ErrorCode,
    message: string,
    details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = ErrorCodeToHttpStatus[code];
    this.details = details;
  }
}

/** Error for unauthorized access attempts (HTTP 401). */
export class UnauthorizedError extends AppError {
  /**
   * Creates a new unauthorized error.
   * @param message - The error message, defaults to "Unauthorized".
   */
  constructor(message: string = "Unauthorized") {
    super(ErrorCode.UNAUTHORIZED, message);
  }
}

/** Error for forbidden access to protected resources (HTTP 403). */
export class ForbiddenError extends AppError {
  /**
   * Creates a new forbidden error.
   * @param message - The error message, defaults to "Forbidden".
   */
  constructor(message: string = "Forbidden") {
    super(ErrorCode.FORBIDDEN, message);
  }
}

/** Error for resources that could not be found (HTTP 404). */
export class NotFoundError extends AppError {
  /**
   * Creates a new not found error.
   * @param message - The error message, defaults to "Not found".
   */
  constructor(message: string = "Not found") {
    super(ErrorCode.NOT_FOUND, message);
  }
}

/** Error for invalid request data or parameters (HTTP 400). */
export class BadRequestError extends AppError {
  /**
   * Creates a new bad request error.
   * @param message - The error message, defaults to "Bad request".
   */
  constructor(message: string = "Bad request") {
    super(ErrorCode.BAD_REQUEST, message);
  }
}

/** Error for resource conflicts like duplicate entries (HTTP 409). */
export class ConflictError extends AppError {
  /**
   * Creates a new conflict error.
   * @param message - The error message, defaults to "Conflict".
   * @param details - Optional structured metadata accompanying the error.
   */
  constructor(message: string = "Conflict", details?: Record<string, unknown>) {
    super(ErrorCode.CONFLICT, message, details);
  }
}

/** Error for rate limiting when too many requests are made (HTTP 429). */
export class TooManyRequestsError extends AppError {
  /**
   * Creates a new too many requests error.
   * @param message - The error message, defaults to "Too many requests".
   */
  constructor(message: string = "Too many requests") {
    super(ErrorCode.TOO_MANY_REQUESTS, message);
  }
}

/**
 * Formats an Elysia validation error message into a user-friendly format.
 * @param rawMessage - The raw validation error message from Elysia (JSON string).
 * @returns A formatted error message with the invalid field name.
 */
function formatValidationError(rawMessage: string | undefined): string {
  if (!rawMessage) return "Validation failed";

  try {
    const parsed = JSON.parse(rawMessage);
    // Extract property name from path (e.g., "/firstName" -> "firstName")
    const propertyName = parsed.property?.replace(/^\//, "") || "";

    if (!propertyName || propertyName === "root") {
      return "Invalid input. Make sure all values have an appropriate length and format.";
    }

    return `The '${propertyName}' property has an invalid value. Make sure it has an appropriate length and format.`;
  } catch {
    return "Validation failed";
  }
}

/**
 * Converts an error into a standardized HTTP response format.
 * @param error - The error to handle, can be any type.
 * @param path - Optional request path for more descriptive error messages.
 * @returns An object containing HTTP status and response body with error details.
 */
export function handleError(error: unknown, path?: string): ApiErrorResponse {
  if (error instanceof AppError) {
    return {
      status: error.statusCode,
      body: {
        error: error.message,
        code: error.code,
        ...(error.details ? { details: error.details } : {}),
      },
    };
  }

  // Handle Elysia's internal errors
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    "code" in error
  ) {
    const elysiaError = error as {
      status: number;
      code: string;
      message?: string;
    };

    // Handle validation errors (422)
    if (elysiaError.code === "VALIDATION") {
      const code = ErrorCode.VALIDATION_ERROR;
      return {
        status: ErrorCodeToHttpStatus[code],
        body: {
          error: formatValidationError(elysiaError.message),
          code,
        },
      };
    }

    // Handle NOT_FOUND error (unmatched routes)
    if (elysiaError.status === 404 && elysiaError.code === "NOT_FOUND") {
      const code = ErrorCode.NOT_FOUND;
      return {
        status: ErrorCodeToHttpStatus[code],
        body: {
          error: `Route not found${path ? `: '${path}'` : ""}`,
          code,
        },
      };
    }
  }

  console.error("Unhandled error:", error);
  const code = ErrorCode.INTERNAL_ERROR;
  return {
    status: ErrorCodeToHttpStatus[code],
    body: {
      error: "Internal server error",
      code,
    },
  };
}
