import type { NextResponse } from "next/server";
import type { AuthenticatedUser } from "@/server/auth/session";
import { requireUser } from "@/server/auth/session";
import { enforceRateLimit } from "./rate-limit";
import type { RateLimitBucket } from "./rate-limit";
import type { ApiContext } from "./route-handler";
import { withApi } from "./route-handler";

/**
 * Route wrapper for every protected endpoint.
 *
 * Authentication happens before the handler body runs, and the rate-limit
 * identity becomes the user id rather than an IP address, so one user cannot
 * exhaust another's budget.
 */

export type AuthenticatedApiContext = ApiContext & {
  user: AuthenticatedUser;
  userId: string;
};

export type AuthenticatedApiHandler = (
  context: AuthenticatedApiContext,
) => Promise<NextResponse> | NextResponse;

export type AuthenticatedApiOptions = {
  operation: string;
  rateLimit?: RateLimitBucket;
};

export function withAuthApi(options: AuthenticatedApiOptions, handler: AuthenticatedApiHandler) {
  return withApi({ operation: options.operation }, async (ctx) => {
    const user = await requireUser();

    if (options.rateLimit) {
      enforceRateLimit(options.rateLimit, user.id);
    }

    return handler({
      ...ctx,
      user,
      userId: user.id,
      log: ctx.log.child({ userId: user.id }),
    });
  });
}
