import { ERROR_CODES, isRetryableErrorCode } from "./error-codes";
import type { ErrorCode } from "./error-codes";

export type ErrorDetails = Record<string, unknown>;

/**
 * Base class for every error the application raises deliberately.
 *
 * Known business failures carry a stable code and an HTTP status so route
 * handlers never have to guess how to respond
 * (docs/06-CODING-PRACTICES.md sections 18-19).
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly details?: ErrorDetails;
  /** Safe to show to the user as-is. */
  readonly userMessage: string;

  constructor(
    code: ErrorCode,
    message: string,
    options: {
      httpStatus?: number;
      details?: ErrorDetails;
      userMessage?: string;
      cause?: unknown;
    } = {},
  ) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = new.target.name;
    this.code = code;
    this.httpStatus = options.httpStatus ?? 400;
    this.details = options.details;
    this.userMessage = options.userMessage ?? message;
  }

  get retryable(): boolean {
    return isRetryableErrorCode(this.code);
  }

  toJSON(): { code: ErrorCode; message: string; details?: ErrorDetails } {
    return {
      code: this.code,
      message: this.userMessage,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

/** Business-rule violation raised from the domain layer. */
export class DomainError extends AppError {}

export class ValidationError extends AppError {
  constructor(message = "The submitted data is invalid.", details?: ErrorDetails) {
    super(ERROR_CODES.VALIDATION_ERROR, message, { httpStatus: 400, details });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "You must be signed in to do that.") {
    super(ERROR_CODES.UNAUTHORIZED, message, { httpStatus: 401 });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "You do not have access to this resource.") {
    super(ERROR_CODES.FORBIDDEN, message, { httpStatus: 403 });
  }
}

/**
 * Used for both "does not exist" and "belongs to another user".
 *
 * Collapsing the two prevents the API from confirming that another user's record
 * exists (docs/12-SECURITY-AND-ERROR-HANDLING.md section 7).
 */
export class NotFoundError extends AppError {
  constructor(resource = "Resource") {
    super(ERROR_CODES.NOT_FOUND, `${resource} was not found.`, { httpStatus: 404 });
  }
}

export class ConflictError extends AppError {
  constructor(message = "This record was changed elsewhere.", details?: ErrorDetails) {
    super(ERROR_CODES.CONFLICT, message, { httpStatus: 409, details });
  }
}

export class RateLimitedError extends AppError {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(ERROR_CODES.RATE_LIMITED, "Too many requests. Please try again shortly.", {
      httpStatus: 429,
      details: { retryAfterSeconds },
    });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = "The service is temporarily unavailable. Please try again.") {
    super(ERROR_CODES.SERVICE_UNAVAILABLE, message, { httpStatus: 503 });
  }
}

export class InternalError extends AppError {
  constructor(message = "Something went wrong. Please try again.", cause?: unknown) {
    super(ERROR_CODES.INTERNAL_ERROR, message, { httpStatus: 500, cause });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
