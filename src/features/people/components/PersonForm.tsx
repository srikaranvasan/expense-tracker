"use client";

import { useActionState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { HStack, Stack } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { Field, TextAreaInput, TextInput } from "@/components/ui/Field";
import { LIMITS } from "@/config/constants";
import { newClientId } from "@/lib/utils/client-id";
import { createPersonAction, updatePersonAction } from "../actions/person-actions";
import type { ActionState } from "../actions/person-actions";
import type { PersonView } from "../view-models/person-view-model";

const initialState: ActionState = { ok: false };

export function PersonForm({ person }: { person?: PersonView }) {
  const router = useRouter();
  const isEdit = person !== undefined;

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
    <Stack asChild gap="4">
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

        <HStack gap="3">
          <Button type="submit" size="lg" loading={pending} fullWidth>
            {isEdit ? "Save changes" : "Add person"}
          </Button>
          <Button type="button" tone="secondary" size="lg" onClick={() => router.back()}>
            Cancel
          </Button>
        </HStack>
      </form>
    </Stack>
  );
}
