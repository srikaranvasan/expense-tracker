import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { REQUEST_ID_HEADER } from "@/config/constants";
import { RateLimitedError } from "@/lib/errors";
import { resolveRequestId } from "@/lib/logging/request-id";
import { logger } from "@/lib/logging/logger";
import { clientIdentity, enforceRateLimit } from "@/server/api/rate-limit";
import { handlers } from "@/server/auth/auth";

/**
 * Auth.js endpoints: sign-in, sign-out, session, CSRF token.
 * Runs on the Node runtime because credential verification needs MongoDB and bcrypt.
 */
export const runtime = "nodejs";

export const GET = handlers.GET;

/**
 * Paths where a POST costs a password verification.
 *
 * Auth.js serves several POST endpoints under this one route, and only these two carry
 * credentials. Limiting the whole route would put sign-out and the CSRF token in the same
 * ten-per-minute budget as sign-in attempts, so a user who signed in and out a few times
 * would be locked out of their own session management.
 */
const CREDENTIAL_PATHS = ["/api/auth/callback", "/api/auth/signin"];

function isCredentialSubmission(pathname: string): boolean {
  return CREDENTIAL_PATHS.some((prefix) => pathname.startsWith(prefix));
}

/**
 * Rate-limited sign-in.
 *
 * `withApi` is not used here: it would wrap the response in this application's
 * `{ data } | { error }` envelope, and Auth.js needs to own its own responses — the
 * redirects and cookies it sets are part of the protocol. So the limiter is applied
 * directly and the framework handler is called only if the request passes.
 *
 * Without this the endpoint was unlimited, which is what
 * docs/12-SECURITY-AND-ERROR-HANDLING.md section 16 forbids: "Do not implement unlimited
 * authentication attempts." Every attempt runs a bcrypt comparison, so unlimited attempts
 * are both a credential-stuffing surface and a cheap way to saturate the server's CPU.
 *
 * Keyed on caller identity rather than the submitted email, so rotating the email does not
 * buy a fresh budget.
 */
export async function POST(request: NextRequest): Promise<Response> {
  if (!isCredentialSubmission(request.nextUrl.pathname)) {
    return handlers.POST(request);
  }

  const requestId = resolveRequestId(request.headers);

  try {
    enforceRateLimit("auth", clientIdentity(request));
  } catch (error) {
    if (!(error instanceof RateLimitedError)) throw error;

    // Logged as a warning, without the submitted credentials: a burst here is worth
    // noticing (section 39).
    logger.warn("sign-in rate limit exceeded", {
      requestId,
      operation: "auth.signin",
      route: request.nextUrl.pathname,
      errorCode: error.code,
    });

    return NextResponse.json(
      { error: error.toJSON() },
      {
        status: error.httpStatus,
        headers: {
          [REQUEST_ID_HEADER]: requestId,
          "Retry-After": String(error.retryAfterSeconds),
        },
      },
    );
  }

  return handlers.POST(request);
}
