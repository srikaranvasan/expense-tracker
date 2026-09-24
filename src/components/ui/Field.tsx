import { forwardRef } from "react";
import type { ReactNode } from "react";
import { Box, Field as ChakraField, Input, NativeSelect, Textarea } from "@chakra-ui/react";
import type { BoxProps, InputProps, TextareaProps } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";
import { currencySymbol } from "@/lib/money/format";

/**
 * Form field primitives.
 *
 * The wrapper exists to guarantee the accessibility wiring: Chakra's Field associates the label,
 * helper text and error message with the control, and this component makes sure an error is
 * always rendered through `Field.ErrorText` so it is announced rather than being colour-only
 * (docs/06-CODING-PRACTICES.md section 40).
 *
 * Restyled to "Ledger Geometry" in group 26 (section 7.2). The accessibility contract is
 * unchanged and the existing `Field.test.tsx` passes untouched, which is the intended proof that
 * only the appearance moved.
 */

/* ------------------------------------------------------------------ *
 * Shared control styling
 * ------------------------------------------------------------------ */

/**
 * The resting, focused and invalid states of every control, in one place.
 *
 * ## The border is a constant 2px, and that is a deliberate divergence
 *
 * The handoff draws a 1.5px resting border promoted to 2px on focus, and compensates the padding
 * (13px resting, 11.5px focused) so the text does not shift by half a pixel. Section 5.3 advises
 * against reproducing that literally, and this does not:
 *
 * - **Padding compensation is fragile.** It has to be maintained in lockstep across the text
 *   input, the textarea, the amount input and the select display, and a half-pixel value that
 *   drifts by 0.5px is a text jump nobody attributes to the right cause.
 * - **A sub-pixel `outline` was the other option** and was rejected: 0.5px outlines round to 0
 *   or 1 device pixel depending on the display, so the focus ring would be inconsistent on
 *   exactly the hardware it matters most on.
 *
 * So the width never changes and the **colour** carries the promotion: `line.field` (ink at 28%)
 * at rest, full `line` when focused. At 28% alpha the difference between 1.5px and 2px is
 * imperceptible, while the focused state is exactly as drawn — 2px of full ink plus the teal
 * offset shadow.
 *
 * ## Focus is a shadow, not a ring
 *
 * `outline: none` removes Chakra's default ring and `shadows.hardFocus` replaces it. That is a
 * real accessibility risk if it is ever done by halves, so every interactive element is checked
 * in group 40 — and `hardFocus` flips to `darkTeal` in dark mode, which a hard-coded value
 * would not.
 */
const CONTROL_STYLES = {
  bg: "surface",
  color: "content",
  borderWidth: "thick",
  borderStyle: "solid",
  borderColor: "line.field",
  /*
   * 16px on mobile, 15px as drawn above 768px.
   *
   * iOS Safari zooms the viewport when a focused input's font size is below 16px, and the
   * handoff's 15px would trigger it on every field in the app — a jarring reflow the user then
   * has to pinch back out of. One pixel larger on touch widths is invisible; the zoom is not.
   * Above the single 768px breakpoint there is no such behaviour, so the drawn size is used.
   */
  fontSize: { base: "md", md: "control" },
  // 13px 14px as drawn, and constant across all three states because the border no longer moves.
  paddingInline: "14px",
  paddingBlock: "13px",
  /**
   * A comfortable touch target, added by group 40.
   *
   * The drawn padding and font size produce a 40px control, which is under the 44px `sizes.touch` every
   * button in the app meets. Measured, not assumed. `minH` rather than a bigger padding, so the text
   * stays where the handoff draws it and only the box grows.
   */
  minH: "touch",
  outline: "none",
  _placeholder: { color: "content.quiet" },
  _hover: { borderColor: "line.field" },
  _focusVisible: {
    borderColor: "line",
    boxShadow: "hardFocus",
  },
  // Chakra sets `aria-invalid` from `Field.Root`, so this keys off the real state rather than a
  // prop the call site has to remember.
  _invalid: {
    borderColor: "negative",
    _focusVisible: { borderColor: "negative", boxShadow: "hardFocus" },
  },
  _disabled: {
    bg: "surface.disabled",
    color: "content.quiet",
    borderColor: "content.quiet",
    cursor: "not-allowed",
  },
} as const;

/* ------------------------------------------------------------------ *
 * Field
 * ------------------------------------------------------------------ */

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
    <ChakraField.Root invalid={invalid} required={required} gap="8px">
      {/*
        The label treatment changes completely: mono, uppercase, 11px, tracked. `textStyle`
        carries all five properties (family, size, weight, tracking, colour) from the theme, so
        this is the eyebrow device used everywhere else rather than a re-specification of it.
      */}
      <ChakraField.Label htmlFor={id} textStyle="eyebrow">
        {label}
        {/*
          An asterisk in `negative`, as drawn. Chakra's own indicator renders the asterisk and
          keeps it out of the accessible name — `Field.Root required` is what announces the
          requirement, so this stays decorative and the label does not read as "Amount asterisk".
        */}
        <ChakraField.RequiredIndicator color="negative" />
      </ChakraField.Label>

      {children}

      {hint && !invalid ? (
        <ChakraField.HelperText fontSize="meta" color="content.subtle">
          {hint}
        </ChakraField.HelperText>
      ) : null}

      {invalid ? (
        // Mono, because it sits in the same vertical rhythm as the mono label above it. Never
        // colour alone: the text is the message and the colour is an addition.
        <ChakraField.ErrorText fontFamily="mono" fontSize="eyebrow" color="negative">
          {errors?.join(" ")}
        </ChakraField.ErrorText>
      ) : null}
    </ChakraField.Root>
  );
}

/* ------------------------------------------------------------------ *
 * Inputs
 * ------------------------------------------------------------------ */

/**
 * A glyph or symbol drawn inside a field's leading edge.
 *
 * Two fields use one: `AmountInput`'s currency symbol and `TextInput`'s optional icon. Shared rather
 * than written twice, because of the bug it exists to prevent.
 *
 * ## `zIndex` is the whole point
 *
 * Chakra v3's Input recipe sets `position: relative` on the control. Two positioned siblings with
 * `z-index: auto` paint in DOM order, so the input — which has an opaque `surface` background —
 * painted **over** this box and the prefix was invisible in the real app. It looked correct in every
 * DOM assertion and in a jsdom render, because neither paints anything.
 *
 * `z-index: 1` puts the prefix above the control whatever order the two are in.
 * `pointer-events: none` is what keeps the field clickable through it, and is why raising it is safe.
 *
 * ## It is drawn, never stored
 *
 * `aria-hidden`, and emphatically not part of the value or the placeholder. Putting `₹` in either
 * would mean the symbol is submitted with the form, has to be stripped before parsing, and is read
 * out as if the user had typed it.
 */
function InputPrefix({ children, ...rest }: BoxProps) {
  return (
    <Box
      aria-hidden="true"
      position="absolute"
      // Aligns with the control's own 14px inline padding, so prefix and value share a baseline grid.
      left="14px"
      top="0"
      bottom="0"
      zIndex="1"
      display="flex"
      alignItems="center"
      color="content.subtle"
      pointerEvents="none"
      {...rest}
    >
      {children}
    </Box>
  );
}

export type TextInputProps = InputProps & {
  /**
   * An optional glyph inside the field's leading edge.
   *
   * Drawn on the sign-in screen (`Login.html`) — `mail` on the email field, `lock` on the password
   * field. Decoration, not information: the label above already says what the field is, so the icon
   * is `aria-hidden` and adding one to a field whose label is its only explanation would be a
   * mistake rather than an improvement.
   */
  icon?: IconName;
};

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(function TextInput(
  { icon, ...rest },
  ref,
) {
  // The overwhelming majority of fields. Unwrapped, so nothing about them changed.
  if (!icon) return <Input ref={ref} {...CONTROL_STYLES} {...rest} />;

  /*
   * A positioned sibling, not a wrapper round the input: the input has to stay the element Chakra's
   * `Field.Root` wires the label, `aria-invalid` and `required` to.
   */
  return (
    <Box position="relative" width="full">
      <InputPrefix>
        <Icon name={icon} size="swatchLg" />
      </InputPrefix>

      <Input
        ref={ref}
        {...CONTROL_STYLES}
        // 40px as drawn: the 14px base inline padding, the 15px glyph, and an 11px gap.
        paddingInlineStart="40px"
        {...rest}
      />
    </Box>
  );
});

export type AmountInputProps = InputProps & {
  /**
   * Which symbol to show in the prefix. Defaults to the app's own currency.
   *
   * Multi-currency conversion is out of MVP scope, but every amount carries a currency
   * (`config/constants.ts`), so the prefix is derived rather than hard-coded to `₹`.
   */
  currency?: string;
};

/**
 * Amount input: numeric keypad on mobile, tabular mono figures while typing, currency prefix.
 *
 * The prefix is an `InputPrefix` — see the note there on why it needs a `z-index`, which is the bug
 * group 33 found: the symbol had been painting *behind* the input's own background.
 *
 * `textStyle="amount"` carries mono plus tabular figures, at the 19px the handoff draws — larger
 * than the other controls because the amount is the one number on the form that matters.
 */
export const AmountInput = forwardRef<HTMLInputElement, AmountInputProps>(function AmountInput(
  { currency = "INR", ...rest },
  ref,
) {
  const symbol = currencySymbol(currency);

  return (
    <Box position="relative" width="full">
      {/* The symbol sits on the prefix box itself, so it is the element carrying `aria-hidden`. */}
      <InputPrefix textStyle="amount" fontSize="figure">
        {symbol}
      </InputPrefix>

      <Input
        ref={ref}
        inputMode="decimal"
        {...CONTROL_STYLES}
        textStyle="amount"
        fontSize="figure"
        /*
         * Clears the prefix: the base inline padding, plus the symbol's own width, plus a
         * 6px gap. Derived from the 14px base rather than replacing it so the two cannot
         * drift apart, and from `symbol.length` so a two-character symbol still fits.
         *
         * The gap is not cosmetic. Without it the symbol and the first digit touch, and
         * "₹0.00" reads as one mono token rather than a prefix and a value — caught by
         * rendering the field rather than by any assertion.
         */
        paddingInlineStart={`calc(14px + ${symbol.length}ch + 6px)`}
        {...rest}
      />
    </Box>
  );
});

export type SelectInputProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  children: ReactNode;
};

/**
 * Native select, restyled.
 *
 * `DESIGN.md` is explicit that every dropdown-looking control is **a real native `<select>`**
 * skinned to look like a bordered box: only the visual chrome is custom. That is not a
 * simplification — the OS picker on iOS is faster one-handed, and it needs no keyboard or
 * screen-reader work of its own. Do not replace this with a custom listbox.
 *
 * The only substantive change is the indicator: Chakra's default chevron is swapped for the
 * registry's `chevron-down`, so the one arrow in the app that users see most often belongs to
 * the same icon set as everything else.
 */
export const SelectInput = forwardRef<HTMLSelectElement, SelectInputProps>(function SelectInput(
  { children, ...rest },
  ref,
) {
  return (
    <NativeSelect.Root>
      <NativeSelect.Field
        ref={ref}
        {...CONTROL_STYLES}
        /*
         * `height: auto` so the padding above decides the height.
         *
         * Chakra's native-select recipe sets a fixed height per `size`, which wins over the
         * padding and clips the selected option's descenders — "HDFC Savings" loses the bottom
         * of its g. That is invisible in a DOM assertion and obvious the moment the control is
         * rendered, which is how it was found.
         */
        height="auto"
        // Leaves room for the indicator. The native control draws its own arrow on some
        // platforms; Chakra's reset hides it, and this is the space our own occupies.
        paddingInlineEnd="36px"
        {...rest}
      >
        {children}
      </NativeSelect.Field>

      <NativeSelect.Indicator color="content.muted" insetEnd="14px">
        <Icon name="chevron-down" size="inline" />
      </NativeSelect.Indicator>
    </NativeSelect.Root>
  );
});

export const TextAreaInput = forwardRef<HTMLTextAreaElement, TextareaProps>(
  function TextAreaInput(props, ref) {
    return <Textarea ref={ref} {...CONTROL_STYLES} minH="20" resize="vertical" {...props} />;
  },
);
