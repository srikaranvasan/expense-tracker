"use client";

import { useActionState, useEffect, useMemo } from "react";
import { HStack, Stack } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Button } from "@/components/ui/Button";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { LIMITS } from "@/config/constants";
import { newClientId } from "@/lib/utils/client-id";
import { createCategoryAction, updateCategoryAction } from "../actions/category-actions";
import type { ActionState } from "../actions/category-actions";
import type { CategoryOption, CategoryView } from "../view-models/category-view-model";

const initialState: ActionState = { ok: false };

export type CategoryFormProps = {
  /** Top-level categories available as a parent. */
  parentOptions: readonly CategoryOption[];
  category?: CategoryView;
  onDone?: () => void;
};

/**
 * Create/edit form for a category.
 *
 * Only one level of nesting is supported, so the parent picker offers top-level
 * categories only, and a category that already has children cannot be moved under a
 * parent - the server rejects that and the message explains why.
 */
export function CategoryForm({ parentOptions, category, onDone }: CategoryFormProps) {
  const isEdit = category !== undefined;

  const action = isEdit ? updateCategoryAction.bind(null, category.id) : createCategoryAction;
  const [state, formAction, pending] = useActionState(action, initialState);

  // Stable across retries so a resubmission cannot create a duplicate.
  const clientId = useMemo(() => newClientId(), []);

  useEffect(() => {
    if (state.ok) onDone?.();
  }, [state.ok, onDone]);

  const errors = state.fieldErrors ?? {};

  // A category with children cannot itself become a child.
  const selectableParents = parentOptions.filter((option) => option.id !== category?.id);

  return (
    <Stack asChild gap="4">
      <form action={formAction} noValidate>
        {state.message ? (
          <Alert tone={state.ok ? "success" : "error"}>{state.message}</Alert>
        ) : null}

        {isEdit ? (
          <input type="hidden" name="expectedSyncVersion" value={category.syncVersion} />
        ) : (
          <>
            <input type="hidden" name="clientId" value={clientId} />
            <input type="hidden" name="kind" value="expense" />
          </>
        )}

        <Field id="category-name" label="Name" errors={errors.name} required>
          <TextInput
            id="category-name"
            name="name"
            defaultValue={category?.name}
            placeholder="Groceries"
            maxLength={LIMITS.nameMaxLength}
            autoComplete="off"
            required
          />
        </Field>

        <Field
          id="category-parent"
          label="Parent category (optional)"
          hint="Leave empty to create a top-level category."
          errors={errors.parentId}
        >
          <SelectInput id="category-parent" name="parentId" defaultValue={category?.parentId ?? ""}>
            <option value="">None (top level)</option>
            {selectableParents.map((option) => (
              <option key={option.id} value={option.id}>
                {option.name}
              </option>
            ))}
          </SelectInput>
        </Field>

        <HStack gap="3">
          <Button type="submit" loading={pending} fullWidth>
            {isEdit ? "Save changes" : "Add category"}
          </Button>
          {onDone ? (
            <Button type="button" tone="ghost" onClick={onDone} disabled={pending}>
              Cancel
            </Button>
          ) : null}
        </HStack>
      </form>
    </Stack>
  );
}
