import { Money, addMoney, subtractMoney, sumMoney } from "@/lib/money";
import type { Settlement } from "@/domain/settlements/entities";
import type { Transaction } from "@/domain/transactions/entities";
import type { Account } from "./entities";

/**
 * Derived account figures.
 *
 * Nothing here is stored. Balances, card outstanding and available credit are
 * always recalculated from the underlying financial events, so a displayed number
 * can always be traced back to the transactions that produced it
 * (docs/02-DATA-MODEL.md sections 20-21).
 */

/**
 * A single effect of a financial event on one account.
 *
 * Normalising events into movements keeps the balance rules in one place instead
 * of scattering "does this type add or subtract?" across the codebase.
 */
export type AccountMovementKind =
  | "expense"
  | "income"
  | "transfer_in"
  | "transfer_out"
  | "card_payment_in"
  | "card_payment_out"
  | "settlement_in"
  | "settlement_out";

export type AccountMovement = {
  accountId: string;
  kind: AccountMovementKind;
  amount: Money;
  date: Date;
};

/**
 * Direction of a movement for an asset account (bank or cash).
 * `+1` increases the balance, `-1` decreases it.
 */
const ASSET_DIRECTION: Record<AccountMovementKind, 1 | -1> = {
  expense: -1,
  income: 1,
  transfer_in: 1,
  transfer_out: -1,
  // Paying a card moves money out of the paying bank account.
  card_payment_out: -1,
  card_payment_in: 1,
  // Paying a person moves money out; being paid moves money in.
  settlement_out: -1,
  settlement_in: 1,
};

/**
 * Direction of a movement for a credit-card account, expressed as an effect on
 * the *outstanding balance*. `+1` increases what is owed.
 */
const CARD_OUTSTANDING_DIRECTION: Record<AccountMovementKind, 1 | -1> = {
  // Spending on the card increases the liability.
  expense: 1,
  // A refund onto the card reduces it.
  income: -1,
  // A cash advance off the card increases it; money moved onto it reduces it.
  transfer_out: 1,
  transfer_in: -1,
  // A card payment lands on the card and reduces the liability.
  card_payment_in: -1,
  card_payment_out: 1,
  settlement_out: 1,
  settlement_in: -1,
};

/**
 * Translates transactions and settlements into per-account movements.
 *
 * An expense whose payer is another person has no `accountId`, so it produces no
 * movement: the user's account was never charged
 * (docs/09-DATABASE-SCHEMA.md section 13).
 */
export function deriveAccountMovements(
  transactions: readonly Transaction[],
  settlements: readonly Settlement[] = [],
): AccountMovement[] {
  const movements: AccountMovement[] = [];

  for (const transaction of transactions) {
    if (transaction.deletedAt !== null) continue;

    const { amount, date } = transaction;

    switch (transaction.type) {
      case "expense":
        if (transaction.accountId) {
          movements.push({ accountId: transaction.accountId, kind: "expense", amount, date });
        }
        break;

      case "income":
        if (transaction.accountId) {
          movements.push({ accountId: transaction.accountId, kind: "income", amount, date });
        }
        break;

      case "transfer":
        if (transaction.fromAccountId) {
          movements.push({
            accountId: transaction.fromAccountId,
            kind: "transfer_out",
            amount,
            date,
          });
        }
        if (transaction.toAccountId) {
          movements.push({ accountId: transaction.toAccountId, kind: "transfer_in", amount, date });
        }
        break;

      case "credit_card_payment":
        if (transaction.fromAccountId) {
          movements.push({
            accountId: transaction.fromAccountId,
            kind: "card_payment_out",
            amount,
            date,
          });
        }
        if (transaction.toAccountId) {
          movements.push({
            accountId: transaction.toAccountId,
            kind: "card_payment_in",
            amount,
            date,
          });
        }
        break;
    }
  }

  for (const settlement of settlements) {
    if (settlement.deletedAt !== null) continue;
    if (!settlement.accountId) continue;

    movements.push({
      accountId: settlement.accountId,
      kind: settlement.direction === "user_to_person" ? "settlement_out" : "settlement_in",
      amount: settlement.amount,
      date: settlement.date,
    });
  }

  return movements;
}

export function movementsForAccount(
  movements: readonly AccountMovement[],
  accountId: string,
): AccountMovement[] {
  return movements.filter((movement) => movement.accountId === accountId);
}

/**
 * Current balance of a bank or cash account.
 *
 * Uses the full transaction amount, not the user's share: when the user pays
 * ₹1,200 for a group dinner, ₹1,200 leaves their account even though only ₹400 is
 * their own spending (docs/03-DATA-FLOW.md section 7).
 */
export function calculateAccountBalance(
  account: Account,
  movements: readonly AccountMovement[],
): Money {
  const relevant = movementsForAccount(movements, account.id);

  return relevant.reduce((balance, movement) => {
    const direction = ASSET_DIRECTION[movement.kind];
    return direction === 1
      ? addMoney(balance, movement.amount)
      : subtractMoney(balance, movement.amount);
  }, account.openingBalance);
}

/**
 * Current outstanding balance on a credit card, as a positive amount owed.
 *
 * `openingBalance` is the outstanding amount at the time the card was added.
 */
export function calculateCreditCardOutstanding(
  account: Account,
  movements: readonly AccountMovement[],
): Money {
  const relevant = movementsForAccount(movements, account.id);

  return relevant.reduce((outstanding, movement) => {
    const direction = CARD_OUTSTANDING_DIRECTION[movement.kind];
    return direction === 1
      ? addMoney(outstanding, movement.amount)
      : subtractMoney(outstanding, movement.amount);
  }, account.openingBalance);
}

/**
 * Credit still usable on the card.
 *
 * Derived, never stored alongside outstanding: two independently mutable numbers
 * would eventually disagree (docs/01-MVP-SCOPE.md section 4).
 */
export function calculateAvailableCredit(creditLimit: Money, outstanding: Money): Money {
  return subtractMoney(creditLimit, outstanding);
}

export type AccountBalanceSummary = {
  accountId: string;
  currency: string;
  /**
   * Signed value of the account.
   *
   * Positive for money held in a bank or cash account; negative for a credit-card
   * liability, so summing every account yields net position.
   */
  balance: Money;
  /** Positive amount owed. Credit cards only. */
  outstanding: Money | null;
  creditLimit: Money | null;
  availableCredit: Money | null;
  /** True when the card is over its limit. */
  overLimit: boolean;
};

export function summariseAccount(
  account: Account,
  movements: readonly AccountMovement[],
): AccountBalanceSummary {
  if (account.type === "credit_card") {
    const outstanding = calculateCreditCardOutstanding(account, movements);
    const creditLimit = account.creditCard?.creditLimit ?? Money.zero(account.currency);
    const availableCredit = calculateAvailableCredit(creditLimit, outstanding);

    return {
      accountId: account.id,
      currency: account.currency,
      // A liability reduces net position.
      balance: outstanding.negated(),
      outstanding,
      creditLimit,
      availableCredit,
      overLimit: availableCredit.isNegative(),
    };
  }

  return {
    accountId: account.id,
    currency: account.currency,
    balance: calculateAccountBalance(account, movements),
    outstanding: null,
    creditLimit: null,
    availableCredit: null,
    overLimit: false,
  };
}

export function summariseAccounts(
  accounts: readonly Account[],
  movements: readonly AccountMovement[],
): Map<string, AccountBalanceSummary> {
  return new Map(
    accounts.map((account) => [account.id, summariseAccount(account, movements)] as const),
  );
}

export type AccountTotals = {
  /** Bank plus cash. */
  liquidBalance: Money;
  creditCardOutstanding: Money;
  availableCredit: Money;
  netPosition: Money;
};

/**
 * Portfolio-level totals for the dashboard.
 *
 * Archived accounts still hold money, so they are included unless the caller
 * filters them out first.
 */
export function calculateAccountTotals(
  accounts: readonly Account[],
  movements: readonly AccountMovement[],
  currency: string,
): AccountTotals {
  const liquid: Money[] = [];
  const outstanding: Money[] = [];
  const available: Money[] = [];

  for (const account of accounts) {
    if (account.currency !== currency) continue;

    const summary = summariseAccount(account, movements);

    if (account.type === "credit_card") {
      if (summary.outstanding) outstanding.push(summary.outstanding);
      if (summary.availableCredit) available.push(summary.availableCredit);
    } else {
      liquid.push(summary.balance);
    }
  }

  const liquidBalance = sumMoney(liquid, currency);
  const creditCardOutstanding = sumMoney(outstanding, currency);

  return {
    liquidBalance,
    creditCardOutstanding,
    availableCredit: sumMoney(available, currency),
    netPosition: subtractMoney(liquidBalance, creditCardOutstanding),
  };
}
