"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Stack } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { FormActions } from "@/components/ui/FormActions";
import { Field, TextAreaInput, TextInput } from "@/components/ui/Field";
import { FormLayout, TintPanel } from "@/components/ui/FormLayout";
import { LIMITS } from "@/config/constants";
import { newClientId } from "@/lib/utils/client-id";
import { createPersonAction, updatePersonAction } from "../actions/person-actions";
import type { ActionState } from "../actions/person-actions";
import type { PersonView } from "../view-models/person-view-model";

const initialState: ActionState = { ok: false };

export function PersonForm({ person }: { person?: PersonView }) {
  const router = useRouter();
  const isEdit = person !== undefined;

  // The record on an edit, the list on a create. See the note in `AccountForm` for why this is not
  // `router.back()`.
  const cancelHref = isEdit ? `/people/${person.id}` : "/people";

  const action = isEdit ? updatePersonAction.bind(null, person.id) : createPersonAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // Stable across retries, so a resubmission cannot create a duplicate person.
  const clientId = useMemo(() => newClientId(), []);

  useEffect(() => {
    if (state.ok && state.entityId) {
      router.push(`/people/${state.entityId}`);
    }
  }, [state.ok, state.entityId, router]);

  const errors = state.fieldErrors ?? {};

  return (
    <FormLayout
      rail={
        !isEdit ? (
          <TintPanel eyebrow="Why this matters">
            A person here is only a name to split against — they need no account in this app, and
            nothing is sent to them. Everything you record stays yours.
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
            <input type="hidden" name="expectedSyncVersion" value={person.syncVersion} />
          ) : (
            <input type="hidden" name="clientId" value={clientId} />
          )}

          <Field id="name" label="Name" errors={errors.name} required>
            <TextInput
              id="name"
              name="name"
              defaultValue={person?.name}
              placeholder="Arun"
              maxLength={LIMITS.nameMaxLength}
              autoComplete="off"
              required
            />
          </Field>

          <Field
            id="notes"
            label="Notes (optional)"
            hint="How you know them, for example."
            errors={errors.notes}
          >
            <TextAreaInput
              id="notes"
              name="notes"
              defaultValue={person?.notes ?? ""}
              maxLength={LIMITS.notesMaxLength}
            />
          </Field>

          <FormActions
            submitLabel={isEdit ? "Save changes" : "Add person"}
            pending={pending}
            onCancel={() => router.push(cancelHref)}
          />
        </form>
      </Stack>
    </FormLayout>
  );
}
