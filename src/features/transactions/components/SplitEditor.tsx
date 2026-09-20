"use client";

import { useMemo } from "react";
import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
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
    <Stack gap="4" borderWidth="1px" borderColor="line" rounded="card" p="4">
      <Text fontSize="sm" fontWeight="semibold">
        Split
      </Text>

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

      <SplitSummary currency={currency} hasAmount={hasAmount} method={method} computed={computed} />
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

function SplitSummary({
  currency,
  hasAmount,
  method,
  computed,
}: {
  currency: string;
  hasAmount: boolean;
  method: SplitDraft["method"];
  computed: SplitDraft["computed"];
}) {
  if (!hasAmount) {
    return (
      <Text fontSize="xs" color="content.muted">
        Enter the expense amount to see each share.
      </Text>
    );
  }

  if (computed.error) {
    return <Alert tone="error">{computed.error}</Alert>;
  }

  if (method === "percentage") {
    return (
      <Flex justify="space-between" fontSize="sm">
        <Text color="content.muted">Total</Text>
        <Text textStyle="amount" fontWeight="semibold">
          {computed.totalPercentage}%
        </Text>
      </Flex>
    );
  }

  return (
    <Flex justify="space-between" fontSize="sm">
      <Text color="content.muted">Allocated</Text>
      <Text textStyle="amount" fontWeight="semibold">
        {formatMoney(money(computed.allocated, currency))}
      </Text>
    </Flex>
  );
}
