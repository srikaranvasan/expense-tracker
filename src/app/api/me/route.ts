import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";

export const runtime = "nodejs";

/**
 * GET /api/me
 *
 * The authenticated user's own profile. Never accepts a user id: the identity
 * comes from the session, so there is nothing here to enumerate.
 */
export const GET = withAuthApi({ operation: "users.me", rateLimit: "read" }, async (ctx) =>
  apiSuccess(
    {
      id: ctx.user.id,
      email: ctx.user.email,
      name: ctx.user.name,
      currency: ctx.user.currency,
      timezone: ctx.user.timezone,
      settings: ctx.user.settings,
    },
    { requestId: ctx.requestId },
  ),
);
