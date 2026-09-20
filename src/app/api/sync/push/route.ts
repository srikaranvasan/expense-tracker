import { syncPushRequestSchema } from "@/features/sync/schemas/sync-schemas";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { processSyncPush } from "@/server/services/sync/push-service";

export const runtime = "nodejs";

/**
 * POST /api/sync/push
 *
 * Applies a batch of operations queued on a client (docs/10-API-CONTRACT.md section 26).
 *
 * Always returns **200 with a result per operation**, even when some failed. A batch is
 * a set of independent commands, not a transaction: eight expenses queued offline with
 * one bad account reference should leave seven recorded, and an HTTP error for the whole
 * batch would tell the client nothing about which.
 *
 * The authenticated user is the only user whose data can be touched. Any `userId` in a
 * payload is ignored (docs/08-OFFLINE-SYNC.md section 38).
 */
/*
 * The `sync` bucket, not `write`.
 *
 * Sharing the interactive write budget meant a client looping on a large queue could
 * exhaust it and leave the user unable to save an expense by hand — the background task
 * starving the foreground one. `sync` is a separate 60/min allowance, and since a push
 * carries up to 50 operations that is still far more throughput than a draining queue
 * needs (docs/12-SECURITY-AND-ERROR-HANDLING.md section 17).
 */
export const POST = withAuthApi({ operation: "sync.push", rateLimit: "sync" }, async (ctx) => {
  const input = await ctx.body(syncPushRequestSchema);

  const results = await processSyncPush(ctx.user, input.operations);

  return apiSuccess({ results }, { requestId: ctx.requestId });
});
