import { getTransferListView } from "@/features/transactions/queries/transfer-queries";
import {
  createTransferSchema,
  listTransfersQuerySchema,
} from "@/features/transactions/schemas/transfer-schemas";
import { toTransferListItem } from "@/features/transactions/view-models/transfer-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiCreated, apiSuccess } from "@/server/api/response";
import { createTransfer } from "@/server/services/transactions/transfer-service";

export const runtime = "nodejs";

/**
 * GET /api/transfers
 *
 * Cursor-paginated transfers. `accountId` matches either side, so filtering by an
 * account returns money moved both into and out of it.
 */
export const GET = withAuthApi({ operation: "transfers.list", rateLimit: "read" }, async (ctx) => {
  const query = ctx.query(listTransfersQuerySchema);

  const view = await getTransferListView(ctx.userId, ctx.user.timezone, {
    limit: query.limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.accountId ? { accountId: query.accountId } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.search ? { search: query.search } : {}),
  });

  return apiSuccess(view, { requestId: ctx.requestId });
});

/**
 * POST /api/transfers
 *
 * Records money moving between two accounts the user owns. Rejected if the two are
 * the same account, if either is archived, if their currencies differ, or if the
 * destination is a credit card - paying a card is a card payment, which is a
 * different business event with different effects on available credit.
 */
export const POST = withAuthApi(
  { operation: "transfers.create", rateLimit: "write" },
  async (ctx) => {
    const input = await ctx.body(createTransferSchema);

    const transfer = await createTransfer(ctx.userId, ctx.user.currency, {
      clientId: input.clientId,
      amount: input.amount,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      date: input.date,
      description: input.description ?? null,
      notes: input.notes ?? null,
    });

    return apiCreated(toTransferListItem(transfer, ctx.user.timezone), {
      requestId: ctx.requestId,
    });
  },
);
