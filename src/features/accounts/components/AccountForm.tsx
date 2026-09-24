"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Fieldset, SimpleGrid, Stack } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { AmountInput, Field, SelectInput, TextInput } from "@/components/ui/Field";
import { FormActions } from "@/components/ui/FormActions";
import { FormLayout, TintPanel } from "@/components/ui/FormLayout";
import { LIMITS } from "@/config/constants";
import { newClientId } from "@/lib/utils/client-id";
import type { AccountType } from "@/types/common";
import { createAccountAction, updateAccountAction } from "../actions/account-actions";
import type { ActionState } from "../actions/account-actions";
import type { AccountView } from "../view-models/account-view-model";

const initialState: ActionState = { ok: false };

const TYPE_OPTIONS: ReadonlyArray<{ value: AccountType; label: string }> = [
  { value: "bank", label: "Bank" },
  { value: "cash", label: "Cash" },
  { value: "credit_card", label: "Credit card" },
];

export type AccountFormProps = {
  currency: string;
  /** Present when editing an existing account. */
  account?: AccountView;
};

/**
 * Create/edit form for an account.
 *
 * The credit-card fields appear only for a card. On edit, type is read-only because
 * changing it would reinterpret every amount already recorded against the account.
 */
export function AccountForm({ currency, account }: AccountFormProps) {
  const router = useRouter();
  const isEdit = account !== undefined;

  /**
   * Where Cancel goes — the record on an edit, the list on a create.
   *
   * Group 46 replaced `router.back()` here. `back()` was correct only when the user had arrived by
   * clicking a link: on a cold URL it went nowhere, after a refresh it returned to this same form,
   * and from the quick-add button it could land on any screen in the app, because that button is on
   * all of them (`docs/navigation-tasks/01-NAVIGATION-AUDIT.md` section 4.3).
   *
   * A hierarchy push has none of those failure modes, and it agrees with the back link in the page
   * header above — which is the other half of why this is not a history call.
   */
  const cancelHref = isEdit ? `/accounts/${account.id}` : "/accounts";

  const action = isEdit ? updateAccountAction.bind(null, account.id) : createAccountAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  const [type, setType] = useState<AccountType>(account?.type ?? "bank");
  const isCard = type === "credit_card";

  // Generated once per mounted form, so resubmitting after a failure reuses the
  // same id and cannot create a duplicate account.
  const clientId = useMemo(() => newClientId(), []);

  // Navigating is a side effect, so it happens after the render that reported
  // success rather than during it.
  useEffect(() => {
    if (state.ok && state.entityId) {
      router.push(`/accounts/${state.entityId}`);
    }
  }, [state.ok, state.entityId, router]);

  const errors = state.fieldErrors ?? {};

  return (
    <FormLayout
      rail={
        !isEdit ? (
          <TintPanel eyebrow="Why this matters">
            An opening balance is the starting point every later figure is computed from — nothing
            here is a stored total. For a credit card, enter what you currently owe.
          </TintPanel>
        ) : undefined
      }
    >
      <Stack asChild gap="22px">
        <form action={formAction} noValidate>
          {state.message ? (
            <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
          ) : null}

          {isEdit ? (
            <input type="hidden" name="expectedSyncVersion" value={account.syncVersion} />
          ) : (
            <>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="currency" value={currency} />
            </>
          )}

          <Field id="name" label="Account name" errors={errors.name} required>
            <TextInput
              id="name"
              name="name"
              defaultValue={account?.name}
              placeholder="HDFC Savings"
              maxLength={LIMITS.nameMaxLength}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            id="type"
            label="Type"
            hint={isEdit ? "The type cannot be changed after creation." : undefined}
            errors={errors.type}
            required
          >
            {isEdit ? (
              <TextInput id="type" value={account.typeLabel} readOnly disabled />
            ) : (
              <SelectInput
                id="type"
                name="type"
                value={type}
                onChange={(event) => setType(event.target.value as AccountType)}
              >
                {TYPE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            )}
          </Field>

          <Field
            id="openingBalance"
            label={isCard ? `Current outstanding (${currency})` : `Opening balance (${currency})`}
            hint={
              isCard
                ? "How much you currently owe on this card."
                : "The balance at the moment you start tracking this account."
            }
            errors={errors.openingBalance}
          >
            <AmountInput
              id="openingBalance"
              name="openingBalance"
              defaultValue={account?.openingBalance.amount ?? "0"}
            />
          </Field>

          <Field
            id="institutionName"
            label="Bank or issuer (optional)"
            errors={errors.institutionName}
          >
            <TextInput
              id="institutionName"
              name="institutionName"
              defaultValue={account?.institutionName ?? ""}
              maxLength={LIMITS.nameMaxLength}
              autoComplete="off"
            />
          </Field>

          {/*
          The card-details fieldset, as an inset block on `surface.sunken` (7.3) — the same treatment
          the split editor gets, and for the same reason: it is a group of fields inside a card, not a
          card of its own. A real `<fieldset>` with a real `<legend>`, so the grouping is announced
          rather than only drawn.
        */}
          {isCard ? (
            <Fieldset.Root
              bg="surface.sunken"
              borderWidth="thin"
              borderStyle="solid"
              borderColor="line.card"
              paddingInline={{ base: "16px", md: "20px" }}
              paddingBlock={{ base: "16px", md: "20px" }}
            >
              <Fieldset.Legend textStyle="eyebrow" mb="16px">
                Card details
              </Fieldset.Legend>

              <Fieldset.Content gap="22px">
                <Field
                  id="creditLimit"
                  label={`Credit limit (${currency})`}
                  errors={errors.creditLimit}
                  required
                >
                  <AmountInput
                    id="creditLimit"
                    name="creditLimit"
                    defaultValue={account?.creditLimit?.amount ?? ""}
                    required
                  />
                </Field>

                <SimpleGrid columns={{ base: 1, sm: 2 }} gap="4">
                  <Field
                    id="statementDay"
                    label="Statement day (optional)"
                    hint="Day of the month, 1-31."
                    errors={errors.statementDay}
                  >
                    <TextInput
                      id="statementDay"
                      name="statementDay"
                      defaultValue={account?.statementDay ?? ""}
                      type="number"
                      min={LIMITS.statementDayMin}
                      max={LIMITS.statementDayMax}
                      inputMode="numeric"
                    />
                  </Field>

                  <Field
                    id="paymentDueDay"
                    label="Payment due day (optional)"
                    hint="Day of the month, 1-31."
                    errors={errors.paymentDueDay}
                  >
                    <TextInput
                      id="paymentDueDay"
                      name="paymentDueDay"
                      defaultValue={account?.paymentDueDay ?? ""}
                      type="number"
                      min={LIMITS.statementDayMin}
                      max={LIMITS.statementDayMax}
                      inputMode="numeric"
                    />
                  </Field>
                </SimpleGrid>
              </Fieldset.Content>
            </Fieldset.Root>
          ) : null}

          <FormActions
            submitLabel={isEdit ? "Save changes" : "Create account"}
            pending={pending}
            onCancel={() => router.push(cancelHref)}
          />
        </form>
      </Stack>
    </FormLayout>
  );
}
