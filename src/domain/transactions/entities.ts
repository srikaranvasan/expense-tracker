import type { Money } from "@/lib/money";
import type { EntityBase, SoftDeleteMeta, SyncMeta } from "@/domain/shared/entities";
import type { ParticipantType, TransactionType } from "@/types/common";

/**
 * A financial event.
 *
 * The four types mean genuinely different things and must not be collapsed into a
 * generic "money movement" (docs/09-DATABASE-SCHEMA.md section 36):
 *
 *   expense              spending occurred
 *   income               money arrived
 *   transfer             money moved between the user's own accounts
 *   credit_card_payment  a card liability was paid down
 */
export type Transaction = EntityBase &
  SyncMeta &
  SoftDeleteMeta & {
    userId: string;
    type: TransactionType;
    /** Total amount of the event, regardless of who ultimately owes what. */
    amount: Money;
    description: string;
    date: Date;
    categoryId: string | null;
    /** Account used for an expense or income. */
    accountId: string | null;
    /** Source account for a transfer or card payment. */
    fromAccountId: string | null;
    /** Destination account for a transfer or card payment. */
    toAccountId: string | null;
    /** Who physically paid. Expenses only. */
    paidBy: PaidBy | null;
    notes: string | null;
  };

/**
 * Who paid, which is a different question from which account was used
 * (docs/01-MVP-SCOPE.md section 9).
 */
export type PaidBy = { type: "user"; personId: null } | { type: "person"; personId: string };

export function paidByUser(): PaidBy {
  return { type: "user", personId: null };
}

export function paidByPerson(personId: string): PaidBy {
  return { type: "person", personId };
}

/**
 * Each participant's responsibility for an expense.
 *
 * The sum of a transaction's active splits must always equal its amount
 * (docs/02-DATA-MODEL.md section 13).
 */
export type ExpenseSplit = EntityBase &
  SyncMeta &
  SoftDeleteMeta & {
    userId: string;
    transactionId: string;
    participantType: ParticipantType;
    /** Null when the participant is the user. */
    personId: string | null;
    shareAmount: Money;
  };

export type SplitParticipant =
  { type: "user"; personId: null } | { type: "person"; personId: string };

export function participantOf(split: ExpenseSplit): SplitParticipant {
  return split.participantType === "person" && split.personId !== null
    ? { type: "person", personId: split.personId }
    : { type: "user", personId: null };
}

/** Stable key for comparing participants, e.g. for duplicate detection. */
export function participantKey(participant: SplitParticipant | PaidBy): string {
  return participant.type === "user" ? "user" : `person:${participant.personId}`;
}

/** A transaction together with the splits that belong to it. */
export type TransactionWithSplits = {
  transaction: Transaction;
  splits: ExpenseSplit[];
};

/** True when any participant other than the user has a share. */
export function isSharedExpense(splits: readonly ExpenseSplit[]): boolean {
  return splits.some((split) => split.participantType === "person");
}
