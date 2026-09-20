import type { ErrorCode } from "@/lib/errors";

/**
 * The API contract.
 *
 * Deliberately separate from the database document shapes: MongoDB documents are
 * never the contract (docs/10-API-CONTRACT.md section 22).
 */

export type ApiSuccess<T> = {
  data: T;
};

export type ApiErrorBody = {
  error: {
    code: ErrorCode | string;
    message: string;
    details?: Record<string, unknown>;
  };
};

export type ApiResponseBody<T> = ApiSuccess<T> | ApiErrorBody;

export function isApiError<T>(body: ApiResponseBody<T>): body is ApiErrorBody {
  return "error" in body;
}

/** Field-level messages produced by schema validation. */
export type FieldErrors = Record<string, string[]>;

export type ApiListResponse<T> = ApiSuccess<{
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}>;
