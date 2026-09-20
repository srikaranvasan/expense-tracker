import { Field, SelectInput } from "@/components/ui/Field";
import type { CategoryOption } from "../view-models/category-view-model";

export type CategoryPickerProps = {
  id?: string;
  name?: string;
  label?: string;
  options: readonly CategoryOption[];
  defaultValue?: string | null;
  errors?: string[];
  required?: boolean;
  /** Text for the "no category" option. Omit to make a choice mandatory. */
  emptyLabel?: string;
};

/**
 * Category select for the expense forms.
 *
 * Children are indented under their parent using a non-breaking space rather than a
 * nested `<optgroup>`, because a parent category is itself selectable - `optgroup`
 * labels are not.
 */
export function CategoryPicker({
  id = "categoryId",
  name = "categoryId",
  label = "Category",
  options,
  defaultValue,
  errors,
  required = false,
  emptyLabel = "No category",
}: CategoryPickerProps) {
  return (
    <Field id={id} label={label} errors={errors} required={required}>
      <SelectInput id={id} name={name} defaultValue={defaultValue ?? ""}>
        {required ? (
          <option value="" disabled>
            Choose a category
          </option>
        ) : (
          <option value="">{emptyLabel}</option>
        )}

        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.depth === 1 ? `\u00A0\u00A0\u00A0${option.name}` : option.name}
          </option>
        ))}
      </SelectInput>
    </Field>
  );
}
