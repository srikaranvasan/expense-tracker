"use client";

import { useCallback, useMemo, useState } from "react";
import { calculateSplitShares } from "@/domain/transactions/splits";
import { personParticipant, userParticipant } from "@/domain/transactions/splits";
import { isAppError } from "@/lib/errors";
import { Money, isDecimalLike, sumMoney, toDecimal } from "@/lib/money";
import type { PersonOption } from "@/features/people/view-models/person-view-model";

/**
 * Split draft state for the shared-expense form.
 *
 * The share preview runs the *same* `calculateSplitShares` the server uses, so the
 * figures shown while typing are the figures that will be stored. Re-implementing the
 * arithmetic for the client would be a second source of truth and would eventually
 * disagree (docs/06-CODING-PRACTICES.md section 9).
 *
 * The server still validates everything on submit. This is a preview, not a
 * substitute.
 */

export type SplitMethodDraft = "equal" | "custom" | "percentage";

export type SplitParticipantDraft = {
  /** Stable React key; survives reordering and removal. */
  key: string;
  /** Null means the user. */
  personId: string | null;
  name: string;
  amount: string;
  percentage: string;
};

export type SplitComputation = {
  /** Share per participant, as plain decimal strings, in participant order. */
  shares: string[];
  /** Sum of the shares. */
  allocated: string;
  /** Sum of the entered percentages. */
  totalPercentage: string;
  /** Set when the split cannot be computed or does not add up. */
  error: string | null;
};

export type SplitDraft = {
  amount: string;
  method: SplitMethodDraft;
  participants: SplitParticipantDraft[];
  computed: SplitComputation;
  setMethod: (method: SplitMethodDraft) => void;
  addParticipant: (personId: string | null) => void;
  removeParticipant: (index: number) => void;
  updateParticipant: (index: number, changes: Partial<SplitParticipantDraft>) => void;
};

export type UseSplitDraftOptions = {
  currency: string;
  /** The expense amount, kept in the parent form so both can read it. */
  amount: string;
  peopleOptions: readonly PersonOption[];
  initialParticipants?: ReadonlyArray<{ personId: string | null; amount?: string }>;
  initialMethod?: SplitMethodDraft;
};

let keyCounter = 0;
function nextKey(): string {
  keyCounter += 1;
  return `p${keyCounter}`;
}

export function useSplitDraft({
  currency,
  amount,
  peopleOptions,
  initialParticipants,
  initialMethod = "equal",
}: UseSplitDraftOptions): SplitDraft {
  const [method, setMethod] = useState<SplitMethodDraft>(initialMethod);

  const [participants, setParticipants] = useState<SplitParticipantDraft[]>(() =>
    (initialParticipants ?? [{ personId: null }]).map((participant) => ({
      key: nextKey(),
      personId: participant.personId,
      name: nameFor(participant.personId, peopleOptions),
      amount: participant.amount ?? "",
      percentage: "",
    })),
  );

  const addParticipant = useCallback(
    (personId: string | null) => {
      setParticipants((current) => {
        if (current.some((participant) => participant.personId === personId)) return current;

        return [
          ...current,
          {
            key: nextKey(),
            personId,
            name: nameFor(personId, peopleOptions),
            amount: "",
            percentage: "",
          },
        ];
      });
    },
    [peopleOptions],
  );

  const removeParticipant = useCallback((index: number) => {
    setParticipants((current) => current.filter((_, position) => position !== index));
  }, []);

  const updateParticipant = useCallback(
    (index: number, changes: Partial<SplitParticipantDraft>) => {
      setParticipants((current) =>
        current.map((participant, position) =>
          position === index ? { ...participant, ...changes } : participant,
        ),
      );
    },
    [],
  );

  const computed = useMemo(
    () => computeSplit({ amount, currency, method, participants }),
    [amount, currency, method, participants],
  );

  return {
    amount,
    method,
    participants,
    computed,
    setMethod,
    addParticipant,
    removeParticipant,
    updateParticipant,
  };
}

function nameFor(personId: string | null, peopleOptions: readonly PersonOption[]): string {
  if (personId === null) return "You";
  return peopleOptions.find((person) => person.id === personId)?.name ?? "Someone";
}

const EMPTY: SplitComputation = {
  shares: [],
  allocated: "0",
  totalPercentage: "0",
  error: null,
};

function computeSplit({
  amount,
  currency,
  method,
  participants,
}: {
  amount: string;
  currency: string;
  method: SplitMethodDraft;
  participants: readonly SplitParticipantDraft[];
}): SplitComputation {
  if (participants.length === 0) {
    return { ...EMPTY, error: "Add at least one participant." };
  }

  const trimmedAmount = amount.trim();
  if (trimmedAmount === "" || !isDecimalLike(trimmedAmount)) return EMPTY;

  let total: Money;
  try {
    total = Money.of(trimmedAmount, currency);
  } catch {
    return EMPTY;
  }

  if (!total.isPositive()) return EMPTY;

  const totalPercentage = participants
    .reduce(
      (sum, participant) =>
        isDecimalLike(participant.percentage.trim() || "0")
          ? sum.plus(toDecimal(participant.percentage.trim() || "0"))
          : sum,
      toDecimal("0"),
    )
    .toFixed();

  // While the user is still typing, a partially entered split is expected rather than
  // an error, so incomplete input yields no preview instead of a complaint.
  if (method !== "equal") {
    const field = method === "custom" ? "amount" : "percentage";
    const incomplete = participants.some((participant) => {
      const value = participant[field].trim();
      return value === "" || !isDecimalLike(value);
    });

    if (incomplete) return { ...EMPTY, totalPercentage };
  }

  try {
    const shares = calculateSplitShares(total, buildRequest(method, participants));

    return {
      shares: shares.map((share) => share.shareAmount.toString()),
      allocated: sumMoney(
        shares.map((share) => share.shareAmount),
        currency,
      ).toString(),
      totalPercentage,
      error: null,
    };
  } catch (error) {
    return {
      ...EMPTY,
      totalPercentage,
      // Domain errors carry a user-facing message; anything else is a genuine bug and
      // should not be surfaced as validation guidance.
      error: isAppError(error) ? error.userMessage : "This split is not valid.",
    };
  }
}

function buildRequest(method: SplitMethodDraft, participants: readonly SplitParticipantDraft[]) {
  const refs = participants.map((participant) =>
    participant.personId ? personParticipant(participant.personId) : userParticipant(),
  );

  if (method === "equal") {
    return { method: "equal" as const, participants: refs };
  }

  if (method === "percentage") {
    return {
      method: "percentage" as const,
      participants: participants.map((participant, index) => ({
        participant: refs[index]!,
        percentage: participant.percentage.trim(),
      })),
    };
  }

  return {
    method: "custom" as const,
    participants: participants.map((participant, index) => ({
      participant: refs[index]!,
      amount: participant.amount.trim(),
    })),
  };
}
