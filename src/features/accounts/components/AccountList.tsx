import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Card, CardList } from "@/components/ui/Card";
import { RowLink } from "@/components/ui/AppLink";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountSwatch } from "./AccountSwatch";
import type { AccountView } from "../view-models/account-view-model";

const GROUP_ORDER = ["bank", "cash", "credit_card"] as const;

const GROUP_TITLES: Record<(typeof GROUP_ORDER)[number], string> = {
  bank: "Bank accounts",
  cash: "Cash",
  credit_card: "Credit cards",
};

/**
 * Accounts grouped by type.
 *
 * A card reads differently from a bank account - outstanding and available credit
 * rather than a balance - so the row adapts instead of forcing one shape onto both
 * (docs/02-DATA-MODEL.md section 21).
 */
export function AccountList({ accounts }: { accounts: readonly AccountView[] }) {
  return (
    <Stack gap="24px">
      {GROUP_ORDER.map((type) => {
        const group = accounts.filter((account) => account.type === type);
        if (group.length === 0) return null;

        const headingId = `account-group-${type}`;

        return (
          <Box as="section" key={type} aria-labelledby={headingId}>
            {/*
              The same eyebrow-above-a-card idiom the activity list uses for its day groups, for the
              same reason: the heading is a divider between cards, not a row inside one. Still an `h2`
              labelling a `section`, so a screen reader can move group by group.
            */}
            <Text
              id={headingId}
              as="h2"
              textStyle="eyebrow"
              letterSpacing="0.09em"
              color="content.subtle"
              mb="10px"
            >
              {GROUP_TITLES[type]}
            </Text>

            <Card>
              <CardList>
                {group.map((account) => (
                  <AccountRow key={account.id} account={account} />
                ))}
              </CardList>
            </Card>
          </Box>
        );
      })}
    </Stack>
  );
}

function AccountRow({ account }: { account: AccountView }) {
  const isCard = account.type === "credit_card";
  const isNegative = account.balance.amount.startsWith("-");

  return (
    <RowLink href={`/accounts/${account.id}`}>
      <HStack gap="12px" flex="1" minW="0" align="center">
        {/*
          The account's identity in one 32px square: teal for a bank, mint for cash, coral for a card
          — because a card is a liability rather than money held. Same mapping as the dashboard, from
          `features/accounts/icon-map.ts`.
        */}
        <AccountSwatch type={account.type} />

        {/*
          The badge stacks below the name on a phone, not beside it. `StatusBadge` cannot shrink, so
          sharing the row would crush the name — the bug group 35 found in the activity list.
        */}
        <Flex
          direction={{ base: "column", md: "row" }}
          align={{ base: "stretch", md: "center" }}
          gap={{ base: "6px", md: "10px" }}
          minW="0"
        >
          <Box minW="0">
            <Text fontSize="row" fontWeight="600" truncate>
              {account.name}
            </Text>
            {account.institutionName ? (
              <Text fontSize="meta" color="content.subtle" truncate mt="2px">
                {account.institutionName}
              </Text>
            ) : null}
          </Box>

          {account.isArchived ? (
            <HStack gap="8px" flexShrink="0">
              <StatusBadge kind="archived" />
            </HStack>
          ) : null}
        </Flex>
      </HStack>

      <Box flexShrink="0" textAlign="end">
        {isCard ? (
          <>
            <Text
              textStyle="amount"
              fontSize="row"
              fontWeight="600"
              // Coral once anything is owed, as the dashboard does: card debt is a liability on sight.
              color={hasOutstanding(account) ? "negative" : "content"}
            >
              {account.formattedOutstanding}
            </Text>
            <Text
              fontSize="subtitle"
              color={account.overLimit ? "negative" : "content.subtle"}
              fontWeight={account.overLimit ? "600" : "normal"}
            >
              {account.overLimit ? "Over limit · " : ""}
              {account.formattedAvailableCredit} available
            </Text>
          </>
        ) : (
          <>
            <Text
              textStyle="amount"
              fontSize="row"
              fontWeight="600"
              color={isNegative ? "negative" : "content"}
            >
              {account.formattedBalance}
            </Text>
            {/* The word, not just the figure, says what this number is. */}
            <Text fontSize="subtitle" color="content.subtle">
              balance
            </Text>
          </>
        )}
      </Box>
    </RowLink>
  );
}

/** Whether a card is actually carrying debt. `₹0.00 owed` is good news and reads in plain ink. */
function hasOutstanding(account: AccountView): boolean {
  const amount = account.outstanding?.amount;
  return amount !== undefined && Number(amount) > 0;
}
