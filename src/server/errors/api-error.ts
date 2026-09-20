import { MongoServerError, MongoNetworkError, MongoNotConnectedError } from "mongodb";
import type { AppError } from "@/lib/errors";
import {
  ConflictError,
  InternalError,
  ServiceUnavailableError,
  ValidationError,
  fromZodError,
  isAppError,
} from "@/lib/errors";
import { ZodError } from "zod";

const DUPLICATE_KEY = 11000;

/**
 * Maps any thrown value to an AppError suitable for an HTTP response.
 *
 * Driver-level failures are translated here so raw MongoDB messages never leak
 * to clients (docs/12-SECURITY-AND-ERROR-HANDLING.md section 37).
 */
export function toApiError(error: unknown): AppError {
  if (isAppError(error)) return error;

  if (error instanceof ZodError) return fromZodError(error);

  if (error instanceof MongoServerError) {
    if (error.code === DUPLICATE_KEY) {
      return new ConflictError("This record has already been saved.", {
        reason: "duplicate_key",
      });
    }
    if (error.hasErrorLabel?.("TransientTransactionError")) {
      return new ServiceUnavailableError("The database is busy. Please try again.");
    }
    return new InternalError(undefined, error);
  }

  if (error instanceof MongoNetworkError || error instanceof MongoNotConnectedError) {
    return new ServiceUnavailableError("The database is temporarily unreachable.");
  }

  if (error instanceof SyntaxError) {
    return new ValidationError("The request body could not be parsed as JSON.");
  }

  return new InternalError(undefined, error);
}

/** True when a Mongo error is a duplicate-key violation on the given index. */
export function isDuplicateKeyError(error: unknown, indexName?: string): boolean {
  if (!(error instanceof MongoServerError) || error.code !== DUPLICATE_KEY) return false;
  if (!indexName) return true;
  return typeof error.message === "string" && error.message.includes(indexName);
}
