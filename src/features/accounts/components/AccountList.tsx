import { Badge, Box, Stack, Text } from "@chakra-ui/react";
import { Card, CardList } from "@/components/ui/Card";
import { RowLink } from "@/components/ui/AppLink";
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
    <Stack gap="5">
      {GROUP_ORDER.map((type) => {
        const group = accounts.filter((account) => account.type === type);
        if (group.length === 0) return null;

        const headingId = `account-group-${type}`;

        return (
          <Box as="section" key={type} aria-labelledby={headingId}>
            <Text
              id={headingId}
              as="h2"
              mb="2"
              fontSize="xs"
              fontWeight="semibold"
              textTransform="uppercase"
              letterSpacing="wide"
              color="content.muted"
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
      <Box minW="0">
        <Text fontSize="sm" fontWeight="medium" truncate>
          {account.name}
          {account.isArchived ? (
            <Badge ml="2" variant="subtle" bg="surface.sunken" color="content.muted">
              Archived
            </Badge>
          ) : null}
        </Text>
        {account.institutionName ? (
          <Text fontSize="xs" color="content.muted" truncate>
            {account.institutionName}
          </Text>
        ) : null}
      </Box>

      <Box flexShrink="0" textAlign="end">
        {isCard ? (
          <>
            <Text textStyle="amount" fontSize="sm" fontWeight="semibold">
              {account.formattedOutstanding}
            </Text>
            <Text
              fontSize="xs"
              color={account.overLimit ? "negative" : "content.muted"}
              fontWeight={account.overLimit ? "medium" : "normal"}
            >
              {account.overLimit ? "Over limit · " : ""}
              {account.formattedAvailableCredit} available
            </Text>
          </>
        ) : (
          <Text
            textStyle="amount"
            fontSize="sm"
            fontWeight="semibold"
            color={isNegative ? "negative" : "content"}
          >
            {account.formattedBalance}
          </Text>
        )}
      </Box>
    </RowLink>
  );
}
