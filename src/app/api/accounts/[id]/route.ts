import { summariseAccount } from "@/domain/accounts/calculations";
import {
  accountIdParamSchema,
  updateAccountSchema,
} from "@/features/accounts/schemas/account-schemas";
import { toAccountView } from "@/features/accounts/view-models/account-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { loadAccountMovements } from "@/server/services/accounts/account-balances";
import {
  archiveAccount,
  getAccount,
  updateAccount,
} from "@/server/services/accounts/account-service";

export const runtime = "nodejs";

/**
 * Route params are validated like any other untrusted input: a malformed id is a
 * 404 rather than a database error
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 8).
 */
function accountIdOf(params: Record<string, string | string[]>): string {
  return accountIdParamSchema.parse(params).id;
}

/** GET /api/accounts/:id - account details with derived balance figures. */
export const GET = withAuthApi({ operation: "accounts.get", rateLimit: "read" }, async (ctx) => {
  const accountId = accountIdOf(ctx.params);

  const account = await getAccount(ctx.userId, accountId);
  const movements = await loadAccountMovements(ctx.userId);

  return apiSuccess(toAccountView(account, summariseAccount(account, movements)), {
    requestId: ctx.requestId,
  });
});

/**
 * PATCH /api/accounts/:id
 *
 * Editable: name, institution, opening balance and card terms. Type and currency
 * are immutable because changing them would reinterpret existing transactions.
 */
export const PATCH = withAuthApi(
  { operation: "accounts.update", rateLimit: "write" },
  async (ctx) => {
    const accountId = accountIdOf(ctx.params);
    const input = await ctx.body(updateAccountSchema);

    const account = await updateAccount(ctx.userId, accountId, ctx.user.currency, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.openingBalance !== undefined ? { openingBalance: input.openingBalance } : {}),
      ...(input.institutionName !== undefined ? { institutionName: input.institutionName } : {}),
      ...(input.creditLimit !== undefined ? { creditLimit: input.creditLimit } : {}),
      ...(input.statementDay !== undefined ? { statementDay: input.statementDay } : {}),
      ...(input.paymentDueDay !== undefined ? { paymentDueDay: input.paymentDueDay } : {}),
      ...(input.expectedSyncVersion !== undefined
        ? { expectedSyncVersion: input.expectedSyncVersion }
        : {}),
    });

    const movements = await loadAccountMovements(ctx.userId);

    return apiSuccess(toAccountView(account, summariseAccount(account, movements)), {
      requestId: ctx.requestId,
    });
  },
);

/**
 * DELETE /api/accounts/:id
 *
 * Archives rather than deletes. Financial history keeps referencing the account.
 */
export const DELETE = withAuthApi(
  { operation: "accounts.archive", rateLimit: "write" },
  async (ctx) => {
    const accountId = accountIdOf(ctx.params);

    const account = await archiveAccount(ctx.userId, accountId);
    const movements = await loadAccountMovements(ctx.userId);

    return apiSuccess(toAccountView(account, summariseAccount(account, movements)), {
      requestId: ctx.requestId,
    });
  },
);
