"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Stack } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { AppLink } from "@/components/ui/AppLink";
import { FormActions } from "@/components/ui/FormActions";
import { AmountInput, Field, SelectInput, TextAreaInput, TextInput } from "@/components/ui/Field";
import { FormLayout, ReferenceBox, TintPanel } from "@/components/ui/FormLayout";
import { LIMITS } from "@/config/constants";
import type { AccountOption } from "@/features/accounts/view-models/account-view-model";
import { newClientId } from "@/lib/utils/client-id";
import { referenceCodeFor } from "@/lib/utils/reference-code";
import { createTransferAction, updateTransferAction } from "../actions/transfer-actions";
import type { ActionState } from "../actions/expense-actions";
import type { TransferDetailView } from "../view-models/transfer-view-model";

const initialState: ActionState = { ok: false };

export type TransferFormProps = {
  currency: string;
  accountOptions: readonly AccountOption[];
  /** Today in the user's timezone, as a `YYYY-MM-DD` value. */
  todayValue: string;
  transfer?: TransferDetailView;
};

/**
 * Create/edit form for a transfer between the user's own accounts.
 *
 * Two choices here are deliberate, and both remove errors before the server has to
 * reject them:
 *
 * 1. The destination list excludes credit cards. Paying a card is a card payment, a
 *    separate record with different effects, so offering it here would invite the
 *    wrong one (docs/00-README.md, Non-Negotiable Accounting Principle).
 * 2. The destination list excludes whichever account is currently the source, so the
 *    same-account case cannot be selected at all.
 *
 * Neither replaces the server rules in `domain/transactions/transfer-rules.ts`. A
 * hidden option is a convenience; the guarantee is server-side
 * (docs/06-CODING-PRACTICES.md section 12).
 */
export function TransferForm({
  currency,
  accountOptions,
  todayValue,
  transfer,
}: TransferFormProps) {
  const router = useRouter();
  const isEdit = transfer !== undefined;

  // The record on an edit, the activity list on a create. See the note in `AccountForm`.
  const cancelHref = isEdit ? `/transactions/${transfer.id}` : "/transactions";

  const action = isEdit ? updateTransferAction.bind(null, transfer.id) : createTransferAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // One id per mounted form, so resubmitting after a validation failure cannot
  // create a second transfer.
  const clientId = useMemo(() => newClientId(), []);
  // The reference the saved record will carry, known before the write. See `ExpenseForm`.
  const referenceCode = useMemo(() => referenceCodeFor({ clientId }), [clientId]);

  const destinationOptions = useMemo(
    () => accountOptions.filter((option) => option.type !== "credit_card"),
    [accountOptions],
  );

  const [fromAccountId, setFromAccountId] = useState(
    () => transfer?.fromAccountId ?? accountOptions[0]?.id ?? "",
  );
  const [toAccountId, setToAccountId] = useState(
    () =>
      transfer?.toAccountId ??
      destinationOptions.find((option) => option.id !== accountOptions[0]?.id)?.id ??
      "",
  );

  useEffect(() => {
    if (state.ok && state.entityId) {
      router.push(`/transactions/${state.entityId}`);
    }
  }, [state.ok, state.entityId, router]);

  const errors = state.fieldErrors ?? {};
  const availableDestinations = destinationOptions.filter((option) => option.id !== fromAccountId);

  // Two accounts are needed, and at least one of them must be able to receive money.
  if (accountOptions.length < 2 || destinationOptions.length === 0) {
    return (
      <Alert
        tone="warning"
        title="Add another account first"
        action={<AppLink href="/accounts/new">Add an account</AppLink>}
      >
        A transfer moves money between two of your own accounts, and the destination cannot be a
        credit card. Add a second bank or cash account, then record the transfer.
      </Alert>
    );
  }

  function handleFromChange(nextFrom: string): void {
    setFromAccountId(nextFrom);

    // Picking a source that is already the destination would leave both selects on
    // the same account, so the destination steps aside to the first other option.
    if (nextFrom === toAccountId) {
      setToAccountId(destinationOptions.find((option) => option.id !== nextFrom)?.id ?? "");
    }
  }

  return (
    <FormLayout
      rail={
        <>
          {!isEdit ? (
            <TintPanel eyebrow="Why this matters">
              A transfer is not spending, so it will not appear in your monthly total. It moves both
              account balances and nothing else.
            </TintPanel>
          ) : null}

          <ReferenceBox
            code={isEdit ? transfer.referenceCode : referenceCode}
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
            <input type="hidden" name="expectedSyncVersion" value={transfer.syncVersion} />
          ) : (
            <input type="hidden" name="clientId" value={clientId} />
          )}

          <Field id="amount" label={`Amount (${currency})`} errors={errors.amount} required>
            <AmountInput
              id="amount"
              name="amount"
              defaultValue={transfer?.amount.amount ?? ""}
              placeholder="0.00"
              autoFocus={!isEdit}
              required
            />
          </Field>

          <Field id="fromAccountId" label="From" errors={errors.fromAccountId} required>
            <SelectInput
              id="fromAccountId"
              name="fromAccountId"
              value={fromAccountId}
              onChange={(event) => handleFromChange(event.target.value)}
              required
            >
              {accountOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field
            id="toAccountId"
            label="To"
            hint="Paying a credit card is a card payment, not a transfer."
            errors={errors.toAccountId}
            required
          >
            <SelectInput
              id="toAccountId"
              name="toAccountId"
              value={toAccountId}
              onChange={(event) => setToAccountId(event.target.value)}
              required
            >
              {availableDestinations.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          <Field id="date" label="Date" errors={errors.date} required>
            <TextInput
              id="date"
              name="date"
              type="date"
              defaultValue={transfer?.dateInputValue ?? todayValue}
              required
            />
          </Field>

          <Field
            id="description"
            label="Description (optional)"
            errors={errors.description}
            hint="Defaults to “Transfer”."
          >
            <TextInput
              id="description"
              name="description"
              defaultValue={transfer?.description ?? ""}
              placeholder="Transfer"
              maxLength={LIMITS.descriptionMaxLength}
              autoComplete="off"
            />
          </Field>

          <Field id="notes" label="Notes (optional)" errors={errors.notes}>
            <TextAreaInput
              id="notes"
              name="notes"
              defaultValue={transfer?.notes ?? ""}
              maxLength={LIMITS.notesMaxLength}
            />
          </Field>

          {/* The "not spending" sentence now lives in the rail's tint panel, where it is read once
              rather than found at the bottom of the form. */}
          <FormActions
            submitLabel={isEdit ? "Save changes" : "Record transfer"}
            pending={pending}
            onCancel={() => router.push(cancelHref)}
          />
        </form>
      </Stack>
    </FormLayout>
  );
}
