import { expenseIdParamSchema } from "@/features/transactions/schemas/expense-schemas";
import { updateSharedExpenseSchema } from "@/features/transactions/schemas/shared-expense-schemas";
import { toTransactionListItem } from "@/features/transactions/view-models/expense-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { updateSharedExpense } from "@/server/services/transactions/shared-expense-service";

export const runtime = "nodejs";

/**
 * PATCH /api/expenses/shared/:id
 *
 * Edits a shared expense, optionally re-splitting it.
 *
 * Refused once any share has been settled: re-splitting would leave settlement
 * allocations pointing at shares that no longer exist. Changing the amount requires
 * sending the participants too, because the existing shares would no longer sum to the
 * new total.
 *
 * Deleting a shared expense uses `DELETE /api/expenses/:id`, which already handles
 * both kinds and refuses a settled expense.
 */
export const PATCH = withAuthApi(
  { operation: "expenses.updateShared", rateLimit: "write" },
  async (ctx) => {
    const { id } = expenseIdParamSchema.parse(ctx.params);
    const input = await ctx.body(updateSharedExpenseSchema);

    const { transaction, splits } = await updateSharedExpense(ctx.userId, id, ctx.user.currency, {
      ...(input.amount !== undefined ? { amount: input.amount } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.date !== undefined ? { date: input.date } : {}),
      ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
      ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.paidByPersonId !== undefined ? { paidByPersonId: input.paidByPersonId } : {}),
      ...(input.splitMethod !== undefined ? { splitMethod: input.splitMethod } : {}),
      ...(input.participants !== undefined ? { participants: input.participants } : {}),
      ...(input.expectedSyncVersion !== undefined
        ? { expectedSyncVersion: input.expectedSyncVersion }
        : {}),
    });

    return apiSuccess(toTransactionListItem(transaction, splits, ctx.user.timezone), {
      requestId: ctx.requestId,
    });
  },
);
