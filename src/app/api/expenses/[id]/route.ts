import {
  expenseIdParamSchema,
  updatePersonalExpenseSchema,
} from "@/features/transactions/schemas/expense-schemas";
import { getExpenseDetailView } from "@/features/transactions/queries/expense-queries";
import { toTransactionListItem } from "@/features/transactions/view-models/expense-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiNoContent, apiSuccess } from "@/server/api/response";
import {
  deleteExpense,
  updatePersonalExpense,
} from "@/server/services/transactions/expense-service";

export const runtime = "nodejs";

function expenseIdOf(params: Record<string, string | string[]>): string {
  return expenseIdParamSchema.parse(params).id;
}

/** GET /api/expenses/:id - full detail including participants. */
export const GET = withAuthApi({ operation: "expenses.get", rateLimit: "read" }, async (ctx) => {
  const expense = await getExpenseDetailView(
    ctx.userId,
    expenseIdOf(ctx.params),
    ctx.user.timezone,
  );

  return apiSuccess(expense, { requestId: ctx.requestId });
});

/**
 * PATCH /api/expenses/:id
 *
 * Edits a personal expense. A shared expense reports 404 here - it needs the split
 * editor - and a settled expense is refused, because changing the amount would leave
 * settlement allocations pointing at a share that no longer exists.
 */
export const PATCH = withAuthApi(
  { operation: "expenses.updatePersonal", rateLimit: "write" },
  async (ctx) => {
    const expenseId = expenseIdOf(ctx.params);
    const input = await ctx.body(updatePersonalExpenseSchema);

    const { transaction, splits } = await updatePersonalExpense(
      ctx.userId,
      expenseId,
      ctx.user.currency,
      {
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.date !== undefined ? { date: input.date } : {}),
        ...(input.accountId !== undefined ? { accountId: input.accountId } : {}),
        ...(input.categoryId !== undefined ? { categoryId: input.categoryId } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.expectedSyncVersion !== undefined
          ? { expectedSyncVersion: input.expectedSyncVersion }
          : {}),
      },
    );

    return apiSuccess(toTransactionListItem(transaction, splits, ctx.user.timezone), {
      requestId: ctx.requestId,
    });
  },
);

/**
 * DELETE /api/expenses/:id
 *
 * Soft-deletes the expense and its splits. A settled expense is refused.
 */
export const DELETE = withAuthApi(
  { operation: "expenses.delete", rateLimit: "write" },
  async (ctx) => {
    await deleteExpense(ctx.userId, expenseIdOf(ctx.params));
    return apiNoContent({ requestId: ctx.requestId });
  },
);
