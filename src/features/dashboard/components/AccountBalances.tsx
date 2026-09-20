import { Badge, Box, HStack, Text } from "@chakra-ui/react";
import { AppLink, RowLink } from "@/components/ui/AppLink";
import { Card, CardBody, CardHeader, CardList } from "@/components/ui/Card";
import type { AccountView } from "@/features/accounts/view-models/account-view-model";

export type AccountBalancesProps = {
  accounts: readonly AccountView[];
};

/**
 * Every active account with its current position.
 *
 * A credit card shows what is **owed** and how much credit is left, not a signed
 * balance. "-₹15,000" is a correct signed value but the wrong thing to lead with:
 * the question about a card is "how much do I owe and how much can I still spend".
 */
export function AccountBalances({ accounts }: AccountBalancesProps) {
  return (
    <Card>
      <CardHeader
        title="Accounts"
        subtitle="Calculated from your transactions"
        action={
          <AppLink href="/accounts" fontSize="xs" flexShrink="0">
            Manage
          </AppLink>
        }
      />

      {accounts.length === 0 ? (
        <CardBody>
          <Text fontSize="sm" color="content.muted">
            No accounts yet.{" "}
            <AppLink href="/accounts/new" fontSize="sm">
              Add your first account
            </AppLink>
            .
          </Text>
        </CardBody>
      ) : (
        <CardList>
          {accounts.map((account) => {
            const isCard = account.type === "credit_card";

            return (
              <RowLink key={account.id} href={`/accounts/${account.id}`}>
                <Box minW="0">
                  <HStack gap="2" minW="0">
                    <Text fontSize="sm" fontWeight="medium" truncate>
                      {account.name}
                    </Text>
                    {account.overLimit ? (
                      <Badge variant="subtle" bg="negative.surface" color="negative" flexShrink="0">
                        Over limit
                      </Badge>
                    ) : null}
                  </HStack>
                  <Text fontSize="xs" color="content.muted" truncate>
                    {isCard && account.formattedAvailableCredit
                      ? `${account.typeLabel} · ${account.formattedAvailableCredit} available`
                      : account.typeLabel}
                  </Text>
                </Box>

                <Box flexShrink="0" textAlign="end">
                  <Text
                    textStyle="amount"
                    fontSize="sm"
                    fontWeight="semibold"
                    color={amountColor(account)}
                  >
                    {isCard ? account.formattedOutstanding : account.formattedBalance}
                  </Text>
                  {/* The word, not just the sign, says which direction this is. */}
                  <Text fontSize="xs" color="content.muted">
                    {isCard ? "owed" : "balance"}
                  </Text>
                </Box>
              </RowLink>
            );
          })}
        </CardList>
      )}
    </Card>
  );
}

function amountColor(account: AccountView): string {
  if (account.type === "credit_card") {
    // Nothing owed is good news; anything owed is just a fact, not an error.
    return account.overLimit ? "negative" : "content";
  }
  return account.balance.amount.startsWith("-") ? "negative" : "content";
}
