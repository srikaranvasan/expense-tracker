import { getCardPaymentListView } from "@/features/transactions/queries/card-payment-queries";
import {
  createCardPaymentSchema,
  listCardPaymentsQuerySchema,
} from "@/features/transactions/schemas/card-payment-schemas";
import { toCardPaymentListItem } from "@/features/transactions/view-models/card-payment-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiCreated, apiSuccess } from "@/server/api/response";
import { createCardPayment } from "@/server/services/transactions/card-payment-service";

export const runtime = "nodejs";

/**
 * GET /api/credit-card-payments
 *
 * Cursor-paginated card payments. `accountId` matches either side, so filtering by a
 * card returns its payment history and filtering by a bank account returns the
 * payments made from it.
 */
export const GET = withAuthApi(
  { operation: "cardPayments.list", rateLimit: "read" },
  async (ctx) => {
    const query = ctx.query(listCardPaymentsQuerySchema);

    const view = await getCardPaymentListView(ctx.userId, ctx.user.timezone, {
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.accountId ? { accountId: query.accountId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
      ...(query.search ? { search: query.search } : {}),
    });

    return apiSuccess(view, { requestId: ctx.requestId });
  },
);

/**
 * POST /api/credit-card-payments
 *
 * Pays down a credit card. The destination must be a card and the source must not be.
 * Paying more than is owed is allowed and leaves the card in credit.
 */
export const POST = withAuthApi(
  { operation: "cardPayments.create", rateLimit: "write" },
  async (ctx) => {
    const input = await ctx.body(createCardPaymentSchema);

    const payment = await createCardPayment(ctx.userId, ctx.user.currency, {
      clientId: input.clientId,
      amount: input.amount,
      fromAccountId: input.fromAccountId,
      toAccountId: input.toAccountId,
      date: input.date,
      description: input.description ?? null,
      notes: input.notes ?? null,
    });

    return apiCreated(toCardPaymentListItem(payment, ctx.user.timezone), {
      requestId: ctx.requestId,
    });
  },
);
