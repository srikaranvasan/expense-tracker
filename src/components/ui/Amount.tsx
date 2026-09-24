import type { ReactNode } from "react";
import { Flex, Stack, Text } from "@chakra-ui/react";
import type { TextProps } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";

/**
 * Money on the page.
 *
 * These two components carry more product rules than anything else in the design system, which is
 * why they are components rather than a convention. Section 7.4, and section 9.1 for the rules.
 */

export type AmountTone = "neutral" | "positive" | "negative";

const TONE_COLORS: Record<AmountTone, string> = {
  neutral: "content",
  positive: "positive",
  negative: "negative",
};

export type AmountProps = Omit<TextProps, "children"> & {
  /**
   * Pre-formatted. Formatting belongs to `lib/money`, which knows the currency and the scale;
   * this component only knows how a number should look.
   */
  children: ReactNode;
  tone?: AmountTone;
};

/**
 * A monetary figure, in mono with tabular figures.
 *
 * `textStyle="amount"` carries the family and `font-variant-numeric: tabular-nums`, which is what
 * makes a column of amounts align on the decimal point — the thing that makes a transaction list
 * scannable (docs/06-CODING-PRACTICES.md section 41).
 *
 * `tone` colours the figure and nothing else. For an **interpersonal balance** — money between the
 * user and another person — use `DirectionAmount` instead: a bare signed or coloured number is
 * exactly what section 9.1 forbids, because it leaves "who owes whom" to the colour.
 */
export function Amount({ children, tone = "neutral", ...rest }: AmountProps) {
  return (
    <Text
      as="span"
      textStyle="amount"
      fontWeight="600"
      color={TONE_COLORS[tone]}
      // Never wraps mid-figure. "₹1,600.\n00" is not a number anyone can read.
      whiteSpace="nowrap"
      {...rest}
    >
      {children}
    </Text>
  );
}

/** Money coming toward the user, or money going away from them. */
export type AmountDirection = "in" | "out";

export type DirectionAmountProps = {
  direction: AmountDirection;
  /** Pre-formatted, and always unsigned — the direction is what carries the sign. */
  formattedAmount: string;
  /**
   * The direction **in words**: "owes you", "you owe", "Ravi owes you".
   *
   * Required, and there is no default. Section 9.1: direction is always spelled out, and a
   * component that could omit the words would eventually be used without them.
   */
  label: string;
  size?: "sm" | "md";
  /** Right-aligned in a list row, left-aligned in a detail block. */
  align?: "start" | "end";
};

const DIRECTION_STYLES = {
  in: { icon: "arrow-in", tone: "positive" },
  out: { icon: "arrow-out", tone: "negative" },
} as const;

/**
 * An interpersonal amount, with its direction stated three ways at once.
 *
 * ```text
 * ↗ ₹1,600.00      the arrow      a glyph
 *   (mint text)    the colour     a hue
 *   owes you       the words      text
 * ```
 *
 * All three, always. `DESIGN.md` is explicit that the arrow and the colour are **additions to** the
 * words and never substitutes for them, and the reason is plain: a colour-blind user loses the hue,
 * a screen-reader user loses both the hue and the glyph, and what is left has to still say who owes
 * whom. The words are the only signal that survives every case, so they are the required prop.
 *
 * This is also why there is no `direction="settled"`. A settled balance has no direction and no
 * amount worth showing; `BalanceBadge` renders that case as a plain "Settled up".
 */
export function DirectionAmount({
  direction,
  formattedAmount,
  label,
  size = "md",
  align = "end",
}: DirectionAmountProps) {
  const style = DIRECTION_STYLES[direction];

  return (
    <Stack gap="0" align={align === "end" ? "flex-end" : "flex-start"}>
      <Flex align="center" gap="4px" color={TONE_COLORS[style.tone]}>
        {/*
          Decorative: `aria-hidden` because the words below already say the direction, and a screen
          reader announcing "image, arrow, owes you" is worse than "₹1,600.00 owes you".
        */}
        <Icon name={style.icon} size="12px" />
        <Amount tone={style.tone} fontSize={size === "sm" ? "subtitle" : "row"}>
          {formattedAmount}
        </Amount>
      </Flex>

      <Text fontSize={size === "sm" ? "badge" : "eyebrow"} color="content.subtle">
        {label}
      </Text>
    </Stack>
  );
}
