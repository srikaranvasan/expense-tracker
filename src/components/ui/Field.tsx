import { forwardRef } from "react";
import type { ReactNode } from "react";
import { Field as ChakraField, Input, NativeSelect, Textarea } from "@chakra-ui/react";
import type { InputProps, TextareaProps } from "@chakra-ui/react";

/**
 * Form field primitives.
 *
 * The wrapper exists to guarantee the accessibility wiring: Chakra's Field
 * associates the label, helper text and error message with the control, and this
 * component makes sure an error is always rendered through `Field.ErrorText` so it
 * is announced rather than being colour-only
 * (docs/06-CODING-PRACTICES.md section 40).
 */

export type FieldProps = {
  id: string;
  label: string;
  hint?: string;
  /** Messages from schema validation; presence marks the field invalid. */
  errors?: string[];
  required?: boolean;
  children: ReactNode;
};

export function Field({ id, label, hint, errors, required, children }: FieldProps) {
  const invalid = Boolean(errors?.length);

  return (
    <ChakraField.Root invalid={invalid} required={required} gap="1.5">
      <ChakraField.Label htmlFor={id} fontSize="sm" fontWeight="medium">
        {label}
        <ChakraField.RequiredIndicator />
      </ChakraField.Label>

      {children}

      {hint && !invalid ? (
        <ChakraField.HelperText fontSize="xs">{hint}</ChakraField.HelperText>
      ) : null}

      {invalid ? (
        <ChakraField.ErrorText fontSize="xs">{errors?.join(" ")}</ChakraField.ErrorText>
      ) : null}
    </ChakraField.Root>
  );
}

/**
 * Text input.
 *
 * `size="lg"` by default: a 16px font size stops iOS Safari from zooming when the
 * input receives focus.
 */
export const TextInput = forwardRef<HTMLInputElement, InputProps>(function TextInput(
  { size = "lg", ...rest },
  ref,
) {
  return <Input ref={ref} size={size} bg="surface" {...rest} />;
});

/** Amount input: numeric keypad on mobile, tabular figures while typing. */
export const AmountInput = forwardRef<HTMLInputElement, InputProps>(
  function AmountInput(props, ref) {
    return <TextInput ref={ref} inputMode="decimal" textStyle="amount" {...props} />;
  },
);

export type SelectInputProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

/**
 * Native select.
 *
 * Deliberately native rather than a custom listbox: the OS picker on iOS is
 * faster to use one-handed and needs no accessibility work of its own.
 */
export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { children, ...rest },
  ref,
) {
  return (
    <NativeSelect.Root size="lg">
      <NativeSelect.Field ref={ref} bg="surface" {...rest}>
        {children}
      </NativeSelect.Field>
      <NativeSelect.Indicator />
    </NativeSelect.Root>
  );
});

export const TextAreaInput = forwardRef<HTMLTextAreaElement, TextareaProps>(function TextAreaInput(
  { size = "lg", ...rest },
  ref,
) {
  return <Textarea ref={ref} size={size} bg="surface" minH="20" resize="vertical" {...rest} />;
});
