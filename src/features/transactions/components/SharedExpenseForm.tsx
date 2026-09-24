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
import { CategoryPicker } from "@/features/categories/components/CategoryPicker";
import type { CategoryOption } from "@/features/categories/view-models/category-view-model";
import type { PersonOption } from "@/features/people/view-models/person-view-model";
import { newClientId } from "@/lib/utils/client-id";
import { referenceCodeFor } from "@/lib/utils/reference-code";
import {
  createSharedExpenseAction,
  updateSharedExpenseAction,
} from "../actions/shared-expense-actions";
import type { ActionState } from "../actions/shared-expense-actions";
import { useSplitDraft } from "../hooks/use-split-draft";
import type { SplitMethodDraft } from "../hooks/use-split-draft";
import type { ExpenseDetailView } from "../view-models/expense-view-model";
import { SplitEditor } from "./SplitEditor";

const initialState: ActionState = { ok: false };

export type SharedExpenseFormProps = {
  currency: string;
  accountOptions: readonly AccountOption[];
  categoryOptions: readonly CategoryOption[];
  peopleOptions: readonly PersonOption[];
  todayValue: string;
  expense?: ExpenseDetailView;
};

/**
 * Create/edit form for a shared expense.
 *
 * The payer control is the important one. Choosing a person hides the account picker
 * entirely, because when somebody else pays, none of the user's accounts moved -
 * recording one would shift a balance that never changed
 * (docs/09-DATABASE-SCHEMA.md section 13).
 */
export function SharedExpenseForm({
  currency,
  accountOptions,
  categoryOptions,
  peopleOptions,
  todayValue,
  expense,
}: SharedExpenseFormProps) {
  const router = useRouter();
  const isEdit = expense !== undefined;

  // The record on an edit, the activity list on a create. See the note in `AccountForm`.
  const cancelHref = isEdit ? `/transactions/${expense.id}` : "/transactions";

  const action = isEdit
    ? updateSharedExpenseAction.bind(null, expense.id)
    : createSharedExpenseAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [amount, setAmount] = useState(expense?.amount.amount ?? "");
  const [paidByPersonId, setPaidByPersonId] = useState(expense?.paidByPersonId ?? "");

  const userPaid = paidByPersonId === "";

  const initialParticipants = useMemo(
    () =>
      expense?.participants.map((participant) => ({
        personId: participant.personId,
        amount: participant.shareAmount.amount,
      })),
    [expense],
  );

  const draft = useSplitDraft({
    currency,
    amount,
    peopleOptions,
    ...(initialParticipants ? { initialParticipants } : {}),
    initialMethod: (isEdit ? "custom" : "equal") as SplitMethodDraft,
  });

  // One client id per mounted form, so resubmitting after a failure cannot create a
  // second expense.
  const clientId = useMemo(() => newClientId(), []);
  // The reference the saved record will carry, known before the write. See `ExpenseForm`.
  const referenceCode = useMemo(() => referenceCodeFor({ clientId }), [clientId]);

  useEffect(() => {
    if (state.ok && state.entityId) {
      router.push(`/transactions/${state.entityId}`);
    }
  }, [state.ok, state.entityId, router]);

  const errors = state.fieldErrors ?? {};

  if (peopleOptions.length === 0) {
    return (
      <Alert
        tone="warning"
        title="Add someone first"
        action={<AppLink href="/people/new">Add a person</AppLink>}
      >
        A shared expense needs at least one other person. Add a person, then split an expense with
        them.
      </Alert>
    );
  }

  if (userPaid && accountOptions.length === 0) {
    return (
      <Alert
        tone="warning"
        title="Add an account first"
        action={<AppLink href="/accounts/new">Add an account</AppLink>}
      >
        If you paid, the money has to come from one of your accounts. Create an account, or record
        that somebody else paid.
      </Alert>
    );
  }

  return (
    <FormLayout
      rail={
        <>
          {!isEdit ? (
            <TintPanel eyebrow="Why this matters">
              Your own share is what counts as your spending — the rest becomes what each person
              owes you. If somebody else paid, none of your accounts moved.
            </TintPanel>
          ) : null}

          <ReferenceBox
            code={isEdit ? expense.referenceCode : referenceCode}
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
            <input type="hidden" name="expectedSyncVersion" value={expense.syncVersion} />
          ) : (
            <input type="hidden" name="clientId" value={clientId} />
          )}

          <Field id="amount" label={`Total amount (${currency})`} errors={errors.amount} required>
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

          <Field id="description" label="What was it for?" errors={errors.description} required>
            <TextInput
              id="description"
              name="description"
              defaultValue={expense?.description}
              placeholder="Dinner"
              maxLength={LIMITS.descriptionMaxLength}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            id="paidByPersonId"
            label="Who paid?"
            hint={userPaid ? undefined : "No account of yours is charged when someone else pays."}
            errors={errors.paidByPersonId}
          >
            <SelectInput
              id="paidByPersonId"
              name="paidByPersonId"
              value={paidByPersonId}
              onChange={(event) => setPaidByPersonId(event.target.value)}
            >
              <option value="">You</option>
              {peopleOptions.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </SelectInput>
          </Field>

          {userPaid ? (
            <Field id="accountId" label="Paid from" errors={errors.accountId} required>
              <SelectInput
                id="accountId"
                name="accountId"
                defaultValue={expense?.accountId ?? accountOptions[0]?.id ?? ""}
                required
              >
                {accountOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </SelectInput>
            </Field>
          ) : (
            // Explicitly cleared, so switching payer mid-edit removes any stale account.
            <input type="hidden" name="accountId" value="" />
          )}

          <SplitEditor
            currency={currency}
            peopleOptions={peopleOptions}
            draft={draft}
            participantErrors={errors}
          />

          {errors.participants?.length ? (
            <Alert tone="error">{errors.participants.join(" ")}</Alert>
          ) : null}

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

          <FormActions
            submitLabel={isEdit ? "Save changes" : "Record shared expense"}
            pending={pending}
            onCancel={() => router.push(cancelHref)}
          />
        </form>
      </Stack>
    </FormLayout>
  );
}
