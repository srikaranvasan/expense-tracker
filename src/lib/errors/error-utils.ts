import type { ZodError } from "zod";
import type { AppError } from "./app-error";
import { InternalError, ValidationError, isAppError } from "./app-error";

/**
 * Converts a Zod failure into a ValidationError with per-field details the UI can
 * attach to form inputs.
 */
export function fromZodError(error: ZodError, message?: string): ValidationError {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join(".") : "_root";
    (fieldErrors[path] ??= []).push(issue.message);
  }

  const firstIssue = error.issues[0];
  const summary =
    message ??
    (firstIssue
      ? `${firstIssue.path.join(".") || "request"}: ${firstIssue.message}`
      : "The submitted data is invalid.");

  return new ValidationError(summary, { fieldErrors });
}

/**
 * Normalises anything thrown into an AppError.
 *
 * Unknown failures become a generic InternalError so implementation details
 * never reach the client (docs/12-SECURITY-AND-ERROR-HANDLING.md section 38).
 */
export function toAppError(error: unknown): AppError {
  if (isAppError(error)) return error;
  return new InternalError(undefined, error);
}

/** Diagnostic string for server logs only. Never returned to a client. */
export function describeError(error: unknown): string {
  if (error instanceof Error) {
    const cause =
      error.cause instanceof Error ? ` <- ${error.cause.name}: ${error.cause.message}` : "";
    return `${error.name}: ${error.message}${cause}`;
  }
  return String(error);
}

export function errorStack(error: unknown): string | undefined {
  return error instanceof Error ? error.stack : undefined;
}
