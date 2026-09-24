import { Flex, Text } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import type { PersonBalanceDirection } from "@/types/common";
import { DirectionAmount } from "./Amount";

export type BalanceBadgeProps = {
  direction: PersonBalanceDirection;
  formattedAmount: string;
  /** The direction in words: "owes you", "you owe". */
  label: string;
  size?: "sm" | "md";
};

/**
 * What one person's balance is, and which way it points.
 *
 * Rebuilt on `DirectionAmount` in group 29. Its whole job now is translating the domain's
 * three-state `PersonBalanceDirection` into the two-state presentational direction, plus handling
 * the third state that has no amount at all.
 *
 * That translation is the reason this component still exists rather than screens using
 * `DirectionAmount` directly: `settled` is not a direction, and a component that accepted it would
 * have to invent an arrow and a colour for it.
 */
export function BalanceBadge({
  direction,
  formattedAmount,
  label,
  size = "md",
}: BalanceBadgeProps) {
  if (direction === "settled") {
    /*
     * A settled balance shows **no figure**.
     *
     * "₹0.00" invites the question "zero of what, and owed by whom?" — and a zero rendered in a
     * direction colour would be actively misleading. "Settled up" is the fact, and the check glyph
     * repeats it. The amount is deliberately dropped rather than shown as zero.
     */
    return (
      <Flex
        as="span"
        display="inline-flex"
        align="center"
        gap="5px"
        bg="positive.surface"
        color="content.onSwatch"
        borderWidth="thin"
        borderStyle="solid"
        borderColor="line"
        paddingInline="8px"
        paddingBlock="3px"
        flexShrink="0"
        whiteSpace="nowrap"
      >
        <Icon name="check" size="11px" />
        <Text as="span" textStyle="badge">
          Settled up
        </Text>
      </Flex>
    );
  }

  return (
    <DirectionAmount
      direction={direction === "person_owes_user" ? "in" : "out"}
      formattedAmount={formattedAmount}
      label={label}
      size={size}
    />
  );
}
