"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, Stack } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { FormActions } from "@/components/ui/FormActions";
import { AmountInput, Field, SelectInput, TextAreaInput, TextInput } from "@/components/ui/Field";
import { FormLayout, ReferenceBox, TintPanel } from "@/components/ui/FormLayout";
import { LIMITS } from "@/config/constants";
import type { AccountOption } from "@/features/accounts/view-models/account-view-model";
import { newClientId } from "@/lib/utils/client-id";
import { referenceCodeFor } from "@/lib/utils/reference-code";
import { createCardPaymentAction, updateCardPaymentAction } from "../actions/card-payment-actions";
import type { ActionState } from "../actions/expense-actions";
import type { CardPaymentDetailView } from "../view-models/card-payment-view-model";

const initialState: ActionState = { ok: false };

export type CardPaymentFormProps = {
  currency: string;
  accountOptions: readonly AccountOption[];
  /** Today in the user's timezone, as a `YYYY-MM-DD` value. */
  todayValue: string;
  /** Pre-selects a card, e.g. when arriving from that card's page. */
  defaultCardId?: string | null;
  payment?: CardPaymentDetailView;
};

/**
 * Create/edit form for a credit-card payment.
 *
 * This is the mirror of `TransferForm`: the destination list contains **only** credit
 * cards and the source list excludes them. A card cannot pay a card, and paying a
 * plain bank account is a transfer.
 *
 * Overpayment is warned about, never blocked. See `isOverpayment()` in
 * `domain/transactions/card-payment-rules.ts`: the user really did pay that money, so
 * refusing to record it would make the app disagree with their bank statement.
 */
export function CardPaymentForm({
  currency,
  accountOptions,
  todayValue,
  defaultCardId,
  payment,
}: CardPaymentFormProps) {
  const router = useRouter();
  const isEdit = payment !== undefined;

  // The record on an edit, the activity list on a create. See the note in `AccountForm`.
  const cancelHref = isEdit ? `/transactions/${payment.id}` : "/transactions";

  const action = isEdit ? updateCardPaymentAction.bind(null, payment.id) : createCardPaymentAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  const clientId = useMemo(() => newClientId(), []);
  // The reference the saved record will carry, known before the write. See `ExpenseForm`.
  const referenceCode = useMemo(() => referenceCodeFor({ clientId }), [clientId]);

  const cards = useMemo(
    () => accountOptions.filter((option) => option.type === "credit_card"),
    [accountOptions],
  );
  const sources = useMemo(
    () => accountOptions.filter((option) => option.type !== "credit_card"),
    [accountOptions],
  );

  const [cardId, setCardId] = useState(
    () => payment?.toAccountId ?? defaultCardId ?? cards[0]?.id ?? "",
  );
  const [amount, setAmount] = useState(() => payment?.amount.amount ?? "");

  useEffect(() => {
    if (state.ok && state.entityId) {
      router.push(`/transactions/${state.entityId}`);
    }
  }, [state.ok, state.entityId, router]);

  const errors = state.fieldErrors ?? {};
  const selectedCard = cards.find((option) => option.id === cardId);
  const outstanding = selectedCard?.outstanding ?? null;

  // Compared as numbers only to decide whether to show a hint. The authoritative
  // arithmetic is decimal and happens on the server.
  const overpaying =
    outstanding !== null && amount.trim() !== "" && Number(amount) > Number(outstanding);

  /**
   * Whether the "Pay full balance" shortcut is worth offering.
   *
   * Not just "an outstanding figure exists" — a card at zero would offer "Pay full balance (₹0.00)",
   * which fills the amount with a value the server rejects. Found by rendering the form against a card
   * with no spending on it.
   */
  const canPayFullBalance = outstanding !== null && Number(outstanding) > 0;

  if (cards.length === 0 || sources.length === 0) {
    return (
      <Alert
        tone="warning"
        title="Add the accounts first"
        action={<AppLink href="/accounts/new">Add an account</AppLink>}
      >
        A card payment needs a credit card to pay and a bank or cash account to pay from. Add
        whichever is missing, then record the payment.
      </Alert>
    );
  }

  return (
    <FormLayout
      rail={
        <>
          {!isEdit ? (
            <TintPanel eyebrow="Why this matters">
              A card payment is not spending — that was recorded when you used the card. This lowers
              what you owe and frees up available credit.
            </TintPanel>
          ) : null}

          <ReferenceBox
            code={isEdit ? payment.referenceCode : referenceCode}
            hint={
              isEdit
                ? "This reference never changes, including through an edit."
                : "Kept for the life of the record. Every entry keeps a permanent reference, like a ledger line."
            }
          />
        </>
      }
    >
      <Stack asChild gap="22px">
        <form action={formAction} noValidate>
          {state.message && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}

          {isEdit ? (
            <input type="hidden" name="expectedSyncVersion" value={payment.syncVersion} />
          ) : (
            <input type="hidden" name="clientId" value={clientId} />
          )}

          <Field id="toAccountId" label="Card to pay" errors={errors.toAccountId} required>
            <SelectInput
              id="toAccountId"
              name="toAccountId"
              value={cardId}
              onChange={(event) => setCardId(event.target.value)}
              required
            >
              {cards.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                  {option.formattedOutstanding ? ` — ${option.formattedOutstanding} owed` : ""}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field id="amount" label={`Amount (${currency})`} errors={errors.amount} required>
            <AmountInput
              id="amount"
              name="amount"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              autoFocus={!isEdit}
              required
            />
          </Field>

          {/*
            Not drawn anywhere in the handoff, and the most-used thing on this form: clearing a card
            in full is the normal case. A `secondary` button rather than the `ghost` it used to be —
            ghost reads as a link, and this is an action that changes a field's value.

            It disables itself once the amount already equals the balance, so pressing it twice cannot
            look like it did nothing.
          */}
          {canPayFullBalance && !isEdit ? (
            <Box>
              <Button
                type="button"
                tone="secondary"
                size="sm"
                onClick={() => setAmount(outstanding)}
                disabled={amount === outstanding}
              >
                Pay full balance ({selectedCard?.formattedOutstanding})
              </Button>
            </Box>
          ) : null}

          {overpaying ? (
            <Alert tone="warning" title="More than the balance">
              This is more than the {selectedCard?.formattedOutstanding} currently owed. That is
              fine — the card will simply be left in credit.
            </Alert>
          ) : null}

          <Field id="fromAccountId" label="Pay from" errors={errors.fromAccountId} required>
            <SelectInput
              id="fromAccountId"
              name="fromAccountId"
              defaultValue={payment?.fromAccountId ?? sources[0]?.id ?? ""}
              required
            >
              {sources.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name} — {option.formattedBalance}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field id="date" label="Date" errors={errors.date} required>
            <TextInput
              id="date"
              name="date"
              type="date"
              defaultValue={payment?.dateInputValue ?? todayValue}
              required
            />
          </Field>

          <Field
            id="description"
            label="Description (optional)"
            errors={errors.description}
            hint="Defaults to “Credit card payment”."
          >
            <TextInput
              id="description"
              name="description"
              defaultValue={payment?.description ?? ""}
              placeholder="Credit card payment"
              maxLength={LIMITS.descriptionMaxLength}
              autoComplete="off"
            />
          </Field>

          <Field id="notes" label="Notes (optional)" errors={errors.notes}>
            <TextAreaInput
              id="notes"
              name="notes"
              defaultValue={payment?.notes ?? ""}
              maxLength={LIMITS.notesMaxLength}
            />
          </Field>

          {/* The "not spending" sentence now lives in the rail's tint panel. */}
          <FormActions
            submitLabel={isEdit ? "Save changes" : "Record payment"}
            pending={pending}
            onCancel={() => router.push(cancelHref)}
          />
        </form>
      </Stack>
    </FormLayout>
  );
}
