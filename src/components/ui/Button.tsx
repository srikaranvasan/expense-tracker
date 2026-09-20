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
 * `tone` exists so call sites say what the action means. "danger" is a statement
 * about consequence; "solid red" is a statement about pixels, and the mapping
 * between them belongs here rather than in every screen
 * (docs/06-CODING-PRACTICES.md section 41).
 */

export type ButtonTone = "primary" | "secondary" | "ghost" | "danger";

type ToneStyle = Pick<ChakraButtonProps, "variant" | "colorPalette">;

const TONES: Record<ButtonTone, ToneStyle> = {
  primary: { variant: "solid", colorPalette: "brand" },
  secondary: { variant: "outline", colorPalette: "gray" },
  ghost: { variant: "ghost", colorPalette: "gray" },
  danger: { variant: "solid", colorPalette: "red" },
};

export type ButtonProps = Omit<ChakraButtonProps, "variant" | "colorPalette"> & {
  tone?: ButtonTone;
  /** Convenience alias; expands the button to fill its container. */
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
      size={size}
      minH="touch"
      fontWeight="medium"
      {...TONES[tone]}
      {...(fullWidth ? { width: "full" } : {})}
      {...rest}
    />
  );
});
