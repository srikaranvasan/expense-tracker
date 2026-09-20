import { summariseAccount } from "@/domain/accounts/calculations";
import { accountIdParamSchema } from "@/features/accounts/schemas/account-schemas";
import { toAccountView } from "@/features/accounts/view-models/account-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { loadAccountMovements } from "@/server/services/accounts/account-balances";
import { restoreAccount } from "@/server/services/accounts/account-service";

export const runtime = "nodejs";

/** POST /api/accounts/:id/restore - brings an archived account back into use. */
export const POST = withAuthApi(
  { operation: "accounts.restore", rateLimit: "write" },
  async (ctx) => {
    const { id } = accountIdParamSchema.parse(ctx.params);

    const account = await restoreAccount(ctx.userId, id);
    const movements = await loadAccountMovements(ctx.userId);

    return apiSuccess(toAccountView(account, summariseAccount(account, movements)), {
      requestId: ctx.requestId,
    });
  },
);
