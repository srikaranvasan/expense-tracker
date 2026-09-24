import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { CardActionLink } from "@/components/ui/AppLink";
import { Card, CardBody, CardHeader, CardList } from "@/components/ui/Card";
import { CategorySwatch } from "@/features/categories/components/CategorySwatch";
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
        action={<CardActionLink href="/transactions">View all</CardActionLink>}
      />

      {/*
        The headline figure sits in its own block above the breakdown, with a rule between them — as
        drawn. The month's total and the categories that make it up are two different readings, and a
        26px figure in the same list as 14.5px rows would look like a row.
      */}
      <CardBody>
        <Text textStyle="amount" fontSize={{ base: "figureLg", md: "26px" }} fontWeight="600">
          {spending.total.formatted}
        </Text>
        <Text fontSize="meta" color="content.subtle" mt="2px">
          {comparisonSentence(spending)}
        </Text>
      </CardBody>

      {spending.topCategories.length > 0 ? (
        <CardList>
          {spending.topCategories.map((category) => (
            <Flex
              key={category.categoryId ?? "uncategorised"}
              align="center"
              justify="space-between"
              gap="4"
              paddingInline={{ base: "16px", md: "24px" }}
              paddingBlock={{ base: "13px", md: "16px" }}
            >
              <HStack gap="12px" minW="0">
                {/*
                  A category's colour is derived from its **id** and its glyph from `Category.icon`,
                  both by one resolver — so the swatch here is the same one the category shows in the
                  activity list, the picker and the categories screen. `sm` is the 20px the handoff
                  draws in this breakdown, smaller than an account's 32px because a category is a
                  label on a row rather than the row's subject.
                */}
                <CategorySwatch
                  categoryId={category.categoryId ?? category.name}
                  icon={category.icon}
                  size="sm"
                />
                <Box minW="0">
                  <Text fontSize="row" fontWeight="600" truncate>
                    {category.name}
                  </Text>
                  <Text fontSize="meta" color="content.subtle">
                    {category.transactionCount}{" "}
                    {category.transactionCount === 1 ? "expense" : "expenses"}
                  </Text>
                </Box>
              </HStack>

              <Text textStyle="amount" fontSize="row" fontWeight="600" flexShrink="0">
                {category.total.formatted}
              </Text>
            </Flex>
          ))}
        </CardList>
      ) : (
        <CardBody>
          <Text fontSize="row" color="content.subtle">
            No expenses recorded this month yet.
          </Text>
        </CardBody>
      )}
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
