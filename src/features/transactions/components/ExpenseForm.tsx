"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Box, SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { AppLink } from "@/components/ui/AppLink";
import { FormActions } from "@/components/ui/FormActions";
import { AmountInput, Field, SelectInput, TextAreaInput, TextInput } from "@/components/ui/Field";
import { FormLayout, ReferenceBox, TintPanel } from "@/components/ui/FormLayout";
import { LIMITS } from "@/config/constants";
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryOption } from "@/features/categories/view-models/category-view-model";
import type { AccountOption } from "@/features/accounts/view-models/account-view-model";
import { useIsOffline } from "@/offline/hooks/useConnectivity";
import { queueExpenseOffline } from "@/offline/writes/queue-expense";
import { newClientId } from "@/lib/utils/client-id";
import { referenceCodeFor } from "@/lib/utils/reference-code";
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

  // The record on an edit, the activity list on a create. See the note in `AccountForm` for why this
  // is not `router.back()` — it matters most on this form, which the quick-add button opens from
  // every screen in the app.
  const cancelHref = isEdit ? `/transactions/${expense.id}` : "/transactions";

  const action = isEdit
    ? updatePersonalExpenseAction.bind(null, expense.id)
    : createPersonalExpenseAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // One pair of ids per mounted form, so resubmitting after a validation failure
  // cannot create a second expense.
  const clientId = useMemo(() => newClientId(), []);
  const splitClientId = useMemo(() => newClientId(), []);

  /*
   * The reference the saved record will carry.
   *
   * Known before the write because it comes from `clientId`, which this form generated — and it does
   * not change when the record reaches the server. Derived from the same memo, so it is stable across
   * re-renders for as long as the ids are.
   */
  const referenceCode = useMemo(() => referenceCodeFor({ clientId }), [clientId]);

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

    /*
     * No server id exists yet, so the detail page cannot be opened. The list reads from the
     * server, so it will not show this row until sync completes either.
     *
     * Navigates to the bare path, without the `?saved=offline` marker it used to carry. Two
     * reasons, both found by `tests/e2e/offline-expense.spec.ts`: nothing ever read the
     * parameter, and the service worker caches pages by exact URL — so the one navigation
     * guaranteed to happen while offline was the one guaranteed to miss the cache, landing
     * the user on the offline page instead of their transactions.
     *
     * What the marker was meant to convey is already on screen: the sync status bar reads
     * "Offline · will sync later" with the queued count.
     */
    router.push("/transactions");
  }

  const errors = {
    ...(state.fieldErrors ?? {}),
    ...(offlineField && offlineError ? { [offlineField]: [offlineError] } : {}),
  };
  const hasAccounts = accountOptions.length > 0;

  if (!hasAccounts) {
    return (
      /*
        Group 47 gave this an action. It is the most common first experience in the app — a new user
        taps "Add expense" before creating anything — and it told them to create an account without
        saying where. Because the guard replaces the form, `FormActions` never renders either, so
        before this the page had nothing on it that moved (audit 5.7).
      */
      <Alert
        tone="warning"
        title="Add an account first"
        action={<AppLink href="/accounts/new">Add an account</AppLink>}
      >
        An expense has to be paid from somewhere. Create a bank, cash, or credit-card account, then
        record the expense.
      </Alert>
    );
  }

  // Offline creation is supported; offline editing is not, so an edit still goes to the
  // server and fails honestly rather than queueing something half-handled.
  const useOfflinePath = offline && !isEdit;

  return (
    <FormLayout
      rail={
        <>
          {/*
            Only on a create. The explanation is about *recording* an expense, and a user who has
            opened an existing one to correct a typo has already read it.
          */}
          {!isEdit ? (
            <TintPanel eyebrow="Why this matters">
              This is the most-used screen in the app. Amount is first and autofocused — every other
              field can wait.
            </TintPanel>
          ) : null}

          {/*
            The drawn reference box. It can show the code *before* the record exists because the code
            derives from the `clientId` this component generated, not from a server id — see
            `lib/utils/reference-code.ts`. The same code appears on the row afterwards, which is the
            point: it is worth noting down now.
          */}
          <ReferenceBox
            code={isEdit ? expense.referenceCode : referenceCode}
            draft={useOfflinePath}
            hint={
              isEdit
                ? "This reference never changes, including through an edit."
                : "Kept for the life of the record. Every entry keeps a permanent reference, like a ledger line."
            }
          />
        </>
      }
    >
      {/* 22px between fields, as drawn — wider than the app's usual 16px. */}
      <Stack asChild gap="22px">
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

          {/*
          Two up, as drawn. The account and the category are both "which bucket", they are the
          shortest controls on the form, and pairing them keeps the amount and the description — the
          two fields that actually get typed into — full width above them.
        */}
          <SimpleGrid columns={{ base: 1, md: 2 }} gap={{ base: "22px", md: "20px" }}>
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
          </SimpleGrid>

          {/*
          260px as drawn, and capped rather than full width: a date input that stretches across a
          700px card looks like it is expecting something longer than a date.
        */}
          <Field id="date" label="Date" errors={errors.date} required>
            <Box maxW={{ base: "full", md: "260px" }}>
              <TextInput
                id="date"
                name="date"
                type="date"
                defaultValue={expense?.dateInputValue ?? todayValue}
                required
              />
            </Box>
          </Field>

          <Field id="notes" label="Notes (optional)" errors={errors.notes}>
            <TextAreaInput
              id="notes"
              name="notes"
              defaultValue={expense?.notes ?? ""}
              maxLength={LIMITS.notesMaxLength}
            />
          </Field>

          <FormActions
            submitLabel={
              isEdit ? "Save changes" : useOfflinePath ? "Save on this device" : "Record expense"
            }
            pending={pending || savingOffline}
            submitDisabled={offline && isEdit}
            onCancel={() => router.push(cancelHref)}
          />

          {useOfflinePath ? (
            <Text fontSize="meta" color="content.subtle">
              Balances will update once this reaches the server.
            </Text>
          ) : null}
        </form>
      </Stack>
    </FormLayout>
  );
}

/** A select or textarea that was left alone submits an empty string, not null. */
function emptyToNull(value: FormDataEntryValue | null): string | null {
  const text = value === null ? "" : String(value).trim();
  return text === "" ? null : text;
}
