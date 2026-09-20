import { settlementIdParamSchema } from "@/features/settlements/schemas/settlement-schemas";
import { getSettlementDetailView } from "@/features/settlements/queries/settlement-queries";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiNoContent, apiSuccess } from "@/server/api/response";
import { deleteSettlement } from "@/server/services/settlements/settlement-service";

export const runtime = "nodejs";

function settlementIdOf(params: Record<string, string | string[]>): string {
  return settlementIdParamSchema.parse(params).id;
}

/** GET /api/settlements/:id - the payment and the expenses it settled. */
export const GET = withAuthApi({ operation: "settlements.get", rateLimit: "read" }, async (ctx) => {
  const settlement = await getSettlementDetailView(
    ctx.userId,
    settlementIdOf(ctx.params),
    ctx.user.timezone,
  );

  return apiSuccess(settlement, { requestId: ctx.requestId });
});

/**
 * DELETE /api/settlements/:id
 *
 * Soft-deletes the settlement and its allocations, which restores the balances it had
 * reduced. Removing the allocations is what does the restoring; they are the only thing
 * the balance calculation reads.
 *
 * This is also how a user unwinds a settlement in order to edit a settled expense.
 */
export const DELETE = withAuthApi(
  { operation: "settlements.delete", rateLimit: "write" },
  async (ctx) => {
    await deleteSettlement(ctx.userId, settlementIdOf(ctx.params));
    return apiNoContent({ requestId: ctx.requestId });
  },
);
