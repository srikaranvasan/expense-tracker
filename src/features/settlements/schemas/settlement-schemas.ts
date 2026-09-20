import { z } from "zod";
import { LIMITS, PAGINATION } from "@/config/constants";
import {
  clientIdString,
  isoDate,
  objectIdString,
  positiveMoneyString,
} from "@/lib/validation/helpers";

/**
 * Settlement request schemas.
 *
 * The schema checks shape. Whether the allocations add up, whether each is within the
 * remaining amount, and whether the direction matches each obligation are business
 * rules enforced in `server/services/settlements/settlement-service.ts` inside a
 * database transaction.
 */

const directionSchema = z.enum(["user_to_person", "person_to_user"]);

const allocationSchema = z.object({
  expenseSplitId: objectIdString,
  amount: positiveMoneyString,
});

export const createSettlementSchema = z.object({
  clientId: clientIdString,
  allocationClientIds: z.array(clientIdString).optional(),
  personId: objectIdString,
  direction: directionSchema,
  amount: positiveMoneyString,
  /** Optional: a cash settlement has no account. */
  accountId: objectIdString.nullish(),
  date: isoDate,
  notes: z.string().trim().max(LIMITS.notesMaxLength).nullish(),
  /**
   * Required and non-empty. An unallocated settlement would move money without
   * reducing any balance, because balances are derived from allocations alone.
   */
  allocations: z
    .array(allocationSchema)
    .min(1, "Choose which expenses this payment settles.")
    .max(
      LIMITS.maxAllocationsPerSettlement,
      `A payment can settle at most ${LIMITS.maxAllocationsPerSettlement} expenses at once.`,
    ),
});

export type CreateSettlementRequest = z.infer<typeof createSettlementSchema>;

export const listSettlementsQuerySchema = z.object({
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
  personId: objectIdString.optional(),
  from: isoDate.optional(),
  to: isoDate.optional(),
});

export const settlementIdParamSchema = z.object({ id: objectIdString });
