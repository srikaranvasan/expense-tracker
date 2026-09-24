import { forwardRef } from "react";
import { Button as ChakraButton } from "@chakra-ui/react";
import type { ButtonProps as ChakraButtonProps } from "@chakra-ui/react";

/**
 * Project button.
 *
 * Wraps Chakra's Button for three reasons:
 *  - a minimum height that is a comfortable touch target
 *  - `type="button"` by default, so a button inside a form cannot submit it by accident
 *  - a `tone` vocabulary that describes intent rather than appearance
 *
 * `tone` exists so call sites say what the action means. "danger" is a statement about
 * consequence; "coral fill with an ink border" is a statement about pixels, and the mapping
 * between them belongs here rather than in every screen (docs/06-CODING-PRACTICES.md section 41).
 *
 * Restyled to "Ledger Geometry" in group 27 (section 7.1). The five tones are drawn in
 * `design/ux/screens/Style-Guide.html`; the values below are transcribed from it.
 */

export type ButtonTone = "primary" | "secondary" | "ghost" | "contrast" | "danger";

export type ButtonSize = "sm" | "md" | "lg";

/**
 * Chakra's `variant` and `colorPalette` recipes are bypassed entirely.
 *
 * They were the right approach when the tones mapped onto solid/outline/ghost with a colour
 * palette. This design's tones differ in fill, border weight, shadow **and** whether the label
 * is underlined, which no combination of Chakra's two axes expresses. Writing the styles out is
 * longer and says exactly what is drawn.
 */
const TONE_STYLES = {
  primary: {
    bg: "brand.solid",
    // Ink in both modes: the teal fill is bright enough that light text on it measures ~2:1.
    color: "brand.contrast",
    borderColor: "line",
    boxShadow: "hard",
    _hover: { bg: "brand.emphasized" },
  },
  secondary: {
    bg: "surface",
    color: "content",
    borderColor: "line",
    boxShadow: "none",
    _hover: { bg: "surface.muted" },
  },
  /**
   * Underlined text with a **transparent 2px border**.
   *
   * The border is not decoration: it keeps the ghost button the same height as the bordered
   * siblings it shares a row with, so a Cancel next to a Save does not sit 4px shorter. The
   * handoff draws it exactly this way.
   */
  ghost: {
    bg: "transparent",
    color: "content",
    borderColor: "transparent",
    boxShadow: "none",
    textDecoration: "underline",
    textUnderlineOffset: "4px",
    _hover: { bg: "surface.muted", textDecoration: "underline" },
  },
  /**
   * Solid ink with inverted text, and no shadow.
   *
   * The design's third fill, drawn on the Search button in `Activity-Light.html`. It exists for a
   * control that **commits something but is not the page's primary action**: the page's primary is
   * "Add expense", and making Search teal too would give one screen two competing primaries, while
   * making it `secondary` would leave the search row with no obvious commit.
   *
   * No offset shadow, as drawn — the shadow is what marks the *page's* primary action, and the ink
   * fill is already the heaviest thing in the row.
   */
  contrast: {
    bg: "content",
    // `paper` in light mode, `darkPaper` in dark: the page background, so the label reads as a hole
    // punched in the ink rather than as white text.
    color: "content.inverted",
    borderColor: "line",
    boxShadow: "none",
    _hover: { bg: "content" },
  },
  danger: {
    bg: "negative.surface",
    /*
     * `content.onSwatch`, not `content` — ink in *both* modes.
     *
     * The coral fill carries the warning and ink keeps the label readable (11.4:1, against
     * 3.4:1 for coral text on a coral fill). `content` says the same thing in light mode and
     * the opposite in dark, where it flips to `darkInk` and leaves near-white text on a bright
     * coral fill: measured **1.76:1** — the worst pair in the app until group 40 found it. The
     * fill does not flip, so the label must not either, which is exactly what `content.onSwatch`
     * means.
     */
    color: "content.onSwatch",
    borderColor: "line",
    boxShadow: "hard",
    _hover: { bg: "negative.surface" },
  },
} as const satisfies Record<ButtonTone, Record<string, unknown>>;

/** Padding and label size per size, as drawn. */
const SIZE_STYLES = {
  lg: { paddingInline: "26px", paddingBlock: "14px", fontSize: "control" },
  md: { paddingInline: "18px", paddingBlock: "12px", fontSize: "row" },
  sm: { paddingInline: "12px", paddingBlock: "8px", fontSize: "row" },
} as const satisfies Record<ButtonSize, Record<string, unknown>>;

/**
 * Applied to every tone, including `ghost`.
 *
 * The disabled treatment is one rule rather than four, because "disabled" is a state of the
 * control and not a variation on its meaning: a disabled danger button is not a *slightly*
 * dangerous button. Same three values the disabled form control uses
 * (`CONTROL_STYLES` in `Field.tsx`), so a disabled Save and a disabled input match.
 */
const DISABLED_STYLES = {
  bg: "surface.disabled",
  color: "content.quiet",
  borderColor: "content.quiet",
  boxShadow: "none",
  textDecoration: "none",
  cursor: "not-allowed",
} as const;

export type ButtonProps = Omit<ChakraButtonProps, "variant" | "colorPalette" | "size"> & {
  tone?: ButtonTone;
  size?: ButtonSize;
  /**
   * Expands the button to fill its container.
   *
   * Prefer `FormActions` for a submit/cancel row: a `fullWidth` submit beside a Cancel is
   * exactly what caused the clipped-Cancel bug (section 9.2), and `FormActions` makes that
   * arrangement impossible.
   */
  fullWidth?: boolean;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = "primary", fullWidth, size = "md", type = "button", ...rest },
  ref,
) {
  return (
    <ChakraButton
      ref={ref}
      type={type}
      minH="touch"
      fontFamily="heading"
      fontWeight="600"
      borderWidth="thick"
      borderStyle="solid"
      // Chakra's default focus ring is removed by the theme's own reset, so the replacement is
      // not optional. The teal offset shadow is the design's focus device (5.3), and it reads on
      // every tone: on primary and danger it replaces the ink shadow, which is a clear change of
      // state; on secondary and ghost it is a shadow appearing where there was none.
      //
      // Measuring this needs care. Chakra's recipe transitions `box-shadow` over 200ms, so reading
      // the computed shadow in the same task that moved focus returns a colour a few per cent along
      // the ink→teal fade — near enough to ink to look like the rule never applied. Group 40 chased
      // that phantom for a while. Poll until the value settles instead of reading once.
      outline="none"
      _focusVisible={{ boxShadow: "hardFocus" }}
      {...SIZE_STYLES[size]}
      {...TONE_STYLES[tone]}
      _disabled={DISABLED_STYLES}
      // Chakra renders `loading` as a disabled button with a spinner, so the disabled treatment
      // has to cover it too or a submitting form flashes a full-strength button.
      _loading={DISABLED_STYLES}
      {...(fullWidth ? { width: "full" } : {})}
      {...rest}
    />
  );
});

export type IconButtonProps = Omit<ButtonProps, "children" | "fullWidth"> & {
  /**
   * Required, not optional.
   *
   * An icon-only control with no accessible name is a button that a screen reader announces as
   * "button". Making this a required prop is the only way to stop that reaching a screen — the
   * alternative is a lint rule nobody writes.
   */
  "aria-label": string;
  children: React.ReactNode;
};

/**
 * A square button holding a single glyph.
 *
 * The header's sign-out and the colour-mode toggle are the two that exist today. Square rather
 * than sized by its label: the glyph is centred in a `sizes.touch` box, which is both the design
 * (7.1: "a plain square with the glyph centred") and the minimum touch target.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { tone = "secondary", size = "md", ...rest },
  ref,
) {
  return (
    <Button
      ref={ref}
      tone={tone}
      size={size}
      // Overrides the size map's inline padding: a square has no label to pad around.
      paddingInline="0"
      paddingBlock="0"
      minW="touch"
      {...rest}
    />
  );
});
