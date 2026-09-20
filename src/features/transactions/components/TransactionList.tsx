import { Badge, Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { RowLink } from "@/components/ui/AppLink";
import { Card } from "@/components/ui/Card";
import { formatAccountDirection } from "../view-models/direction";
import type { TransactionDayGroup, TransactionListItem } from "../view-models/expense-view-model";

/**
 * The account context for one row.
 *
 * A transfer or card payment has two accounts and no category, so it reads as a
 * direction rather than a list: "HDFC Savings → Cash". Everything else has at most
 * one account.
 */
function accountMeta(item: TransactionListItem, accountNames: Record<string, string>): string[] {
  if (item.fromAccountId || item.toAccountId) {
    return [
      formatAccountDirection(
        item.fromAccountId ? (accountNames[item.fromAccountId] ?? null) : null,
        item.toAccountId ? (accountNames[item.toAccountId] ?? null) : null,
      ),
    ];
  }

  const name = item.accountId ? accountNames[item.accountId] : undefined;
  return name ? [name] : [];
}

const SETTLEMENT_STYLES = {
  settled: { bg: "positive.surface", color: "positive" },
  partially_settled: { bg: "warning.surface", color: "warning" },
} as const;

/**
 * Settlement state of a shared expense.
 *
 * Only rendered when there is something to settle, and only for the two states worth
 * calling out. Every shared expense starts unsettled, so a badge saying so on every
 * row would be noise that makes the two interesting states harder to spot. The label
 * is a word, never colour alone (docs/06-CODING-PRACTICES.md section 40).
 */
function SettlementBadge({ item }: { item: TransactionListItem }) {
  if (item.settlementStatus !== "settled" && item.settlementStatus !== "partially_settled") {
    return null;
  }

  const style = SETTLEMENT_STYLES[item.settlementStatus];

  return (
    <Badge variant="subtle" bg={style.bg} color={style.color} flexShrink="0">
      {item.settlementLabel}
    </Badge>
  );
}

export type TransactionListProps = {
  groups: readonly TransactionDayGroup[];
  accountNames: Record<string, string>;
  categoryNames: Record<string, string>;
  personNames: Record<string, string>;
};

/**
 * Transactions grouped by day.
 *
 * A shared expense shows the user's own share as the headline figure and the full
 * amount underneath, because "what did this cost me" is the question a spending list
 * answers (docs/03-DATA-FLOW.md section 7).
 */
export function TransactionList({
  groups,
  accountNames,
  categoryNames,
  personNames,
}: TransactionListProps) {
  return (
    <Stack gap="5">
      {groups.map((group) => (
        <Box as="section" key={group.dayKey} aria-labelledby={`day-${group.dayKey}`}>
          <Text
            id={`day-${group.dayKey}`}
            as="h2"
            mb="2"
            fontSize="xs"
            fontWeight="semibold"
            textTransform="uppercase"
            letterSpacing="wide"
            color="content.muted"
          >
            {group.dayLabel}
          </Text>

          <Card>
            <Stack gap="0" separator={<Box borderTopWidth="1px" borderColor="line" />}>
              {group.items.map((item) => {
                const meta = [
                  ...accountMeta(item, accountNames),
                  item.categoryId ? categoryNames[item.categoryId] : null,
                ].filter(Boolean);

                const payer = item.paidByPersonId
                  ? (personNames[item.paidByPersonId] ?? "Someone else")
                  : null;

                return (
                  <RowLink key={item.id} href={`/transactions/${item.id}`}>
                    <Box minW="0">
                      <HStack gap="2" minW="0">
                        <Text fontSize="sm" fontWeight="medium" truncate>
                          {item.description}
                        </Text>
                        {item.isShared ? (
                          <Badge variant="subtle" bg="brand.muted" color="brand.fg" flexShrink="0">
                            Split
                          </Badge>
                        ) : null}
                        {item.type !== "expense" ? (
                          <Badge
                            variant="subtle"
                            bg="surface.sunken"
                            color="content.muted"
                            flexShrink="0"
                          >
                            {item.typeLabel}
                          </Badge>
                        ) : null}
                        <SettlementBadge item={item} />
                      </HStack>

                      <Text fontSize="xs" color="content.muted" truncate>
                        {payer ? `${payer} paid` : meta.join(" · ") || item.typeLabel}
                        {payer && meta.length > 0 ? ` · ${meta.join(" · ")}` : ""}
                      </Text>
                    </Box>

                    <Box flexShrink="0" textAlign="end">
                      <Text textStyle="amount" fontSize="sm" fontWeight="semibold">
                        {item.type === "expense" ? item.formattedUserShare : item.formattedAmount}
                      </Text>
                      {item.isSplit ? (
                        <Text textStyle="amount" fontSize="xs" color="content.muted">
                          of {item.formattedAmount}
                        </Text>
                      ) : null}
                    </Box>
                  </RowLink>
                );
              })}
            </Stack>
          </Card>
        </Box>
      ))}
    </Stack>
  );
}

/** Simple flat variant for embedding a short recent-activity list. */
export function RecentTransactionList({
  groups,
  accountNames,
  categoryNames,
  personNames,
}: TransactionListProps) {
  const items = groups.flatMap((group) => group.items);

  return (
    <Stack gap="0" separator={<Box borderTopWidth="1px" borderColor="line" />}>
      {items.map((item) => (
        <Flex key={item.id} align="center" justify="space-between" gap="4" py="3">
          <Box minW="0">
            <Text fontSize="sm" fontWeight="medium" truncate>
              {item.description}
            </Text>
            <Text fontSize="xs" color="content.muted" truncate>
              {item.dayLabel}
              {accountMeta(item, accountNames)
                .map((entry) => ` · ${entry}`)
                .join("")}
              {item.categoryId && categoryNames[item.categoryId]
                ? ` · ${categoryNames[item.categoryId]}`
                : ""}
              {item.paidByPersonId
                ? ` · ${personNames[item.paidByPersonId] ?? "Someone else"} paid`
                : ""}
            </Text>
          </Box>

          <Text textStyle="amount" fontSize="sm" fontWeight="semibold" flexShrink="0">
            {item.type === "expense" ? item.formattedUserShare : item.formattedAmount}
          </Text>
        </Flex>
      ))}
    </Stack>
  );
}
