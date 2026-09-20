import { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import type { ApiErrorBody, ApiSuccess } from "@/types/api";

/**
 * Helpers for exercising route handlers directly.
 *
 * Calling the handler is deliberate: it covers the same code path a real request
 * takes (wrapper, validation, auth, use case, repository, MongoDB) without needing
 * a running HTTP server.
 */

const BASE_URL = "http://localhost:3000";

export type RouteHandler = (
  request: NextRequest,
  args?: { params?: Promise<Record<string, string | string[]>> },
) => Promise<NextResponse>;

export function buildRequest(
  path: string,
  init: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
    searchParams?: Record<string, string | number | undefined>;
  } = {},
): NextRequest {
  const url = new URL(path, BASE_URL);

  for (const [key, value] of Object.entries(init.searchParams ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }

  const headers = new Headers({ "content-type": "application/json", ...init.headers });
  const method = init.method ?? "GET";
  const hasBody = init.body !== undefined && method !== "GET" && method !== "HEAD";

  return new NextRequest(url, {
    method,
    headers,
    ...(hasBody ? { body: JSON.stringify(init.body) } : {}),
  });
}

export async function callRoute(
  handler: RouteHandler,
  request: NextRequest,
  params?: Record<string, string | string[]>,
): Promise<NextResponse> {
  return handler(request, params ? { params: Promise.resolve(params) } : undefined);
}

export type ParsedResponse<T> = {
  status: number;
  body: ApiSuccess<T> | ApiErrorBody;
  requestId: string | null;
};

export async function parseResponse<T>(response: NextResponse): Promise<ParsedResponse<T>> {
  const text = await response.text();
  return {
    status: response.status,
    body: text ? (JSON.parse(text) as ApiSuccess<T> | ApiErrorBody) : ({} as ApiSuccess<T>),
    requestId: response.headers.get("x-request-id"),
  };
}

/** Asserts a success response and returns its `data`. */
export function expectData<T>(parsed: ParsedResponse<T>): T {
  if ("error" in parsed.body) {
    throw new Error(
      `Expected success but received ${parsed.status} ${parsed.body.error.code}: ${parsed.body.error.message}`,
    );
  }
  return parsed.body.data;
}

/** Asserts an error response and returns the error object. */
export function expectError<T>(parsed: ParsedResponse<T>): ApiErrorBody["error"] {
  if (!("error" in parsed.body)) {
    throw new Error(`Expected an error but received ${parsed.status} with data.`);
  }
  return parsed.body.error;
}

/** Convenience: request + call + parse. */
export async function invokeRoute<T>(
  handler: RouteHandler,
  path: string,
  init: Parameters<typeof buildRequest>[1] & {
    params?: Record<string, string | string[]>;
  } = {},
): Promise<ParsedResponse<T>> {
  const { params, ...requestInit } = init;
  const response = await callRoute(handler, buildRequest(path, requestInit), params);
  return parseResponse<T>(response);
}
