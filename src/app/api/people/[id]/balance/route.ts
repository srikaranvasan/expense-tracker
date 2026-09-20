import { personIdParamSchema } from "@/features/people/schemas/person-schemas";
import { toPersonBalanceView } from "@/features/people/view-models/person-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { getPersonBalance } from "@/server/services/people/person-balances";
import { getPerson } from "@/server/services/people/person-service";

export const runtime = "nodejs";

/**
 * GET /api/people/:id/balance
 *
 * The balance alone, for callers that do not need the full history. Calculated
 * from the underlying records, never read from a stored field
 * (docs/10-API-CONTRACT.md section 23).
 */
export const GET = withAuthApi({ operation: "people.balance", rateLimit: "read" }, async (ctx) => {
  const { id } = personIdParamSchema.parse(ctx.params);

  // Confirms ownership before any balance is computed or returned.
  await getPerson(ctx.userId, id);

  const { balance } = await getPersonBalance(ctx.userId, id, ctx.user.currency);

  return apiSuccess(
    { personId: id, ...toPersonBalanceView(balance) },
    { requestId: ctx.requestId },
  );
});
