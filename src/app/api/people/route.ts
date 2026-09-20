import { calculatePersonBalanceFromObligations } from "@/domain/people/calculations";
import {
  createPersonSchema,
  listPeopleQuerySchema,
} from "@/features/people/schemas/person-schemas";
import { toPersonView } from "@/features/people/view-models/person-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiCreated, apiSuccess } from "@/server/api/response";
import { loadObligations } from "@/server/services/people/person-balances";
import { createPerson, listPeople } from "@/server/services/people/person-service";

export const runtime = "nodejs";

/** GET /api/people - the user's contacts with their derived balances. */
export const GET = withAuthApi({ operation: "people.list", rateLimit: "read" }, async (ctx) => {
  const query = ctx.query(listPeopleQuerySchema);

  const people = await listPeople(ctx.userId, {
    includeArchived: query.includeArchived,
    ...(query.search ? { search: query.search } : {}),
  });

  // One obligation pass covers every person, instead of a query each.
  const { obligations } = await loadObligations(ctx.userId);

  const items = people.map((person) =>
    toPersonView(
      person,
      calculatePersonBalanceFromObligations(person.id, obligations, ctx.user.currency),
    ),
  );

  return apiSuccess({ items }, { requestId: ctx.requestId });
});

/** POST /api/people - adds a contact to split expenses with. */
export const POST = withAuthApi({ operation: "people.create", rateLimit: "write" }, async (ctx) => {
  const input = await ctx.body(createPersonSchema);

  const person = await createPerson(ctx.userId, {
    clientId: input.clientId,
    name: input.name,
    notes: input.notes ?? null,
  });

  const { obligations } = await loadObligations(ctx.userId);

  return apiCreated(
    toPersonView(
      person,
      calculatePersonBalanceFromObligations(person.id, obligations, ctx.user.currency),
    ),
    { requestId: ctx.requestId },
  );
});
