import { NextResponse } from "next/server";
import { REQUEST_ID_HEADER } from "@/config/constants";
import type { AppError } from "@/lib/errors";
import { RateLimitedError } from "@/lib/errors";
import type { ApiErrorBody, ApiSuccess } from "@/types/api";

/**
 * The single place API responses are constructed.
 *
 * Every response carries `{ data }` or `{ error }` plus a request id, so clients
 * and logs can always be correlated (docs/10-API-CONTRACT.md section 3).
 */

export type ResponseMeta = {
  requestId: string;
  status?: number;
  headers?: Record<string, string>;
};

export function apiSuccess<T>(data: T, meta: ResponseMeta): NextResponse<ApiSuccess<T>> {
  return NextResponse.json<ApiSuccess<T>>(
    { data },
    {
      status: meta.status ?? 200,
      headers: { [REQUEST_ID_HEADER]: meta.requestId, ...meta.headers },
    },
  );
}

export function apiCreated<T>(data: T, meta: ResponseMeta): NextResponse<ApiSuccess<T>> {
  return apiSuccess(data, { ...meta, status: meta.status ?? 201 });
}

export function apiNoContent(meta: ResponseMeta): NextResponse<null> {
  return new NextResponse(null, {
    status: 204,
    headers: { [REQUEST_ID_HEADER]: meta.requestId, ...meta.headers },
  }) as NextResponse<null>;
}

export function apiError(error: AppError, meta: ResponseMeta): NextResponse<ApiErrorBody> {
  const headers: Record<string, string> = {
    [REQUEST_ID_HEADER]: meta.requestId,
    ...meta.headers,
  };

  if (error instanceof RateLimitedError) {
    headers["Retry-After"] = String(error.retryAfterSeconds);
  }

  return NextResponse.json<ApiErrorBody>(
    { error: error.toJSON() },
    { status: meta.status ?? error.httpStatus, headers },
  );
}
