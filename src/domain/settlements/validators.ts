import { LIMITS } from "@/config/constants";
import {
  InvalidSettlementAllocationError,
  InvalidSettlementError,
  OverSettlementError,
} from "@/domain/shared/errors";
import {
  assertPositiveAmount,
  assertRoundedToCurrency,
  assertWithinCollectionLimit,
} from "@/domain/shared/invariants";
import type { Money } from "@/lib/money";
import { moneyGreaterThan, subtractMoney, sumMoney } from "@/lib/money";
import type { SettlementDirection } from "@/types/common";
import type { ObligationDirection } from "@/domain/people/calculations";

/**
 * Settlement validation.
 *
 * A settlement is real money changing hands to clear an existing shared-expense
 * balance. It is never an expense (docs/02-DATA-MODEL.md section 16), and the rules
 * here exist to keep it from becoming one or from claiming to clear more than is owed.
 */

/** What a settlement may be allocated against. */
export type AllocationTarget = {
  expenseSplitId: string;
  /** Which way this obligation runs. */
  direction: ObligationDirection;
  personId: string;
  originalAmount: Money;
  remainingAmount: Money;
};

export type AllocationRequest = {
  expenseSplitId: string;
  amount: Money;
};

export function assertValidSettlementAmount(amount: Money): void {
  assertPositiveAmount(amount, "Settlement amount");
  assertRoundedToCurrency(amount, "Settlement amount");
}

/**
 * The direction a settlement must have to clear a given obligation.
 *
 * A person owing the user is cleared by them paying the user, and vice versa.
 * Allowing the wrong pairing would *increase* the balance it claimed to reduce.
 */
export function requiredDirectionFor(obligation: ObligationDirection): SettlementDirection {
  return obligation === "person_owes_user" ? "person_to_user" : "user_to_person";
}

export function obligationDirectionFor(direction: SettlementDirection): ObligationDirection {
  return direction === "person_to_user" ? "person_owes_user" : "user_owes_person";
}

/**
 * Validates a settlement and its allocations against the current server state.
 *
 * `targets` must have been read inside the same database transaction as the write.
 * Reading them beforehand would leave a window in which two concurrent settlements
 * each pass this check while together exceeding what is owed
 * (docs/08-OFFLINE-SYNC.md section 34).
 */
export function assertValidAllocations(options: {
  settlementAmount: Money;
  direction: SettlementDirection;
  personId: string;
  allocations: readonly AllocationRequest[];
  targets: ReadonlyMap<string, AllocationTarget>;
}): void {
  const { settlementAmount, direction, personId, allocations, targets } = options;

  if (allocations.length === 0) {
    // An unallocated settlement would move money without reducing any balance,
    // because balances are derived from allocations alone.
    throw new InvalidSettlementAllocationError("Choose which expenses this payment settles.");
  }

  assertWithinCollectionLimit(
    allocations.length,
    LIMITS.maxAllocationsPerSettlement,
    "Allocations",
  );

  const seen = new Set<string>();
  const expectedObligation = obligationDirectionFor(direction);

  for (const allocation of allocations) {
    if (seen.has(allocation.expenseSplitId)) {
      throw new InvalidSettlementAllocationError(
        "The same expense cannot be settled twice in one payment.",
      );
    }
    seen.add(allocation.expenseSplitId);

    if (!allocation.amount.isPositive()) {
      throw new InvalidSettlementAllocationError(
        "Every allocated amount must be greater than zero.",
      );
    }

    assertRoundedToCurrency(allocation.amount, "Allocated amount");

    const target = targets.get(allocation.expenseSplitId);
    if (!target) {
      throw new InvalidSettlementAllocationError(
        "One of the selected expenses could not be found.",
      );
    }

    if (target.personId !== personId) {
      throw new InvalidSettlementAllocationError(
        "One of the selected expenses does not involve this person.",
      );
    }

    if (target.direction !== expectedObligation) {
      throw new InvalidSettlementAllocationError(
        direction === "person_to_user"
          ? "One of the selected expenses is money you owe, not money owed to you."
          : "One of the selected expenses is money owed to you, not money you owe.",
      );
    }

    if (target.remainingAmount.currency !== allocation.amount.currency) {
      throw new InvalidSettlementAllocationError(
        "The allocated amount must be in the same currency as the expense.",
      );
    }

    // The core guard: never settle more than is still outstanding on a share.
    if (moneyGreaterThan(allocation.amount, target.remainingAmount)) {
      throw new OverSettlementError({
        expenseSplitId: allocation.expenseSplitId,
        remaining: target.remainingAmount.toFixedString(),
        requested: allocation.amount.toFixedString(),
        currency: allocation.amount.currency,
      });
    }
  }

  assertAllocationsCoverSettlement(settlementAmount, allocations);
}

/**
 * A settlement must be fully allocated.
 *
 * `03-DATA-FLOW.md` section 11 prefers fully-allocated settlements for the MVP, and
 * the balance calculation depends on it: any unallocated remainder would be money that
 * moved between accounts without reducing anyone's balance, which the user would see as
 * a payment that did nothing.
 */
export function assertAllocationsCoverSettlement(
  settlementAmount: Money,
  allocations: readonly AllocationRequest[],
): void {
  const allocated = sumMoney(
    allocations.map((allocation) => allocation.amount),
    settlementAmount.currency,
  );

  if (!allocated.equals(settlementAmount)) {
    throw new InvalidSettlementError(
      "The amounts you are settling must add up to the payment amount.",
      {
        settlementAmount: settlementAmount.toFixedString(),
        allocatedAmount: allocated.toFixedString(),
        currency: settlementAmount.currency,
      },
    );
  }
}

/**
 * Suggests how to spread a payment across outstanding obligations, oldest first.
 *
 * Used to pre-fill the settlement form. Oldest-first is the convention people use when
 * clearing a tab, and it means a partial payment leaves the most recent expenses
 * outstanding rather than fragmenting every one of them.
 */
export function allocateOldestFirst(
  settlementAmount: Money,
  targets: readonly AllocationTarget[],
): AllocationRequest[] {
  const allocations: AllocationRequest[] = [];
  let remaining = settlementAmount;

  for (const target of targets) {
    if (!remaining.isPositive()) break;
    if (!target.remainingAmount.isPositive()) continue;

    const amount = moneyGreaterThan(remaining, target.remainingAmount)
      ? target.remainingAmount
      : remaining;

    allocations.push({ expenseSplitId: target.expenseSplitId, amount });
    remaining = subtractMoney(remaining, amount);
  }

  return allocations;
}

/** Total still outstanding across a set of obligations. */
export function totalRemaining(targets: readonly AllocationTarget[], currency: string): Money {
  return sumMoney(
    targets.map((target) => target.remainingAmount),
    currency,
  );
}

/**
 * A settlement cannot exceed what is currently outstanding in that direction.
 *
 * Checked before allocation so the user gets a clear message about the total rather
 * than an over-allocation error on whichever split happened to be last.
 */
export function assertSettlementWithinOutstanding(
  settlementAmount: Money,
  outstanding: Money,
): void {
  if (moneyGreaterThan(settlementAmount, outstanding)) {
    throw new InvalidSettlementError(
      `That is more than the ${outstanding.toFixedString()} ${outstanding.currency} currently outstanding.`,
      {
        settlementAmount: settlementAmount.toFixedString(),
        outstanding: outstanding.toFixedString(),
        currency: outstanding.currency,
      },
    );
  }
}
