import { syncPullQuerySchema } from "@/features/sync/schemas/sync-schemas";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { pullChanges } from "@/server/services/sync/pull-service";

export const runtime = "nodejs";

/**
 * GET /api/sync/pull
 *
 * Returns records changed since the client's cursor (docs/10-API-CONTRACT.md section 28).
 *
 * Scoped to the authenticated user, so a cursor cannot be used to read anyone else's
 * changes. Cursors are opaque and validated, so a hand-crafted one is rejected rather
 * than reinterpreted.
 */
// The `sync` bucket keeps background pulls out of the interactive read budget.
export const GET = withAuthApi({ operation: "sync.pull", rateLimit: "sync" }, async (ctx) => {
  const query = ctx.query(syncPullQuerySchema);

  const page = await pullChanges(ctx.userId, {
    limit: query.limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.since ? { since: query.since } : {}),
  });

  return apiSuccess(page, { requestId: ctx.requestId });
});
