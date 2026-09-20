"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { AmountInput, Field, SelectInput, TextAreaInput, TextInput } from "@/components/ui/Field";
import { LIMITS } from "@/config/constants";
import type { AccountOption } from "@/features/accounts/view-models/account-view-model";
import { formatMoney, money, toDecimal } from "@/lib/money";
import { newClientId } from "@/lib/utils/client-id";
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
    <Stack asChild gap="4">
      <form action={formAction} noValidate>
        {state.message && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}

        <input type="hidden" name="clientId" value={clientId} />
        <input type="hidden" name="personId" value={view.personId} />

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
          <>
            <input type="hidden" name="direction" value={direction} />
            <Text fontSize="sm" color="content.muted">
              {direction === "person_to_user"
                ? `${view.personName} pays you`
                : `You pay ${view.personName}`}
            </Text>
          </>
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

        <Stack gap="3" borderWidth="1px" borderColor="line" rounded="card" p="4">
          <Text fontSize="sm" fontWeight="semibold">
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

          <Flex justify="space-between" fontSize="sm">
            <Text color="content.muted">Allocated</Text>
            <Text
              textStyle="amount"
              fontWeight="semibold"
              color={balanced ? "positive" : "negative"}
            >
              {formatMoney(money(allocatedTotal.toFixed(), view.currency))}
            </Text>
          </Flex>

          {!balanced ? (
            <Alert tone="warning">
              The allocated amounts must add up to the payment amount before you can save.
            </Alert>
          ) : null}

          {errors.allocations?.length ? (
            <Alert tone="error">{errors.allocations.join(" ")}</Alert>
          ) : null}
        </Stack>

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

        <Field id="notes" label="Notes (optional)" errors={errors.notes}>
          <TextAreaInput id="notes" name="notes" maxLength={LIMITS.notesMaxLength} />
        </Field>

        <HStack gap="3">
          <Button type="submit" size="lg" loading={pending} disabled={!balanced} fullWidth>
            Record settlement
          </Button>
          <Button type="button" tone="secondary" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </HStack>
      </form>
    </Stack>
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
