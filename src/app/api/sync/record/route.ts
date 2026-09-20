import { z } from "zod";
import { objectIdString } from "@/lib/validation/helpers";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { getCanonicalRecord } from "@/server/services/sync/pull-service";

export const runtime = "nodejs";

const querySchema = z.object({
  entityType: z.enum(["account", "person", "category", "transaction", "settlement"]),
  entityId: objectIdString,
});

/**
 * GET /api/sync/record
 *
 * The server's current copy of one record, for resolving a conflict.
 *
 * A client whose push was rejected as `SYNC_CONFLICT` needs to see what the server
 * actually holds before it can ask the user which version they meant
 * (docs/08-OFFLINE-SYNC.md section 28). Fetching the whole change feed to answer a
 * question about one record would be wasteful and slow.
 */
export const GET = withAuthApi({ operation: "sync.record", rateLimit: "sync" }, async (ctx) => {
  const query = ctx.query(querySchema);

  const change = await getCanonicalRecord(ctx.userId, query.entityType, query.entityId);

  return apiSuccess({ change }, { requestId: ctx.requestId });
});
