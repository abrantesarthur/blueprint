/** Machine-readable error codes returned by the API. */
export const ErrorCode = {
  /** Invalid request data or parameters (HTTP 400). */
  BAD_REQUEST: "BAD_REQUEST",
  /** Missing or invalid authentication (HTTP 401). */
  UNAUTHORIZED: "UNAUTHORIZED",
  /** Authenticated but not allowed to access the resource (HTTP 403). */
  FORBIDDEN: "FORBIDDEN",
  /** Resource not found (HTTP 404). */
  NOT_FOUND: "NOT_FOUND",
  /** Resource conflict such as duplicate entries (HTTP 409). */
  CONFLICT: "CONFLICT",
  /** Request/response validation failure (HTTP 422). */
  VALIDATION_ERROR: "VALIDATION_ERROR",
  /** Rate limit exceeded (HTTP 429). */
  TOO_MANY_REQUESTS: "TOO_MANY_REQUESTS",
  /** Unexpected server error (HTTP 500). */
  INTERNAL_ERROR: "INTERNAL_ERROR",
  /** Upstream service (e.g. payment provider) failed (HTTP 502). */
  BAD_GATEWAY: "BAD_GATEWAY",
} as const;

/** Union type of all error code string values. */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/** Shape of an API error response body. */
export interface ApiErrorBody {
  /** Human-readable error message. */
  error: string;
  /** Machine-readable error code. */
  code?: ErrorCode;
  /** Structured metadata (e.g. counts, ids) accompanying the error. */
  details?: Record<string, unknown>;
}

/** Shape of a full HTTP error response with status and body. */
export interface ApiErrorResponse {
  /** The HTTP status code. */
  status: number;
  /** The error response body. */
  body: ApiErrorBody;
}

/** Maps each error code to its corresponding HTTP status code. */
export const ErrorCodeToHttpStatus: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.VALIDATION_ERROR]: 422,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,
  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.BAD_GATEWAY]: 502,
};
