import { getDashboardView } from "@/features/dashboard/queries/dashboard-queries";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";

export const runtime = "nodejs";

/**
 * GET /api/dashboard
 *
 * Everything the dashboard needs in one response (docs/10-API-CONTRACT.md section 25).
 * One endpoint rather than six because the figures must all describe the same instant:
 * six separate requests could interleave with a write and show a spending total that
 * does not match the transaction list beside it.
 *
 * Every value is derived from the source records on each request. Nothing here is a
 * stored aggregate.
 */
export const GET = withAuthApi({ operation: "dashboard.get", rateLimit: "read" }, async (ctx) => {
  const view = await getDashboardView(ctx.userId, ctx.user.currency, ctx.user.timezone);

  return apiSuccess(view, { requestId: ctx.requestId });
});
