import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { AppLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { ObligationView } from "../view-models/person-view-model";

/**
 * The shared expenses that make up a person's balance.
 *
 * Each row shows the original share and what is still outstanding, so a balance
 * can always be traced back to the expenses behind it
 * (docs/03-DATA-FLOW.md section 28).
 *
 * Restyled in group 38. The status chip is now a `StatusBadge`, so a part-settled expense looks the
 * same here as it does in the activity list — and `unsettled` renders **no badge**, following the same
 * "do not badge the default" rule: every obligation in the unsettled card is unsettled, and saying so
 * on each row is a column of identical chips.
 */
export function PersonObligationList({ obligations }: { obligations: readonly ObligationView[] }) {
  return (
    <Stack as="ul" gap="0" listStyleType="none">
      {obligations.map((obligation) => (
        <Flex
          as="li"
          key={obligation.expenseSplitId}
          justify="space-between"
          gap="4"
          py="13px"
          borderTopWidth="hairline"
          borderColor="line.soft"
          _first={{ borderTopWidth: "0", pt: "0" }}
        >
          <Box minW="0">
            <AppLink
              href={`/transactions/${obligation.transactionId}`}
              fontSize="row"
              fontWeight="600"
              color="content"
              textDecoration="none"
              truncate
              display="block"
            >
              {obligation.description}
            </AppLink>
            {/* Direction in words on every row, beside the date. */}
            <Text mt="2px" fontSize="meta" color="content.subtle">
              {obligation.dateLabel} · {obligation.directionLabel}
            </Text>
          </Box>

          <Box flexShrink="0" textAlign="end">
            <Text textStyle="amount" fontSize="row" fontWeight="600">
              {obligation.formattedRemaining}
            </Text>
            {/*
              The share-of-total treatment again (9.1): what is left, over what it started as. Only
              when they differ — a fully unsettled share would repeat itself.
            */}
            {obligation.status === "partially_settled" ? (
              <Text textStyle="amount" fontSize="eyebrow" color="content.subtle">
                of {obligation.formattedOriginal}
              </Text>
            ) : null}
            {obligation.status !== "unsettled" ? (
              <Box mt="6px">
                <StatusBadge
                  kind={obligation.status === "settled" ? "settled" : "partSettled"}
                  label={obligation.statusLabel}
                />
              </Box>
            ) : null}
          </Box>
        </Flex>
      ))}
    </Stack>
  );
}
