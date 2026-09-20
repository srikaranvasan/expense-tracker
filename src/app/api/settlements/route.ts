import {
  createSettlementSchema,
  listSettlementsQuerySchema,
} from "@/features/settlements/schemas/settlement-schemas";
import { getSettlementListView } from "@/features/settlements/queries/settlement-queries";
import { toSettlementView } from "@/features/settlements/view-models/settlement-view-model";
import { withAuthApi } from "@/server/api/authenticated-handler";
import { apiCreated, apiSuccess } from "@/server/api/response";
import { createSettlement } from "@/server/services/settlements/settlement-service";

export const runtime = "nodejs";

/** GET /api/settlements - settlement history, newest first. */
export const GET = withAuthApi(
  { operation: "settlements.list", rateLimit: "read" },
  async (ctx) => {
    const query = ctx.query(listSettlementsQuerySchema);

    const page = await getSettlementListView(ctx.userId, ctx.user.timezone, {
      limit: query.limit,
      ...(query.cursor ? { cursor: query.cursor } : {}),
      ...(query.personId ? { personId: query.personId } : {}),
      ...(query.from ? { from: query.from } : {}),
      ...(query.to ? { to: query.to } : {}),
    });

    return apiSuccess(page, { requestId: ctx.requestId });
  },
);

/**
 * POST /api/settlements
 *
 * Records money changing hands to clear a shared-expense balance. Every payment must
 * be allocated to specific expense shares: balances are derived from allocations, so an
 * unallocated payment would move money without settling anything.
 *
 * The settlement and its allocations are written in one database transaction, and the
 * remaining amount on each share is read inside that transaction so two concurrent
 * settlements cannot together exceed what is owed.
 */
export const POST = withAuthApi(
  { operation: "settlements.create", rateLimit: "write" },
  async (ctx) => {
    const input = await ctx.body(createSettlementSchema);

    const { settlement, allocations } = await createSettlement(ctx.userId, ctx.user.currency, {
      clientId: input.clientId,
      ...(input.allocationClientIds ? { allocationClientIds: input.allocationClientIds } : {}),
      personId: input.personId,
      direction: input.direction,
      amount: input.amount,
      accountId: input.accountId ?? null,
      date: input.date,
      notes: input.notes ?? null,
      allocations: input.allocations,
    });

    return apiCreated(
      toSettlementView(settlement, {
        timezone: ctx.user.timezone,
        allocationCount: allocations.length,
      }),
      { requestId: ctx.requestId },
    );
  },
);
