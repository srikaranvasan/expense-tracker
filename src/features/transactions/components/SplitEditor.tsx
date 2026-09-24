"use client";

import { useMemo } from "react";
import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Icon } from "@/components/icons/Icon";
import { Button } from "@/components/ui/Button";
import { AmountInput, Field, SelectInput } from "@/components/ui/Field";
import type { PersonOption } from "@/features/people/view-models/person-view-model";
import { formatMoney, money } from "@/lib/money";
import type { SplitDraft, SplitParticipantDraft } from "../hooks/use-split-draft";

export type SplitEditorProps = {
  currency: string;
  peopleOptions: readonly PersonOption[];
  draft: SplitDraft;
  /** Field errors keyed by participant index, from the server. */
  participantErrors?: Record<string, string[]>;
};

const METHOD_LABELS = [
  { value: "equal", label: "Split equally" },
  { value: "custom", label: "Enter amounts" },
  { value: "percentage", label: "Enter percentages" },
] as const;

/**
 * Participant and split editor.
 *
 * Shows the running total against the expense amount as the user types, because a
 * custom or percentage split that does not add up is rejected outright - the server
 * will not quietly absorb the difference, so the form has to make the gap obvious
 * before submission (docs/06-CODING-PRACTICES.md section 55).
 */
export function SplitEditor({
  currency,
  peopleOptions,
  draft,
  participantErrors,
}: SplitEditorProps) {
  const {
    amount,
    method,
    participants,
    setMethod,
    addParticipant,
    removeParticipant,
    updateParticipant,
    computed,
  } = draft;

  const availablePeople = useMemo(
    () =>
      peopleOptions.filter(
        (person) => !participants.some((participant) => participant.personId === person.id),
      ),
    [peopleOptions, participants],
  );

  const hasAmount = amount.trim() !== "";

  return (
    // An inset block on `surface.sunken` (7.3): a fieldset inside a card, which is what this is. The
    // container border is the soft card outline, not the full ink of a control.
    <Stack
      gap="18px"
      bg="surface.sunken"
      borderWidth="thin"
      borderStyle="solid"
      borderColor="line.card"
      paddingInline={{ base: "16px", md: "20px" }}
      paddingBlock={{ base: "16px", md: "20px" }}
    >
      <Text textStyle="eyebrow">Split</Text>

      <Field id="splitMethod" label="How to split">
        <SelectInput
          id="splitMethod"
          name="splitMethod"
          value={method}
          onChange={(event) => setMethod(event.target.value as SplitDraft["method"])}
        >
          {METHOD_LABELS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </SelectInput>
      </Field>

      <Stack gap="3">
        {participants.map((participant, index) => (
          <ParticipantRow
            key={participant.key}
            index={index}
            currency={currency}
            method={method}
            participant={participant}
            computedShare={computed.shares[index] ?? null}
            errors={
              participantErrors?.[`participants.${index}.amount`] ??
              participantErrors?.[`participants.${index}.percentage`]
            }
            canRemove={participants.length > 1}
            onChange={(changes) => updateParticipant(index, changes)}
            onRemove={() => removeParticipant(index)}
          />
        ))}
      </Stack>

      {availablePeople.length > 0 ? (
        <HStack gap="2" align="flex-end">
          <Box flex="1">
            <Field id="addParticipant" label="Add someone">
              <SelectInput
                id="addParticipant"
                value=""
                onChange={(event) => {
                  if (event.target.value) addParticipant(event.target.value);
                }}
              >
                <option value="">Choose a person…</option>
                {availablePeople.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </Box>
        </HStack>
      ) : null}

      {!participants.some((participant) => participant.personId === null) ? (
        <Box>
          <Button tone="secondary" size="sm" onClick={() => addParticipant(null)}>
            Include yourself
          </Button>
        </Box>
      ) : null}

      {/* Hidden fields carry the split to the server action. */}
      {participants.map((participant, index) => (
        <Box key={`hidden-${participant.key}`} display="none">
          <input
            type="hidden"
            name={`participants[${index}].personId`}
            value={participant.personId ?? ""}
          />
          <input
            type="hidden"
            name={`participants[${index}].amount`}
            value={method === "custom" ? participant.amount : ""}
          />
          <input
            type="hidden"
            name={`participants[${index}].percentage`}
            value={method === "percentage" ? participant.percentage : ""}
          />
        </Box>
      ))}

      <SplitSummary
        currency={currency}
        amount={amount}
        hasAmount={hasAmount}
        method={method}
        computed={computed}
      />
    </Stack>
  );
}

type ParticipantRowProps = {
  index: number;
  currency: string;
  method: SplitDraft["method"];
  participant: SplitParticipantDraft;
  computedShare: string | null;
  errors?: string[];
  canRemove: boolean;
  onChange: (changes: Partial<SplitParticipantDraft>) => void;
  onRemove: () => void;
};

function ParticipantRow({
  index,
  currency,
  method,
  participant,
  computedShare,
  errors,
  canRemove,
  onChange,
  onRemove,
}: ParticipantRowProps) {
  return (
    <Flex align="flex-end" gap="2">
      <Box flex="1" minW="0">
        {method === "equal" ? (
          <Stack gap="0.5">
            <Text fontSize="sm" fontWeight="medium" truncate>
              {participant.name}
            </Text>
            <Text textStyle="amount" fontSize="xs" color="content.muted">
              {computedShare
                ? formatMoney(money(computedShare, currency))
                : "Enter an amount above"}
            </Text>
          </Stack>
        ) : (
          <Field id={`participant-${index}`} label={participant.name} errors={errors}>
            <AmountInput
              id={`participant-${index}`}
              value={method === "custom" ? participant.amount : participant.percentage}
              onChange={(event) =>
                onChange(
                  method === "custom"
                    ? { amount: event.target.value }
                    : { percentage: event.target.value },
                )
              }
              placeholder={method === "custom" ? "0.00" : "0"}
              aria-label={
                method === "custom"
                  ? `${participant.name} amount in ${currency}`
                  : `${participant.name} percentage`
              }
            />
          </Field>
        )}
      </Box>

      {canRemove ? (
        <Button tone="ghost" size="sm" onClick={onRemove} aria-label={`Remove ${participant.name}`}>
          Remove
        </Button>
      ) : null}
    </Flex>
  );
}

/**
 * Formats a partially typed amount without throwing.
 *
 * The amount field is a live value: while someone types "48" on the way to "4800" it passes through
 * states `money()` rejects. Returning `null` lets the caller omit the comparison for a frame rather
 * than crash the form.
 */
function safeFormat(value: string, currency: string): string | null {
  try {
    return formatMoney(money(value, currency));
  } catch {
    return null;
  }
}

/**
 * The running allocated total, against the expense amount.
 *
 * **Against**, not alone. A custom or percentage split that does not add up is rejected outright — the
 * server will not quietly absorb the difference (docs/06-CODING-PRACTICES.md section 55) — so the
 * useful figure is the gap, and a bare "Allocated ₹3,200.00" leaves the reader to subtract. The
 * footer reads `₹3,200.00 of ₹4,800.00` and says what is left.
 *
 * Separated from the rows above by a rule, because it is a total rather than another row.
 */
function SplitSummary({
  currency,
  amount,
  hasAmount,
  method,
  computed,
}: {
  currency: string;
  amount: string;
  hasAmount: boolean;
  method: SplitDraft["method"];
  computed: SplitDraft["computed"];
}) {
  if (!hasAmount) {
    return (
      <Text fontSize="meta" color="content.subtle">
        Enter the expense amount to see each share.
      </Text>
    );
  }

  if (computed.error) {
    return <Alert tone="error">{computed.error}</Alert>;
  }

  if (method === "percentage") {
    // 100 is the target. Compared as a number only to choose a colour; the server does the decimal
    // arithmetic that decides whether the split is accepted.
    const complete = Number(computed.totalPercentage) === 100;

    return (
      <SummaryRow
        label="Allocated"
        value={`${computed.totalPercentage}% of 100%`}
        complete={complete}
        note={complete ? null : "The percentages have to add up to 100."}
      />
    );
  }

  const total = safeFormat(amount, currency);
  const allocated = formatMoney(money(computed.allocated, currency));
  const complete = total !== null && Number(computed.allocated) === Number(amount);

  return (
    <SummaryRow
      label="Allocated"
      value={total ? `${allocated} of ${total}` : allocated}
      complete={complete}
      note={complete ? null : "Each share has to add up to the total."}
    />
  );
}

function SummaryRow({
  label,
  value,
  complete,
  note,
}: {
  label: string;
  value: string;
  complete: boolean;
  note: string | null;
}) {
  return (
    <Box borderTopWidth="hairline" borderColor="line.soft" pt="14px">
      <Flex justify="space-between" align="center" gap="3">
        <HStack gap="6px">
          <Text textStyle="eyebrow">{label}</Text>
          {/*
            The tick is confirmation, not the message: `complete` also drives the figure's colour, and
            the note below states the rule in words when it is not met. Decorative, so it is not
            announced twice.
          */}
          {complete ? <Icon name="check" size="inline" color="positive" aria-hidden /> : null}
        </HStack>

        <Text
          textStyle="amount"
          fontSize="row"
          fontWeight="600"
          color={complete ? "positive" : "content"}
        >
          {value}
        </Text>
      </Flex>

      {note ? (
        <Text fontSize="meta" color="content.subtle" mt="6px">
          {note}
        </Text>
      ) : null}
    </Box>
  );
}
