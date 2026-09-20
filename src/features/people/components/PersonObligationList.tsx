import { Badge, Box, Flex, Stack, Text } from "@chakra-ui/react";
import { AppLink } from "@/components/ui/AppLink";
import type { ObligationView } from "../view-models/person-view-model";

const STATUS_TONE: Record<ObligationView["status"], { bg: string; color: string }> = {
  unsettled: { bg: "warning.surface", color: "warning" },
  partially_settled: { bg: "brand.muted", color: "brand.fg" },
  settled: { bg: "positive.surface", color: "positive" },
};

/**
 * The shared expenses that make up a person's balance.
 *
 * Each row shows the original share and what is still outstanding, so a balance
 * can always be traced back to the expenses behind it
 * (docs/03-DATA-FLOW.md section 28).
 */
export function PersonObligationList({ obligations }: { obligations: readonly ObligationView[] }) {
  return (
    <Stack
      as="ul"
      gap="0"
      listStyleType="none"
      separator={<Box borderTopWidth="1px" borderColor="line" />}
    >
      {obligations.map((obligation) => {
        const tone = STATUS_TONE[obligation.status];

        return (
          <Flex as="li" key={obligation.expenseSplitId} justify="space-between" gap="4" py="3">
            <Box minW="0">
              <AppLink
                href={`/transactions/${obligation.transactionId}`}
                fontSize="sm"
                fontWeight="medium"
                color="content"
                textDecoration="none"
                truncate
                display="block"
              >
                {obligation.description}
              </AppLink>
              <Text mt="0.5" fontSize="xs" color="content.muted">
                {obligation.dateLabel} · {obligation.directionLabel}
              </Text>
            </Box>

            <Box flexShrink="0" textAlign="end">
              <Text textStyle="amount" fontSize="sm" fontWeight="semibold">
                {obligation.formattedRemaining}
              </Text>
              {obligation.status === "partially_settled" ? (
                <Text textStyle="amount" fontSize="xs" color="content.muted">
                  of {obligation.formattedOriginal}
                </Text>
              ) : null}
              <Badge mt="1" variant="subtle" bg={tone.bg} color={tone.color} fontWeight="medium">
                {obligation.statusLabel}
              </Badge>
            </Box>
          </Flex>
        );
      })}
    </Stack>
  );
}
