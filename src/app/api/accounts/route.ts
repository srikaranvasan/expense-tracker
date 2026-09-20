import {
  createAccountSchema,
  listAccountsQuerySchema,
} from "@/features/accounts/schemas/account-schemas";
import { toAccountView } from "@/features/accounts/view-models/account-view-model";
import { summariseAccount } from "@/domain/accounts/calculations";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiCreated, apiSuccess } from "@/server/api/response";
import {
  getAccountSummaries,
  loadAccountMovements,
} from "@/server/services/accounts/account-balances";
import { createAccount, listAccounts } from "@/server/services/accounts/account-service";

export const runtime = "nodejs";

/**
 * GET /api/accounts
 *
 * Returns the user's accounts with derived balances. Balances are computed here
 * rather than stored, so the response can never disagree with the transactions.
 */
export const GET = withAuthApi({ operation: "accounts.list", rateLimit: "read" }, async (ctx) => {
  const query = ctx.query(listAccountsQuerySchema);

  const accounts = await listAccounts(ctx.userId, {
    ...(query.type ? { type: query.type } : {}),
    includeArchived: query.includeArchived,
  });

  const summaries = await getAccountSummaries(ctx.userId, accounts);

  const items = accounts.map((account) => toAccountView(account, summaries.get(account.id)!));

  return apiSuccess({ items }, { requestId: ctx.requestId });
});

/** POST /api/accounts - creates a bank, cash or credit-card account. */
export const POST = withAuthApi(
  { operation: "accounts.create", rateLimit: "write" },
  async (ctx) => {
    const input = await ctx.body(createAccountSchema);

    const account = await createAccount(ctx.userId, ctx.user.currency, {
      clientId: input.clientId,
      name: input.name,
      type: input.type,
      currency: input.currency,
      openingBalance: input.openingBalance,
      institutionName: input.institutionName ?? null,
      creditLimit: input.creditLimit ?? null,
      statementDay: input.statementDay ?? null,
      paymentDueDay: input.paymentDueDay ?? null,
    });

    // A brand-new account has no movements, but the summary is built the same way
    // as everywhere else so the response shape never diverges.
    const movements = await loadAccountMovements(ctx.userId);

    return apiCreated(toAccountView(account, summariseAccount(account, movements)), {
      requestId: ctx.requestId,
    });
  },
);
