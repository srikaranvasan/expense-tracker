import { personIdParamSchema, updatePersonSchema } from "@/features/people/schemas/person-schemas";
import { getPersonDetailView } from "@/features/people/queries/person-queries";
import { toPersonView } from "@/features/people/view-models/person-view-model";
import { calculatePersonBalanceFromObligations } from "@/domain/people/calculations";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiSuccess } from "@/server/api/response";
import { loadObligations } from "@/server/services/people/person-balances";
import { archivePerson, updatePerson } from "@/server/services/people/person-service";

export const runtime = "nodejs";

function personIdOf(params: Record<string, string | string[]>): string {
  return personIdParamSchema.parse(params).id;
}

/**
 * GET /api/people/:id
 *
 * Returns the person, their derived balance, the expenses that make it up, and
 * their settlement history (docs/10-API-CONTRACT.md section 6).
 */
export const GET = withAuthApi({ operation: "people.get", rateLimit: "read" }, async (ctx) => {
  const personId = personIdOf(ctx.params);

  const person = await getPersonDetailView(
    ctx.userId,
    personId,
    ctx.user.currency,
    ctx.user.timezone,
  );

  return apiSuccess(person, { requestId: ctx.requestId });
});

/** PATCH /api/people/:id */
export const PATCH = withAuthApi(
  { operation: "people.update", rateLimit: "write" },
  async (ctx) => {
    const personId = personIdOf(ctx.params);
    const input = await ctx.body(updatePersonSchema);

    const person = await updatePerson(ctx.userId, personId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
      ...(input.expectedSyncVersion !== undefined
        ? { expectedSyncVersion: input.expectedSyncVersion }
        : {}),
    });

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

/**
 * DELETE /api/people/:id
 *
 * Archives the person. Historical expenses keep referring to them, so the record
 * is never removed (docs/10-API-CONTRACT.md section 6).
 */
export const DELETE = withAuthApi(
  { operation: "people.archive", rateLimit: "write" },
  async (ctx) => {
    const personId = personIdOf(ctx.params);

    const person = await archivePerson(ctx.userId, personId);
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
