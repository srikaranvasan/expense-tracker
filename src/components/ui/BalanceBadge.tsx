import { Badge, Stack, Text } from "@chakra-ui/react";
import type { PersonBalanceDirection } from "@/types/common";

export type BalanceBadgeProps = {
  direction: PersonBalanceDirection;
  formattedAmount: string;
  label: string;
  size?: "sm" | "md";
};

/**
 * A balance shown together with its direction.
 *
 * Colour never carries the meaning on its own: the direction is always stated in
 * words as well, so the badge still reads correctly for colour-blind users and
 * screen readers (docs/06-CODING-PRACTICES.md section 40).
 */
export function BalanceBadge({
  direction,
  formattedAmount,
  label,
  size = "md",
}: BalanceBadgeProps) {
  if (direction === "settled") {
    return (
      <Badge variant="subtle" bg="surface.sunken" color="content.muted" fontWeight="medium">
        Settled up
      </Badge>
    );
  }

  const owesUser = direction === "person_owes_user";

  return (
    <Stack gap="0" align="flex-end">
      <Text
        textStyle="amount"
        fontWeight="semibold"
        fontSize={size === "sm" ? "sm" : "md"}
        color={owesUser ? "positive" : "negative"}
      >
        {formattedAmount}
      </Text>
      <Text fontSize="xs" color="content.muted">
        {label}
      </Text>
    </Stack>
  );
}
