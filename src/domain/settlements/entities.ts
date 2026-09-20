import type { Money } from "@/lib/money";
import type { EntityBase, SoftDeleteMeta, SyncMeta } from "@/domain/shared/entities";
import type { SettlementDirection } from "@/types/common";

/**
 * Actual money moving between the user and a person to reduce a shared-expense
 * balance.
 *
 * A settlement is not an expense and must never be recorded as one
 * (docs/02-DATA-MODEL.md section 16).
 */
export type Settlement = EntityBase &
  SyncMeta &
  SoftDeleteMeta & {
    userId: string;
    personId: string;
    direction: SettlementDirection;
    amount: Money;
    /** The user's account the money left from or arrived in, when tracked. */
    accountId: string | null;
    date: Date;
    notes: string | null;
  };

/**
 * Links a settlement to a specific expense split.
 *
 * This is what lets the application answer "which exact expense was settled?" and
 * support partial settlement (docs/09-DATABASE-SCHEMA.md section 17).
 */
export type SettlementAllocation = EntityBase &
  SyncMeta &
  SoftDeleteMeta & {
    userId: string;
    settlementId: string;
    expenseSplitId: string;
    amount: Money;
  };

export type SettlementWithAllocations = {
  settlement: Settlement;
  allocations: SettlementAllocation[];
};

/** "You paid Arun" versus "Arun paid you". */
export function isUserPaying(settlement: Settlement): boolean {
  return settlement.direction === "user_to_person";
}

export const SETTLEMENT_DIRECTION_LABELS: Record<SettlementDirection, string> = {
  user_to_person: "You paid",
  person_to_user: "They paid you",
};
