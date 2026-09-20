import type { Money } from "@/lib/money";
import { subtractMoney, sumMoney } from "@/lib/money";
import type { SettlementAllocation } from "@/domain/settlements/entities";
import { summariseSplits } from "@/domain/settlements/calculations";
import type { SplitSettlementSummary } from "@/domain/settlements/calculations";
import type { ExpenseSplit, Transaction } from "@/domain/transactions/entities";
import type { PersonBalanceDirection, SplitStatus } from "@/types/common";

/**
 * Person balances.
 *
 * A balance is never stored. It is derived from expense splits and the settlement
 * allocations that reduce them, so the application can always explain where a
 * number came from (docs/09-DATABASE-SCHEMA.md section 20).
 */

export type ObligationDirection = "person_owes_user" | "user_owes_person";

/** One expense split paired with the transaction it belongs to. */
export type SplitWithTransaction = {
  transaction: Transaction;
  split: ExpenseSplit;
};

/**
 * Decides whether a split creates an obligation between the user and a person.
 *
 * Only two shapes matter:
 *   the user paid and a person owes their share    -> person owes user
 *   a person paid and the user owes their share    -> user owes person
 *
 * A split where person A paid and person B consumed is an obligation between two
 * other people. The user is not part of it, so it is not tracked
 * (docs/01-MVP-SCOPE.md sections 11-12).
 */
export function classifyObligation(
  transaction: Transaction,
  split: ExpenseSplit,
): { direction: ObligationDirection; personId: string } | null {
  if (transaction.type !== "expense") return null;
  if (transaction.deletedAt !== null || split.deletedAt !== null) return null;

  const paidBy = transaction.paidBy;
  if (!paidBy) return null;

  if (paidBy.type === "user" && split.participantType === "person" && split.personId) {
    return { direction: "person_owes_user", personId: split.personId };
  }

  if (paidBy.type === "person" && split.participantType === "user") {
    return { direction: "user_owes_person", personId: paidBy.personId };
  }

  return null;
}

/** One outstanding (or settled) obligation, with its settlement progress. */
export type PersonObligation = {
  personId: string;
  direction: ObligationDirection;
  transactionId: string;
  expenseSplitId: string;
  date: Date;
  description: string;
  originalAmount: Money;
  allocatedAmount: Money;
  remainingAmount: Money;
  status: SplitStatus;
};

/**
 * Builds the obligation list for every person the user shares expenses with.
 *
 * Ordered newest first, which is the order both the person page and the
 * settlement picker want.
 */
export function buildPersonObligations(
  entries: readonly SplitWithTransaction[],
  allocations: readonly SettlementAllocation[],
): PersonObligation[] {
  const summaries = summariseSplits(
    entries.map((entry) => entry.split),
    allocations,
  );

  const obligations: PersonObligation[] = [];

  for (const { transaction, split } of entries) {
    const classification = classifyObligation(transaction, split);
    if (!classification) continue;

    const summary = summaries.get(split.id);
    if (!summary) continue;

    obligations.push({
      personId: classification.personId,
      direction: classification.direction,
      transactionId: transaction.id,
      expenseSplitId: split.id,
      date: transaction.date,
      description: transaction.description,
      originalAmount: summary.originalAmount,
      allocatedAmount: summary.allocatedAmount,
      remainingAmount: summary.remainingAmount,
      status: summary.status,
    });
  }

  return obligations.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export type PersonBalance = {
  personId: string;
  currency: string;
  /** Still outstanding in the user's favour. */
  personOwesUser: Money;
  /** Still outstanding against the user. */
  userOwesPerson: Money;
  /** Positive when the person owes the user. */
  net: Money;
  direction: PersonBalanceDirection;
  /** Absolute value of `net`, for display. */
  netAbsolute: Money;
  isSettled: boolean;
  /** Number of obligations with anything still outstanding. */
  unsettledCount: number;
};

export function calculatePersonBalanceFromObligations(
  personId: string,
  obligations: readonly PersonObligation[],
  currency: string,
): PersonBalance {
  const mine = obligations.filter((obligation) => obligation.personId === personId);

  const personOwesUser = sumMoney(
    mine
      .filter((obligation) => obligation.direction === "person_owes_user")
      .map((obligation) => obligation.remainingAmount),
    currency,
  );

  const userOwesPerson = sumMoney(
    mine
      .filter((obligation) => obligation.direction === "user_owes_person")
      .map((obligation) => obligation.remainingAmount),
    currency,
  );

  const net = subtractMoney(personOwesUser, userOwesPerson);

  return {
    personId,
    currency,
    personOwesUser,
    userOwesPerson,
    net,
    direction: net.isZero()
      ? "settled"
      : net.isPositive()
        ? "person_owes_user"
        : "user_owes_person",
    netAbsolute: net.abs(),
    isSettled: net.isZero(),
    unsettledCount: mine.filter((obligation) => obligation.remainingAmount.isPositive()).length,
  };
}

export function calculatePersonBalance(
  personId: string,
  entries: readonly SplitWithTransaction[],
  allocations: readonly SettlementAllocation[],
  currency: string,
): PersonBalance {
  return calculatePersonBalanceFromObligations(
    personId,
    buildPersonObligations(entries, allocations),
    currency,
  );
}

/**
 * Balances for every person that appears in the data, plus any person id the
 * caller asks about explicitly so a person with no history still gets a
 * (settled) balance.
 */
export function calculatePersonBalances(
  entries: readonly SplitWithTransaction[],
  allocations: readonly SettlementAllocation[],
  currency: string,
  includePersonIds: readonly string[] = [],
): Map<string, PersonBalance> {
  const obligations = buildPersonObligations(entries, allocations);

  const personIds = new Set<string>(includePersonIds);
  for (const obligation of obligations) personIds.add(obligation.personId);

  const balances = new Map<string, PersonBalance>();
  for (const personId of personIds) {
    balances.set(personId, calculatePersonBalanceFromObligations(personId, obligations, currency));
  }

  return balances;
}

export type PeopleTotals = {
  /** Sum of everything people still owe the user. */
  peopleOweUser: Money;
  /** Sum of everything the user still owes people. */
  userOwesPeople: Money;
  net: Money;
};

/**
 * Totals for the dashboard.
 *
 * Uses each person's *net* position so that owing Arun ₹200 while he owes ₹500
 * reports ₹300 receivable rather than both figures at once.
 */
export function calculatePeopleTotals(
  balances: Iterable<PersonBalance>,
  currency: string,
): PeopleTotals {
  const receivable: Money[] = [];
  const payable: Money[] = [];

  for (const balance of balances) {
    if (balance.net.isPositive()) receivable.push(balance.net);
    else if (balance.net.isNegative()) payable.push(balance.net.abs());
  }

  const peopleOweUser = sumMoney(receivable, currency);
  const userOwesPeople = sumMoney(payable, currency);

  return {
    peopleOweUser,
    userOwesPeople,
    net: subtractMoney(peopleOweUser, userOwesPeople),
  };
}

/** Obligations with something still outstanding, for the settlement picker. */
export function unsettledObligationsFor(
  personId: string,
  obligations: readonly PersonObligation[],
  direction?: ObligationDirection,
): PersonObligation[] {
  return obligations.filter(
    (obligation) =>
      obligation.personId === personId &&
      obligation.remainingAmount.isPositive() &&
      (direction === undefined || obligation.direction === direction),
  );
}

export type { SplitSettlementSummary };
