import type { ReactNode } from "react";
import { Box, Stack, Text } from "@chakra-ui/react";
import { Card } from "@/components/ui/Card";

export type SummaryTileProps = {
  label: string;
  value: string;
  /** Secondary line, e.g. a comparison or a caveat. */
  hint?: ReactNode;
  /**
   * Financial meaning of the figure.
   *
   * Drives colour only. The label above the number always says what it is, so the
   * tile still reads correctly without colour
   * (docs/06-CODING-PRACTICES.md section 40).
   */
  tone?: "neutral" | "positive" | "negative" | "warning";
};

const VALUE_COLOR: Record<NonNullable<SummaryTileProps["tone"]>, string> = {
  neutral: "content",
  positive: "positive",
  negative: "negative",
  warning: "warning",
};

/** One figure on the dashboard. */
export function SummaryTile({ label, value, hint, tone = "neutral" }: SummaryTileProps) {
  return (
    <Card>
      <Box p="4">
        <Stack gap="1">
          <Text
            fontSize="xs"
            fontWeight="semibold"
            color="content.muted"
            textTransform="uppercase"
            letterSpacing="wide"
          >
            {label}
          </Text>
          <Text textStyle="amount" fontSize="xl" fontWeight="semibold" color={VALUE_COLOR[tone]}>
            {value}
          </Text>
          {hint ? (
            <Text fontSize="xs" color="content.muted">
              {hint}
            </Text>
          ) : null}
        </Stack>
      </Box>
    </Card>
  );
}
