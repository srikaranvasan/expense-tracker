import { getTransferDetailView } from "@/features/transactions/queries/transfer-queries";
import {
  transferIdParamSchema,
  updateTransferSchema,
} from "@/features/transactions/schemas/transfer-schemas";
import { toTransferListItem } from "@/features/transactions/view-models/transfer-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiNoContent, apiSuccess } from "@/server/api/response";
import { deleteTransfer, updateTransfer } from "@/server/services/transactions/transfer-service";

export const runtime = "nodejs";

function transferIdOf(params: Record<string, string | string[]>): string {
  return transferIdParamSchema.parse(params).id;
}

/** GET /api/transfers/:id - the transfer with both account names resolved. */
export const GET = withAuthApi({ operation: "transfers.get", rateLimit: "read" }, async (ctx) => {
  const transfer = await getTransferDetailView(
    ctx.userId,
    transferIdOf(ctx.params),
    ctx.user.timezone,
  );

  return apiSuccess(transfer, { requestId: ctx.requestId });
});

/**
 * PATCH /api/transfers/:id
 *
 * Edits a transfer. An id belonging to any other transaction type reports 404: an
 * expense must not become a transfer by being sent to this route.
 */
export const PATCH = withAuthApi(
  { operation: "transfers.update", rateLimit: "write" },
  async (ctx) => {
    const transferId = transferIdOf(ctx.params);
    const input = await ctx.body(updateTransferSchema);

    const transfer = await updateTransfer(ctx.userId, transferId, ctx.user.currency, {
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.fromAccountId !== undefined ? { fromAccountId: input.fromAccountId } : {}),
      ...(input.toAccountId !== undefined ? { toAccountId: input.toAccountId } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.expectedSyncVersion !== undefined
        ? { expectedSyncVersion: input.expectedSyncVersion }
        : {}),
    });

    return apiSuccess(toTransferListItem(transfer, ctx.user.timezone), {
      requestId: ctx.requestId,
    });
  },
);

/**
 * DELETE /api/transfers/:id
 *
 * Soft-deletes the transfer, which restores both account balances because they are
 * derived from the record rather than stored.
 */
export const DELETE = withAuthApi(
  { operation: "transfers.delete", rateLimit: "write" },
  async (ctx) => {
    await deleteTransfer(ctx.userId, transferIdOf(ctx.params));
    return apiNoContent({ requestId: ctx.requestId });
  },
);
