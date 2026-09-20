import { calculatePersonBalanceFromObligations } from "@/domain/people/calculations";
import { personIdParamSchema } from "@/features/people/schemas/person-schemas";
import { toPersonView } from "@/features/people/view-models/person-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { loadObligations } from "@/server/services/people/person-balances";
import { restorePerson } from "@/server/services/people/person-service";

export const runtime = "nodejs";

/** POST /api/people/:id/restore */
export const POST = withAuthApi(
  { operation: "people.restore", rateLimit: "write" },
  async (ctx) => {
    const { id } = personIdParamSchema.parse(ctx.params);

    const person = await restorePerson(ctx.userId, id);
    const { obligations } = await loadObligations(ctx.userId);

    return apiSuccess(
      toPersonView(
        person,
        calculatePersonBalanceFromObligations(person.id, obligations, ctx.user.currency),
      ),
      { requestId: ctx.requestId },
    );
  },
);
