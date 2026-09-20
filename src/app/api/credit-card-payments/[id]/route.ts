import { getCardPaymentDetailView } from "@/features/transactions/queries/card-payment-queries";
import {
  cardPaymentIdParamSchema,
  updateCardPaymentSchema,
} from "@/features/transactions/schemas/card-payment-schemas";
import { toCardPaymentListItem } from "@/features/transactions/view-models/card-payment-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiNoContent, apiSuccess } from "@/server/api/response";
import {
  deleteCardPayment,
  updateCardPayment,
} from "@/server/services/transactions/card-payment-service";

export const runtime = "nodejs";

function paymentIdOf(params: Record<string, string | string[]>): string {
  return cardPaymentIdParamSchema.parse(params).id;
}

/**
 * GET /api/credit-card-payments/:id
 *
 * Includes the card's outstanding balance after this payment, recomputed from the
 * card's movements.
 */
export const GET = withAuthApi(
  { operation: "cardPayments.get", rateLimit: "read" },
  async (ctx) => {
    const payment = await getCardPaymentDetailView(
      ctx.userId,
      paymentIdOf(ctx.params),
      ctx.user.timezone,
    );

    return apiSuccess(payment, { requestId: ctx.requestId });
  },
);

/**
 * PATCH /api/credit-card-payments/:id
 *
 * Edits a card payment. An id belonging to any other transaction type reports 404: a
 * transfer must not become a card payment by being sent to this route.
 */
export const PATCH = withAuthApi(
  { operation: "cardPayments.update", rateLimit: "write" },
  async (ctx) => {
    const paymentId = paymentIdOf(ctx.params);
    const input = await ctx.body(updateCardPaymentSchema);

    const payment = await updateCardPayment(ctx.userId, paymentId, ctx.user.currency, {
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

    return apiSuccess(toCardPaymentListItem(payment, ctx.user.timezone), {
      requestId: ctx.requestId,
    });
  },
);

/**
 * DELETE /api/credit-card-payments/:id
 *
 * Soft-deletes the payment, which raises the card's outstanding balance again because
 * it is derived rather than stored.
 */
export const DELETE = withAuthApi(
  { operation: "cardPayments.delete", rateLimit: "write" },
  async (ctx) => {
    await deleteCardPayment(ctx.userId, paymentIdOf(ctx.params));
    return apiNoContent({ requestId: ctx.requestId });
  },
);
