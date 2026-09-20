import { getTransactionListView } from "@/features/transactions/queries/expense-queries";
import {
  createPersonalExpenseSchema,
  listExpensesQuerySchema,
} from "@/features/transactions/schemas/expense-schemas";
import { toTransactionListItem } from "@/features/transactions/view-models/expense-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiCreated, apiSuccess } from "@/server/api/response";
import { createPersonalExpense } from "@/server/services/transactions/expense-service";

export const runtime = "nodejs";

/**
 * GET /api/expenses
 *
 * Cursor-paginated transaction list with filters. Keyset pagination is used because
 * offset pagination skips or repeats rows when the user adds an expense mid-scroll
 * (docs/06-CODING-PRACTICES.md section 43).
 */
export const GET = withAuthApi({ operation: "expenses.list", rateLimit: "read" }, async (ctx) => {
  const query = ctx.query(listExpensesQuerySchema);

  // The same read model the page uses, so a page fetched here and a page rendered on
  // the server are identical - including settlement badges and resolved names. Two
  // list shapes would eventually disagree about one of them.
  const view = await getTransactionListView(ctx.userId, ctx.user.timezone, {
    limit: query.limit,
    ...(query.cursor ? { cursor: query.cursor } : {}),
    ...(query.type ? { types: query.type } : {}),
    ...(query.accountId ? { accountId: query.accountId } : {}),
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.personId ? { personId: query.personId } : {}),
    ...(query.from ? { from: query.from } : {}),
    ...(query.to ? { to: query.to } : {}),
    ...(query.search ? { search: query.search } : {}),
    ...(query.shared !== undefined ? { shared: query.shared } : {}),
  });

  return apiSuccess(
    {
      items: view.items,
      nextCursor: view.nextCursor,
      hasMore: view.hasMore,
      // Sent alongside the rows so an appended page can label its accounts, categories
      // and payers without a second request.
      accountNames: view.accountNames,
      categoryNames: view.categoryNames,
      personNames: view.personNames,
    },
    { requestId: ctx.requestId },
  );
});

/**
 * POST /api/expenses
 *
 * Records an expense the user paid for themselves. The transaction and its single
 * user split are written atomically.
 */
export const POST = withAuthApi(
  { operation: "expenses.createPersonal", rateLimit: "write" },
  async (ctx) => {
    const input = await ctx.body(createPersonalExpenseSchema);

    const { transaction, splits } = await createPersonalExpense(ctx.userId, ctx.user.currency, {
      clientId: input.clientId,
      ...(input.splitClientId ? { splitClientId: input.splitClientId } : {}),
      amount: input.amount,
      description: input.description,
      date: input.date,
      accountId: input.accountId,
      categoryId: input.categoryId ?? null,
      notes: input.notes ?? null,
    });

    return apiCreated(toTransactionListItem(transaction, splits, ctx.user.timezone), {
      requestId: ctx.requestId,
    });
  },
);
