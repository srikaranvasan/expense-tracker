import type { PersonObligation } from "@/domain/people/calculations";
import type { SplitStatus } from "@/types/common";

/**
 * Settlement state of a whole expense, rolled up from its obligations.
 *
 * The transaction list needs one badge per row, but settlement happens per *share*:
 * a dinner split three ways can have one person paid up and two not. This collapses
 * that into the single honest answer for the row.
 *
 * Only obligations count, not splits. The user's own share of an expense they paid for
 * themselves is nobody's debt, so an unshared expense has no settlement state at all
 * and gets no badge (docs/01-MVP-SCOPE.md sections 11-12).
 */

export type TransactionSettlementStatus = {
  /** Null when the expense creates no obligations, so there is nothing to settle. */
  status: SplitStatus | null;
  /** How many shares are still owed in part or full. */
  outstandingCount: number;
  /** How many shares carry an obligation at all. */
  obligationCount: number;
};

export const NO_SETTLEMENT_STATUS: TransactionSettlementStatus = {
  status: null,
  outstandingCount: 0,
  obligationCount: 0,
};

/**
 * Rolls a single expense's obligations into one status.
 *
 * `settled` requires *every* obligation to be settled. Reporting "settled" while one
 * participant still owes would be the most misleading thing this badge could do, so
 * the strict reading is deliberate: any remaining amount anywhere means the expense is
 * at best partly settled.
 */
export function deriveTransactionSettlementStatus(
  obligations: readonly PersonObligation[],
): TransactionSettlementStatus {
  if (obligations.length === 0) return NO_SETTLEMENT_STATUS;

  const outstanding = obligations.filter((obligation) => obligation.remainingAmount.isPositive());
  const anyAllocated = obligations.some((obligation) => obligation.allocatedAmount.isPositive());

  const status: SplitStatus =
    outstanding.length === 0 ? "settled" : anyAllocated ? "partially_settled" : "unsettled";

  return {
    status,
    outstandingCount: outstanding.length,
    obligationCount: obligations.length,
  };
}

/** Groups obligations by transaction and rolls each group up in one pass. */
export function summariseTransactionSettlements(
  obligations: readonly PersonObligation[],
): Map<string, TransactionSettlementStatus> {
  const byTransaction = new Map<string, PersonObligation[]>();

  for (const obligation of obligations) {
    const bucket = byTransaction.get(obligation.transactionId);
    if (bucket) bucket.push(obligation);
    else byTransaction.set(obligation.transactionId, [obligation]);
  }

  return new Map(
    [...byTransaction.entries()].map(
      ([transactionId, group]) =>
        [transactionId, deriveTransactionSettlementStatus(group)] as const,
    ),
  );
}
