import { createSharedExpenseSchema } from "@/features/transactions/schemas/shared-expense-schemas";
import { toTransactionListItem } from "@/features/transactions/view-models/expense-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiCreated } from "@/server/api/response";
import { createSharedExpense } from "@/server/services/transactions/shared-expense-service";

export const runtime = "nodejs";

/**
 * POST /api/expenses/shared
 *
 * Records an expense split between the user and one or more people. Separate from
 * `POST /api/expenses` because the payload is genuinely different: it carries a split
 * method and a participant list, and the account is optional because another person
 * may have paid.
 *
 * The transaction and every split row are written atomically, and the shares are
 * guaranteed to sum exactly to the total.
 */
export const POST = withAuthApi(
  { operation: "expenses.createShared", rateLimit: "write" },
  async (ctx) => {
    const input = await ctx.body(createSharedExpenseSchema);

    const { transaction, splits } = await createSharedExpense(ctx.userId, ctx.user.currency, {
      clientId: input.clientId,
      ...(input.splitClientIds ? { splitClientIds: input.splitClientIds } : {}),
      amount: input.amount,
      description: input.description,
      date: input.date,
      accountId: input.accountId ?? null,
      categoryId: input.categoryId ?? null,
      notes: input.notes ?? null,
      paidByPersonId: input.paidByPersonId ?? null,
      splitMethod: input.splitMethod,
      participants: input.participants,
    });

    return apiCreated(toTransactionListItem(transaction, splits, ctx.user.timezone), {
      requestId: ctx.requestId,
    });
  },
);
