"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { FormActions } from "@/components/ui/FormActions";
import { AmountInput, Field, SelectInput, TextAreaInput, TextInput } from "@/components/ui/Field";
import { FormLayout } from "@/components/ui/FormLayout";
import { ReferenceCode } from "@/components/ui/ReferenceCode";
import { Stamp } from "@/components/ui/Stamp";
import { LIMITS } from "@/config/constants";
import type { AccountOption } from "@/features/accounts/view-models/account-view-model";
import { formatMoney, money, toDecimal } from "@/lib/money";
import { newClientId } from "@/lib/utils/client-id";
import { referenceCodeFor } from "@/lib/utils/reference-code";
import { createSettlementAction } from "../actions/settlement-actions";
import type { ActionState } from "../actions/settlement-actions";
import type { SettleableObligationView, SettleUpView } from "../view-models/settlement-view-model";

const initialState: ActionState = { ok: false };

export type SettleUpFormProps = {
  view: SettleUpView;
  accountOptions: readonly AccountOption[];
  todayValue: string;
};

type Allocation = { expenseSplitId: string; amount: string };

/**
 * Settle-up form.
 *
 * Every payment must be allocated to specific expenses, because balances are derived
 * from allocations alone (docs/03-DATA-FLOW.md section 11). Rather than making the user
 * do that arithmetic, entering an amount spreads it oldest-first across what is
 * outstanding, and each line stays editable.
 *
 * The allocated total is shown against the payment amount at all times, since a
 * mismatch is rejected outright.
 */
export function SettleUpForm({ view, accountOptions, todayValue }: SettleUpFormProps) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createSettlementAction, initialState);

  const [direction, setDirection] = useState(view.direction ?? "person_to_user");

  const obligations = direction === view.direction ? view.obligations : view.reverseObligations;

  const outstanding = useMemo(
    () =>
      obligations.reduce(
        (sum, obligation) => sum.plus(toDecimal(obligation.remainingAmount.amount)),
        toDecimal("0"),
      ),
    [obligations],
  );

  const [amount, setAmount] = useState(outstanding.toFixed());
  const [allocations, setAllocations] = useState<Allocation[]>(() =>
    spreadOldestFirst(outstanding.toFixed(), obligations),
  );

  // Switching direction changes which expenses are settleable, so the payment and its
  // spread are rebuilt from the new set.
  function changeDirection(next: string) {
    const nextDirection = next as typeof direction;
    setDirection(nextDirection);

    const nextObligations =
      nextDirection === view.direction ? view.obligations : view.reverseObligations;
    const nextOutstanding = nextObligations
      .reduce(
        (sum, obligation) => sum.plus(toDecimal(obligation.remainingAmount.amount)),
        toDecimal("0"),
      )
      .toFixed();

    setAmount(nextOutstanding);
    setAllocations(spreadOldestFirst(nextOutstanding, nextObligations));
  }

  function changeAmount(next: string) {
    setAmount(next);
    setAllocations(spreadOldestFirst(next, obligations));
  }

  function changeAllocation(expenseSplitId: string, next: string) {
    setAllocations((current) =>
      current.map((allocation) =>
        allocation.expenseSplitId === expenseSplitId ? { ...allocation, amount: next } : allocation,
      ),
    );
  }

  const allocatedTotal = allocations.reduce(
    (sum, allocation) => sum.plus(toDecimal(allocation.amount || "0")),
    toDecimal("0"),
  );

  const amountDecimal = toDecimal(amount.trim() === "" ? "0" : amount);
  const balanced = allocatedTotal.equals(amountDecimal);

  const clientId = useMemo(() => newClientId(), []);
  // The reference the settlement will carry, known before the write. See `ExpenseForm`.
  const referenceCode = useMemo(() => referenceCodeFor({ clientId }), [clientId]);

  useEffect(() => {
    if (state.ok) {
      router.push(`/people/${view.personId}`);
    }
  }, [state.ok, router, view.personId]);

  const errors = state.fieldErrors ?? {};

  if (obligations.length === 0 && view.reverseObligations.length === 0) {
    return (
      <Alert tone="success" title="Nothing to settle">
        You and {view.personName} are square.
      </Alert>
    );
  }

  const bothDirections = view.direction !== null && view.reverseDirection !== null;

  return (
    // No side rail: `SettleUp-Light.html` draws a single centred 820px column. The page caps the
    // width; `FormLayout` with no rail gives the same emphasised card the other forms have.
    <FormLayout>
      <Stack asChild gap="22px">
        <form action={formAction} noValidate>
          {state.message && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}

          <input type="hidden" name="clientId" value={clientId} />
          <input type="hidden" name="personId" value={view.personId} />

          {/*
            Who is paying whom, at the top of the card, in words beside a directional avatar — as
            drawn. The avatar's fill is the glance-level cue and the sentence is the meaning; the
            reference sits with them because this form has no rail to put it in.
          */}
          <Flex align="center" justify="space-between" gap="3" wrap="wrap">
            <Flex align="center" gap="10px">
              <Avatar
                name={view.personName}
                relation={direction === "person_to_user" ? "owesYou" : "youOwe"}
                size="xl"
              />
              <Text fontSize="control">
                {direction === "person_to_user" ? view.personName : "You"}{" "}
                <Text as="strong" fontWeight="700">
                  {direction === "person_to_user" ? "pays you" : `pay ${view.personName}`}
                </Text>
              </Text>
            </Flex>

            <ReferenceCode code={referenceCode} />
          </Flex>

          {bothDirections ? (
            <Field id="direction" label="Which way is the money going?">
              <SelectInput
                id="direction"
                name="direction"
                value={direction}
                onChange={(event) => changeDirection(event.target.value)}
              >
                <option value="person_to_user">{view.personName} pays you</option>
                <option value="user_to_person">You pay {view.personName}</option>
              </SelectInput>
            </Field>
          ) : (
            // One direction is possible, so there is nothing to choose — the sentence above already
            // said which, and a read-only select would be a control that does nothing.
            <input type="hidden" name="direction" value={direction} />
          )}

          <Field
            id="amount"
            label={`Payment amount (${view.currency})`}
            hint={`${formatMoney(money(outstanding.toFixed(), view.currency))} outstanding`}
            errors={errors.amount}
            required
          >
            <AmountInput
              id="amount"
              name="amount"
              value={amount}
              onChange={(event) => changeAmount(event.target.value)}
              required
            />
          </Field>

          {/*
          The allocation box: full ink at 1.5px and 22px of padding, as drawn. Bordered like a control
          rather than a container card, because the user works inside it.
        */}
          <Stack
            gap="16px"
            borderWidth="thin"
            borderStyle="solid"
            borderColor="line"
            paddingInline={{ base: "16px", md: "22px" }}
            paddingBlock={{ base: "16px", md: "22px" }}
          >
            <Text fontFamily="heading" fontWeight="700" fontSize="control">
              Which expenses does this settle?
            </Text>

            {obligations.map((obligation) => {
              const allocation = allocations.find(
                (entry) => entry.expenseSplitId === obligation.expenseSplitId,
              );

              return (
                <Box key={obligation.expenseSplitId}>
                  <input
                    type="hidden"
                    name={`allocations[${obligations.indexOf(obligation)}].expenseSplitId`}
                    value={obligation.expenseSplitId}
                  />
                  <input
                    type="hidden"
                    name={`allocations[${obligations.indexOf(obligation)}].amount`}
                    value={allocation?.amount ?? "0"}
                  />

                  <Field
                    id={`allocation-${obligation.expenseSplitId}`}
                    label={obligation.description}
                    hint={`${obligation.dateLabel} · ${obligation.formattedRemaining} outstanding`}
                  >
                    <AmountInput
                      id={`allocation-${obligation.expenseSplitId}`}
                      value={allocation?.amount ?? ""}
                      onChange={(event) =>
                        changeAllocation(obligation.expenseSplitId, event.target.value)
                      }
                      aria-label={`Amount to settle against ${obligation.description}`}
                    />
                  </Field>
                </Box>
              );
            })}

            {/*
            The allocated total, with the `BALANCED` stamp beside it once it matches — the fourth audit
            motif (5.4), and this is the screen the design draws it on.

            The stamp is `aria-hidden` by default and stays that way: the figure next to it already
            proves the claim, so a reader who cannot make out rotated dashed text has lost nothing.
            That is the rule the component exists to enforce.
          */}
            <Flex
              justify="space-between"
              align="center"
              gap="3"
              borderTopWidth="hairline"
              borderColor="line.soft"
              pt="16px"
            >
              <Text textStyle="eyebrow">Allocated</Text>
              <Flex align="center" gap="10px">
                <Text
                  textStyle="amount"
                  fontSize="cardTitle"
                  fontWeight="700"
                  color={balanced ? "positive" : "negative"}
                >
                  {formatMoney(money(allocatedTotal.toFixed(), view.currency))}
                </Text>
                {balanced ? <Stamp label="Balanced" /> : null}
              </Flex>
            </Flex>

            {/*
            Unbalanced is an `Alert`, never a stamp (5.4). A rotated dashed stamp reading "UNBALANCED"
            would make a blocking error look ornamental — the stamp's visual language is "checked and
            approved".
          */}
            {!balanced ? (
              <Alert tone="warning">
                The allocated amounts must add up to the payment amount before you can save.
              </Alert>
            ) : null}

            {errors.allocations?.length ? (
              <Alert tone="error">{errors.allocations.join(" ")}</Alert>
            ) : null}
          </Stack>

          {/* Account and date two up, as drawn — both are short, and neither is typed into. */}
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: "22px", md: "20px" }}>
            <Field
              id="accountId"
              label="Account (optional)"
              hint="Leave empty for a cash payment."
              errors={errors.accountId}
            >
              <SelectInput id="accountId" name="accountId" defaultValue="">
                <option value="">Not tracked</option>
                {accountOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </SelectInput>
            </Field>

            <Field id="date" label="Date" errors={errors.date} required>
              <TextInput id="date" name="date" type="date" defaultValue={todayValue} required />
            </Field>
          </SimpleGrid>

          <Field id="notes" label="Notes (optional)" errors={errors.notes}>
            <TextAreaInput id="notes" name="notes" maxLength={LIMITS.notesMaxLength} />
          </Field>

          <FormActions
            submitLabel="Record settlement"
            pending={pending}
            submitDisabled={!balanced}
            /*
              Always the person, never the settlements list. Settling up is an action *on* a person,
              and abandoning it should return to the balance the user was looking at. See the note in
              `AccountForm` for why this is not `router.back()`.
            */
            onCancel={() => router.push(`/people/${view.personId}`)}
          />
        </form>
      </Stack>
    </FormLayout>
  );
}

/**
 * Spreads a payment across obligations, oldest first.
 *
 * Mirrors `allocateOldestFirst` in the domain. Kept as a small local function because it
 * works on the view model's decimal strings rather than Money values; the server
 * validates the result regardless.
 */
function spreadOldestFirst(
  amount: string,
  obligations: readonly SettleableObligationView[],
): Allocation[] {
  let remaining = toDecimal(amount.trim() === "" ? "0" : amount);

  return obligations.map((obligation) => {
    const outstanding = toDecimal(obligation.remainingAmount.amount);

    if (!remaining.greaterThan(0)) {
      return { expenseSplitId: obligation.expenseSplitId, amount: "0" };
    }

    const allocated = remaining.greaterThan(outstanding) ? outstanding : remaining;
    remaining = remaining.minus(allocated);

    return { expenseSplitId: obligation.expenseSplitId, amount: allocated.toFixed() };
  });
}
