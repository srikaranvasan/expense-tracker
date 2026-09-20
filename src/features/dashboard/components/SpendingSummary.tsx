import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { AppLink } from "@/components/ui/AppLink";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import type { DashboardSpending } from "../view-models/dashboard-view-model";

export type SpendingSummaryProps = {
  spending: DashboardSpending;
};

/**
 * This month's spending, with a plain-language comparison to last month.
 *
 * The comparison is a sentence, not an arrow and a percentage. "₹1,200 more than last
 * month" cannot be misread; a red ▲ 14% can.
 *
 * "Spending" here means the user's own share of every expense, and excludes transfers
 * and card payments entirely (docs/09-DATABASE-SCHEMA.md section 36). The caption says
 * so, because a user who has just moved ₹50,000 between accounts will otherwise wonder
 * why this number did not move.
 */
export function SpendingSummary({ spending }: SpendingSummaryProps) {
  return (
    <Card>
      <CardHeader
        title={`Spending in ${spending.monthLabel}`}
        subtitle="Your own share. Transfers and card payments are not included."
        action={
          <AppLink href="/transactions" fontSize="xs" flexShrink="0">
            View all
          </AppLink>
        }
      />
      <CardBody>
        <Stack gap="3">
          <Box>
            <Text textStyle="amount" fontSize="2xl" fontWeight="semibold">
              {spending.total.formatted}
            </Text>
            <Text fontSize="xs" color="content.muted">
              {comparisonSentence(spending)}
            </Text>
          </Box>

          {spending.topCategories.length > 0 ? (
            <Stack gap="0" separator={<Box borderTopWidth="1px" borderColor="line" />}>
              {spending.topCategories.map((category) => (
                <Flex
                  key={category.categoryId ?? "uncategorised"}
                  align="center"
                  justify="space-between"
                  gap="4"
                  py="2"
                >
                  <Box minW="0">
                    <Text fontSize="sm" truncate>
                      {category.name}
                    </Text>
                    <Text fontSize="xs" color="content.muted">
                      {category.transactionCount}{" "}
                      {category.transactionCount === 1 ? "expense" : "expenses"}
                    </Text>
                  </Box>
                  <Text textStyle="amount" fontSize="sm" fontWeight="medium" flexShrink="0">
                    {category.total.formatted}
                  </Text>
                </Flex>
              ))}
            </Stack>
          ) : (
            <Text fontSize="sm" color="content.muted">
              No expenses recorded this month yet.
            </Text>
          )}
        </Stack>
      </CardBody>
    </Card>
  );
}

function comparisonSentence(spending: DashboardSpending): string {
  switch (spending.comparison) {
    case "more":
      return `${spending.difference.formatted} more than last month`;
    case "less":
      return `${spending.difference.formatted} less than last month`;
    case "same":
      return "The same as last month";
    default:
      return "No spending recorded last month to compare with";
  }
}
