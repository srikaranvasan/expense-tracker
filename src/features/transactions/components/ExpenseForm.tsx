"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { AmountInput, Field, SelectInput, TextAreaInput, TextInput } from "@/components/ui/Field";
import { LIMITS } from "@/config/constants";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryOption } from "@/features/categories/view-models/category-view-model";
import type { AccountOption } from "@/features/accounts/view-models/account-view-model";
import { useIsOffline } from "@/offline/hooks/useConnectivity";
import { queueExpenseOffline } from "@/offline/writes/queue-expense";
import { newClientId } from "@/lib/utils/client-id";
import {
  createPersonalExpenseAction,
  updatePersonalExpenseAction,
} from "../actions/expense-actions";
import type { ActionState } from "../actions/expense-actions";
import type { ExpenseDetailView } from "../view-models/expense-view-model";

const initialState: ActionState = { ok: false };

export type ExpenseFormProps = {
  currency: string;
  accountOptions: readonly AccountOption[];
  categoryOptions: readonly CategoryOption[];
  /** Today in the user's timezone, as a `YYYY-MM-DD` value. */
  todayValue: string;
  defaultAccountId?: string | null;
  expense?: ExpenseDetailView;
  /** Needed to scope the local record when saving offline. */
  userId: string;
};

/**
 * Create/edit form for a personal expense.
 *
 * Field order follows how people actually think about a purchase: amount, what it
 * was, where it came from. Expense entry is the most frequent action in the app
 * (docs/04-USER-FLOWS.md), so the amount is first and focused.
 */
export function ExpenseForm({
  currency,
  accountOptions,
  categoryOptions,
  todayValue,
  defaultAccountId,
  expense,
  userId,
}: ExpenseFormProps) {
  const router = useRouter();
  const offline = useIsOffline();
  const isEdit = expense !== undefined;

  const action = isEdit
    ? updatePersonalExpenseAction.bind(null, expense.id)
    : createPersonalExpenseAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // One pair of ids per mounted form, so resubmitting after a validation failure
  // cannot create a second expense.
  const clientId = useMemo(() => newClientId(), []);
  const splitClientId = useMemo(() => newClientId(), []);

  const [savingOffline, setSavingOffline] = useState(false);
  const [offlineError, setOfflineError] = useState<string | null>(null);
  const [offlineField, setOfflineField] = useState<string | null>(null);

  useEffect(() => {
    if (state.ok && state.entityId) {
      router.push(`/transactions/${state.entityId}`);
    }
  }, [state.ok, state.entityId, router]);

  /**
   * Saves to the device instead of the server.
   *
   * Only for a new expense. Editing offline would need the queue to collapse a create
   * and an update, which is deferred — so the edit form still requires a connection
   * rather than silently doing something half-supported.
   */
  async function saveOffline(formData: FormData): Promise<void> {
    setSavingOffline(true);
    setOfflineError(null);
    setOfflineField(null);

    const result = await queueExpenseOffline({
      userId,
      currency,
      clientId,
      splitClientId,
      amount: String(formData.get("amount") ?? ""),
      description: String(formData.get("description") ?? ""),
      // A date input gives a local calendar day; midday avoids it landing on the
      // previous day once converted to UTC.
      date: new Date(`${String(formData.get("date") ?? todayValue)}T12:00:00`),
      accountId: String(formData.get("accountId") ?? ""),
      categoryId: emptyToNull(formData.get("categoryId")),
      notes: emptyToNull(formData.get("notes")),
    });

    setSavingOffline(false);

    if (!result.ok) {
      setOfflineError(result.message);
      setOfflineField(result.field ?? null);
      return;
    }

    // No server id exists yet, so the detail page cannot be opened. The list reads from
    // the server, so it will not show this row until sync completes either — saying so
    // plainly is better than navigating somewhere that looks empty.
    router.push("/transactions?saved=offline");
  }

  const errors = {
    ...(state.fieldErrors ?? {}),
    ...(offlineField && offlineError ? { [offlineField]: [offlineError] } : {}),
  };
  const hasAccounts = accountOptions.length > 0;

  if (!hasAccounts) {
    return (
      <Alert tone="warning" title="Add an account first">
        An expense has to be paid from somewhere. Create a bank, cash, or credit-card account, then
        record the expense.
      </Alert>
    );
  }

  // Offline creation is supported; offline editing is not, so an edit still goes to the
  // server and fails honestly rather than queueing something half-handled.
  const useOfflinePath = offline && !isEdit;

  return (
    <Stack asChild gap="4">
      <form action={useOfflinePath ? saveOffline : formAction} noValidate>
        {state.message && !state.ok ? <Alert tone="error">{state.message}</Alert> : null}
        {offlineError && !offlineField ? <Alert tone="error">{offlineError}</Alert> : null}

        {offline ? (
          <Alert tone="warning" title={isEdit ? "You are offline" : "Saving to this device"}>
            {isEdit
              ? "Editing an existing expense needs a connection. Your change has not been saved."
              : "This expense will be stored here and sent automatically when you reconnect."}
          </Alert>
        ) : null}

        {isEdit ? (
          <input type="hidden" name="expectedSyncVersion" value={expense.syncVersion} />
        ) : (
          <>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="splitClientId" value={splitClientId} />
          </>
        )}

        <Field id="amount" label={`Amount (${currency})`} errors={errors.amount} required>
          <AmountInput
            id="amount"
            name="amount"
            defaultValue={expense?.amount.amount ?? ""}
            placeholder="0.00"
            autoFocus={!isEdit}
            required
          />
        </Field>

        <Field id="description" label="What was it for?" errors={errors.description} required>
          <TextInput
            id="description"
            name="description"
            defaultValue={expense?.description}
            placeholder="Groceries"
            maxLength={LIMITS.descriptionMaxLength}
            autoComplete="off"
            required
          />
        </Field>

        <Field id="accountId" label="Paid from" errors={errors.accountId} required>
          <SelectInput
            id="accountId"
            name="accountId"
            defaultValue={expense?.accountId ?? defaultAccountId ?? accountOptions[0]?.id ?? ""}
            required
          >
            {accountOptions.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <CategoryPicker
          options={categoryOptions}
          defaultValue={expense?.categoryId ?? null}
          errors={errors.categoryId}
        />

        <Field id="date" label="Date" errors={errors.date} required>
          <TextInput
            id="date"
            name="date"
            type="date"
            defaultValue={expense?.dateInputValue ?? todayValue}
            required
          />
        </Field>

        <Field id="notes" label="Notes (optional)" errors={errors.notes}>
          <TextAreaInput
            id="notes"
            name="notes"
            defaultValue={expense?.notes ?? ""}
            maxLength={LIMITS.notesMaxLength}
          />
        </Field>

        <HStack gap="3">
          <Button
            type="submit"
            size="lg"
            loading={pending || savingOffline}
            disabled={offline && isEdit}
            fullWidth
          >
            {isEdit ? "Save changes" : useOfflinePath ? "Save on this device" : "Record expense"}
          </Button>
          <Button type="button" tone="secondary" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </HStack>

        {useOfflinePath ? (
          <Text fontSize="xs" color="content.muted">
            Balances will update once this reaches the server.
          </Text>
        ) : null}
      </form>
    </Stack>
  );
}

/** A select or textarea that was left alone submits an empty string, not null. */
function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = value === null ? "" : String(value).trim();
  return text === "" ? null : text;
}
