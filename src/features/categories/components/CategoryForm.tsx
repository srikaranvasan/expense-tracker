"use client";

import { useActionState, useEffect, useMemo } from "react";
import { Stack } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { Field, SelectInput, TextInput } from "@/components/ui/Field";
import { FormActions } from "@/components/ui/FormActions";
import { LIMITS } from "@/config/constants";
import { newClientId } from "@/lib/utils/client-id";
import { CategoryIconPicker } from "./CategoryIconPicker";
import { createCategoryAction, updateCategoryAction } from "../actions/category-actions";
import type { ActionState } from "../actions/category-actions";
import type { CategoryOption, CategoryView } from "../view-models/category-view-model";

const initialState: ActionState = { ok: false };

export type CategoryFormProps = {
  /** Top-level categories available as a parent. */
  parentOptions: readonly CategoryOption[];
  category?: CategoryView;
  /**
   * Dismisses the inline form, and what Cancel calls.
   *
   * Required as of group 27. It was optional, which made Cancel conditional — and a form with a
   * conditionally reachable way out is the same defect as the clipped-Cancel bug arriving by a
   * different route. Both existing call sites in `CategoryManager` already passed it.
   */
  onDone: () => void;
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
    if (state.ok) onDone();
  }, [state.ok, onDone]);

  const errors = state.fieldErrors ?? {};

  // A category with children cannot itself become a child.
  const selectableParents = parentOptions.filter((option) => option.id !== category?.id);

  return (
    // 22px rhythm, matching every other form. No `FormLayout`: this form is rendered *inline* inside
    // the category list, so it has no page of its own to lay out and no rail to put beside it.
    <Stack asChild gap="22px">
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

        {/*
          The icon picker group 21 decided on (2.3). It writes a registry name into the `icon` field
          that already existed; there is no colour input, because the colour is derived from the
          category's id and so cannot be got wrong.
        */}
        <CategoryIconPicker id="category-icon" defaultValue={category?.icon ?? null} />

        <FormActions
          submitLabel={isEdit ? "Save changes" : "Add category"}
          pending={pending}
          onCancel={onDone}
        />
      </form>
    </Stack>
  );
}
