import { LIMITS } from "@/config/constants";
import {
  InvalidParticipantError,
  InvalidSplitError,
  InvalidSplitTotalError,
} from "@/domain/shared/errors";
import { assertWithinCollectionLimit } from "@/domain/shared/invariants";
import { Money, allocateMoney, splitEqually, sumMoney, toDecimal } from "@/lib/money";
import type { SplitMethod } from "@/types/common";
import type { PaidBy } from "./entities";

/**
 * Split calculation.
 *
 * The one invariant this module exists to guarantee: **the computed shares sum
 * exactly to the expense total** (docs/02-DATA-MODEL.md section 13). Every method
 * routes through `lib/money`'s largest-remainder allocation, so a ₹1,000 three-way
 * split produces 333.34 / 333.33 / 333.33 rather than three 333.33s that lose a
 * rupee.
 */

/** Who a share belongs to. `null` personId means the user. */
export type ParticipantRef =
  { type: "user"; personId: null } | { type: "person"; personId: string };

export function userParticipant(): ParticipantRef {
  return { type: "user", personId: null };
}

export function personParticipant(personId: string): ParticipantRef {
  return { type: "person", personId };
}

/** Stable key for duplicate detection and lookups. */
export function participantRefKey(participant: ParticipantRef): string {
  return participant.type === "user" ? "user" : `person:${participant.personId}`;
}

/**
 * A split request as the client expresses it.
 *
 * `equal` needs only the participants; `custom` carries an amount each;
 * `percentage` carries a percentage each.
 */
export type SplitRequest =
  | { method: "equal"; participants: readonly ParticipantRef[] }
  | {
      method: "custom";
      participants: readonly { participant: ParticipantRef; amount: string }[];
    }
  | {
      method: "percentage";
      participants: readonly { participant: ParticipantRef; percentage: string }[];
    };

export type ComputedShare = {
  participant: ParticipantRef;
  shareAmount: Money;
};

/**
 * Computes each participant's share.
 *
 * Throws rather than adjusting: if custom amounts do not add up to the total, the
 * user has made a mistake only they can resolve. Silently absorbing the difference
 * would record something they did not enter
 * (docs/06-CODING-PRACTICES.md section 55).
 */
export function calculateSplitShares(total: Money, request: SplitRequest): ComputedShare[] {
  const participants = extractParticipants(request);
  assertValidParticipantList(participants);

  switch (request.method) {
    case "equal":
      return splitEqual(total, participants);
    case "custom":
      return splitCustom(total, request.participants);
    case "percentage":
      return splitPercentage(total, request.participants);
  }
}

function extractParticipants(request: SplitRequest): ParticipantRef[] {
  return request.method === "equal"
    ? [...request.participants]
    : request.participants.map((entry) => entry.participant);
}

/**
 * Equal split.
 *
 * Any remainder from an amount that does not divide evenly is distributed one minor
 * unit at a time, so the parts still sum to the total.
 */
function splitEqual(total: Money, participants: readonly ParticipantRef[]): ComputedShare[] {
  const shares = splitEqually(total, participants.length);

  return participants.map((participant, index) => ({
    participant,
    shareAmount: shares[index]!,
  }));
}

/**
 * Custom amounts.
 *
 * Each amount is taken exactly as entered, and the total is checked. This is the one
 * method where the user, not the application, decides each figure.
 */
function splitCustom(
  total: Money,
  entries: readonly { participant: ParticipantRef; amount: string }[],
): ComputedShare[] {
  const shares = entries.map((entry) => {
    const shareAmount = Money.of(entry.amount, total.currency);

    if (!shareAmount.isPositive()) {
      throw new InvalidSplitError(
        "Every participant's share must be greater than zero. Remove anyone who owes nothing.",
        { participant: participantRefKey(entry.participant) },
      );
    }

    if (shareAmount.amount.decimalPlaces() > shareAmount.scale) {
      throw new InvalidSplitError(`A share is more precise than ${total.currency} allows.`, {
        participant: participantRefKey(entry.participant),
      });
    }

    return { participant: entry.participant, shareAmount };
  });

  assertSharesMatchTotal(total, shares);
  return shares;
}

/**
 * Percentage split.
 *
 * Percentages must total exactly 100. The shares are then allocated using the
 * percentages as weights, which keeps the sum exact even when a percentage does not
 * divide the amount cleanly - 33.33% of ₹1,000 is not a whole number of paise.
 */
function splitPercentage(
  total: Money,
  entries: readonly { participant: ParticipantRef; percentage: string }[],
): ComputedShare[] {
  const percentages = entries.map((entry) => {
    const percentage = toDecimal(entry.percentage);

    if (!percentage.greaterThan(0)) {
      throw new InvalidSplitError(
        "Every participant's percentage must be greater than zero. Remove anyone who owes nothing.",
        { participant: participantRefKey(entry.participant) },
      );
    }

    if (percentage.greaterThan(100)) {
      throw new InvalidSplitError("A percentage cannot be more than 100.", {
        participant: participantRefKey(entry.participant),
      });
    }

    return percentage;
  });

  const totalPercentage = percentages.reduce(
    (sum, percentage) => sum.plus(percentage),
    toDecimal("0"),
  );

  if (!totalPercentage.equals(100)) {
    throw new InvalidSplitError(
      `Percentages must add up to 100%. They currently add up to ${totalPercentage.toFixed()}%.`,
      { totalPercentage: totalPercentage.toFixed() },
    );
  }

  const shares = allocateMoney(total, percentages);

  return entries.map((entry, index) => ({
    participant: entry.participant,
    shareAmount: shares[index]!,
  }));
}

/**
 * The load-bearing assertion: shares must sum exactly to the expense total.
 *
 * Every read path - spending totals, person balances, settlement remainders - assumes
 * this holds. If it ever did not, a balance would be wrong with no way to detect it
 * from the data alone.
 */
export function assertSharesMatchTotal(
  total: Money,
  shares: readonly { shareAmount: Money }[],
): void {
  const sum = sumMoney(
    shares.map((share) => share.shareAmount),
    total.currency,
  );

  if (!sum.equals(total)) {
    throw new InvalidSplitTotalError(total.toFixedString(), sum.toFixedString(), total.currency);
  }
}

/**
 * Validates the participant list.
 *
 * A shared expense needs at least one person other than the user - otherwise it is a
 * personal expense and belongs on that path. The user does not have to be a
 * participant: "I paid ₹600 for Arun and Vijay" is a legitimate expense where the
 * user's own share is zero.
 */
export function assertValidParticipantList(participants: readonly ParticipantRef[]): void {
  if (participants.length === 0) {
    throw new InvalidParticipantError("Add at least one participant.");
  }

  assertWithinCollectionLimit(
    participants.length,
    LIMITS.maxParticipantsPerExpense,
    "Participants",
  );

  const keys = participants.map(participantRefKey);
  if (new Set(keys).size !== keys.length) {
    throw new InvalidParticipantError("The same participant cannot be added twice.");
  }

  for (const participant of participants) {
    if (participant.type === "person" && !participant.personId) {
      throw new InvalidParticipantError("A participant is missing a person.");
    }
  }
}

/** True when at least one participant is somebody other than the user. */
export function hasPersonParticipant(participants: readonly ParticipantRef[]): boolean {
  return participants.some((participant) => participant.type === "person");
}

export function assertIsSharedSplit(participants: readonly ParticipantRef[]): void {
  if (!hasPersonParticipant(participants)) {
    throw new InvalidParticipantError(
      "A shared expense needs at least one other person. Record it as a personal expense instead.",
    );
  }
}

/**
 * The payer must be a party to the expense.
 *
 * Recording that a person paid when they are not a participant is allowed - they may
 * have paid purely for others - but the payer must still be someone the user knows,
 * which the service checks by resolving the id.
 */
export function assertPayerIsKnown(paidBy: PaidBy, resolvedPersonIds: ReadonlySet<string>): void {
  if (paidBy.type === "person" && !resolvedPersonIds.has(paidBy.personId)) {
    throw new InvalidParticipantError("The person who paid could not be found.");
  }
}

/** The user's own share within a computed split, or zero if they have none. */
export function userShareOf(shares: readonly ComputedShare[], currency: string): Money {
  const own = shares.filter((share) => share.participant.type === "user");
  return sumMoney(
    own.map((share) => share.shareAmount),
    currency,
  );
}

export type { SplitMethod };
