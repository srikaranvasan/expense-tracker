import type { Money } from "@/lib/money";
import { clampNonNegative, subtractMoney, sumMoney } from "@/lib/money";
import type { ExpenseSplit } from "@/domain/transactions/entities";
import type { SplitStatus } from "@/types/common";
import type { SettlementAllocation } from "./entities";

/**
 * Settlement arithmetic.
 *
 * How much of a split has been settled is always computed from its allocations.
 * Nothing stores `settledAmount` or `isSettled` as an independently editable
 * value (docs/09-DATABASE-SCHEMA.md section 21).
 */

/** Groups allocations by the split they apply to. */
export function indexAllocationsBySplit(
  allocations: readonly SettlementAllocation[],
): Map<string, SettlementAllocation[]> {
  const index = new Map<string, SettlementAllocation[]>();

  for (const allocation of allocations) {
    if (allocation.deletedAt !== null) continue;
    const bucket = index.get(allocation.expenseSplitId);
    if (bucket) {
      bucket.push(allocation);
    } else {
      index.set(allocation.expenseSplitId, [allocation]);
    }
  }

  return index;
}

/** Total already settled against one split. */
export function calculateAllocatedAmount(
  split: ExpenseSplit,
  allocations: readonly SettlementAllocation[],
): Money {
  const relevant = allocations.filter(
    (allocation) => allocation.expenseSplitId === split.id && allocation.deletedAt === null,
  );
  return sumMoney(
    relevant.map((allocation) => allocation.amount),
    split.shareAmount.currency,
  );
}

/**
 * How much of a split is still outstanding.
 *
 * Clamped at zero: over-allocation is rejected on write, and a negative
 * "remaining" would be meaningless if corrupt data ever appeared.
 */
export function calculateRemainingSplitAmount(
  split: ExpenseSplit,
  allocations: readonly SettlementAllocation[],
): Money {
  const allocated = calculateAllocatedAmount(split, allocations);
  return clampNonNegative(subtractMoney(split.shareAmount, allocated));
}

export function deriveSplitStatus(originalAmount: Money, allocatedAmount: Money): SplitStatus {
  const remaining = subtractMoney(originalAmount, allocatedAmount);

  if (!remaining.isPositive()) return "settled";
  if (allocatedAmount.isPositive()) return "partially_settled";
  return "unsettled";
}

export type SplitSettlementSummary = {
  expenseSplitId: string;
  transactionId: string;
  currency: string;
  originalAmount: Money;
  allocatedAmount: Money;
  remainingAmount: Money;
  status: SplitStatus;
};

export function summariseSplit(
  split: ExpenseSplit,
  allocations: readonly SettlementAllocation[],
): SplitSettlementSummary {
  const allocatedAmount = calculateAllocatedAmount(split, allocations);

  return {
    expenseSplitId: split.id,
    transactionId: split.transactionId,
    currency: split.shareAmount.currency,
    originalAmount: split.shareAmount,
    allocatedAmount,
    remainingAmount: clampNonNegative(subtractMoney(split.shareAmount, allocatedAmount)),
    status: deriveSplitStatus(split.shareAmount, allocatedAmount),
  };
}

/**
 * Summarises many splits with a single pass over the allocations.
 *
 * Filtering the whole allocation list per split would be quadratic on a person
 * with a long history.
 */
export function summariseSplits(
  splits: readonly ExpenseSplit[],
  allocations: readonly SettlementAllocation[],
): Map<string, SplitSettlementSummary> {
  const bySplit = indexAllocationsBySplit(allocations);
  const summaries = new Map<string, SplitSettlementSummary>();

  for (const split of splits) {
    const currency = split.shareAmount.currency;
    const allocated = sumMoney(
      (bySplit.get(split.id) ?? []).map((allocation) => allocation.amount),
      currency,
    );

    summaries.set(split.id, {
      expenseSplitId: split.id,
      transactionId: split.transactionId,
      currency,
      originalAmount: split.shareAmount,
      allocatedAmount: allocated,
      remainingAmount: clampNonNegative(subtractMoney(split.shareAmount, allocated)),
      status: deriveSplitStatus(split.shareAmount, allocated),
    });
  }

  return summaries;
}

/** Total of a settlement's allocations, used to check it is fully allocated. */
export function calculateAllocationTotal(
  allocations: readonly { amount: Money }[],
  currency: string,
): Money {
  return sumMoney(
    allocations.map((allocation) => allocation.amount),
    currency,
  );
}

export function isSplitFullySettled(summary: SplitSettlementSummary): boolean {
  return summary.status === "settled";
}

export function hasAnySettlement(summary: SplitSettlementSummary): boolean {
  return summary.allocatedAmount.isPositive();
}
