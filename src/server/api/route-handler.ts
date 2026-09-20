import type { NextRequest } from "next/server";
import type { NextResponse } from "next/server";
import { describeError, errorStack } from "@/lib/errors";
import type { Logger } from "@/lib/logging/logger";
import { logger as rootLogger } from "@/lib/logging/logger";
import { resolveRequestId } from "@/lib/logging/request-id";
import { searchParamsToObject } from "@/lib/validation/helpers";
import { toApiError } from "@/server/errors/api-error";
import { apiError } from "./response";
import { clientIdentity, enforceRateLimit } from "./rate-limit";
import type { RateLimitBucket } from "./rate-limit";
import type { ZodType } from "zod";
import { ValidationError, fromZodError } from "@/lib/errors";

/**
 * Thin wrapper shared by every route handler.
 *
 * It owns the cross-cutting concerns - request id, logging, rate limiting and
 * error sanitising - so handlers stay focused on calling a use case
 * (docs/05-FOLDER-STRUCTURE.md section 11).
 */

export type RouteParams = Record<string, string | string[]>;

export type ApiContext = {
  request: NextRequest;
  requestId: string;
  log: Logger;
  /** Awaited dynamic route segments. */
  params: RouteParams;
  /** Parses and validates the JSON body. */
  body<T>(schema: ZodType<T>): Promise<T>;
  /** Parses and validates the query string. */
  query<T>(schema: ZodType<T>): T;
};

export type ApiHandler = (context: ApiContext) => Promise<NextResponse> | NextResponse;

export type ApiHandlerOptions = {
  /** Operation name used in logs. */
  operation: string;
  rateLimit?: RateLimitBucket;
  /** Overrides the rate-limit identity (authenticated routes use the user id). */
  rateLimitIdentity?: (context: ApiContext) => string;
};

type NextRouteArgs = { params?: Promise<RouteParams> };

async function readParams(args: NextRouteArgs | undefined): Promise<RouteParams> {
  if (!args?.params) return {};
  return await args.params;
}

async function parseBody<T>(request: NextRequest, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ValidationError("The request body must be valid JSON.");
  }

  const result = schema.safeParse(raw);
  if (!result.success) throw fromZodError(result.error);
  return result.data;
}

function parseQuery<T>(request: NextRequest, schema: ZodType<T>): T {
  const raw = searchParamsToObject(request.nextUrl.searchParams);
  const result = schema.safeParse(raw);
  if (!result.success) throw fromZodError(result.error);
  return result.data;
}

export function withApi(options: ApiHandlerOptions, handler: ApiHandler) {
  return async function route(request: NextRequest, args?: NextRouteArgs): Promise<NextResponse> {
    const startedAt = Date.now();
    const requestId = resolveRequestId(request.headers);
    const route = request.nextUrl.pathname;

    const log = rootLogger.child({
      requestId,
      operation: options.operation,
      route,
      method: request.method,
    });

    const context: ApiContext = {
      request,
      requestId,
      log,
      params: await readParams(args),
      body: (schema) => parseBody(request, schema),
      query: (schema) => parseQuery(request, schema),
    };

    try {
      if (options.rateLimit) {
        const identity = options.rateLimitIdentity
          ? options.rateLimitIdentity(context)
          : clientIdentity(request);
        enforceRateLimit(options.rateLimit, identity);
      }

      const response = await handler(context);

      log.info("request completed", {
        status: response.status,
        durationMs: Date.now() - startedAt,
      });

      return response;
    } catch (error) {
      const appError = toApiError(error);
      const durationMs = Date.now() - startedAt;

      if (appError.httpStatus >= 500) {
        log.error("request failed", {
          errorCode: appError.code,
          status: appError.httpStatus,
          durationMs,
          detail: describeError(error),
          stack: errorStack(error),
        });
      } else {
        log.warn("request rejected", {
          errorCode: appError.code,
          status: appError.httpStatus,
          durationMs,
        });
      }

      return apiError(appError, { requestId });
    }
  };
}
