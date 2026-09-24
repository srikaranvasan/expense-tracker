import { Box, HStack, Text } from "@chakra-ui/react";
import { AppLink, CardActionLink, RowLink } from "@/components/ui/AppLink";
import { Card, CardBody, CardHeader, CardList } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountSwatch } from "@/features/accounts/components/AccountSwatch";
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
        action={<CardActionLink href="/accounts">Manage</CardActionLink>}
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
                <HStack gap="12px" minW="0">
                  {/*
                    Type, colour and glyph in one 32px square: teal for a bank, mint for cash, coral
                    for a card — because a card is a liability rather than money held. The mapping is
                    total over `AccountType`, so it needs no fallback.
                  */}
                  <AccountSwatch type={account.type} />

                  <Box minW="0">
                    <HStack gap="2" minW="0">
                      <Text fontSize="row" fontWeight="600" truncate>
                        {account.name}
                      </Text>
                      {account.overLimit ? <StatusBadge kind="overLimit" /> : null}
                    </HStack>
                    <Text fontSize="meta" color="content.subtle" truncate>
                      {isCard && account.formattedAvailableCredit
                        ? `${account.typeLabel} · ${account.formattedAvailableCredit} available`
                        : account.typeLabel}
                    </Text>
                  </Box>
                </HStack>

                <Box flexShrink="0" textAlign="end">
                  <Text
                    textStyle="amount"
                    fontSize="row"
                    fontWeight="600"
                    color={amountColor(account)}
                  >
                    {isCard ? account.formattedOutstanding : account.formattedBalance}
                  </Text>
                  {/* The word, not just the sign, says which direction this is. */}
                  <Text fontSize="subtitle" color="content.subtle">
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

/**
 * Which colour the row's figure takes.
 *
 * `Dashboard-Light.html` draws a card's outstanding balance in coral whatever the limit, and the
 * matching tile carries a coral top edge unconditionally — the design treats card debt as a liability
 * on sight, not as an error state. This follows the drawing, with one condition the artboard has no
 * example of: **nothing owed is not a liability**, so a card at zero reads in plain ink rather than
 * colouring "₹0.00" as bad news.
 *
 * Over-limit is carried by the `overLimit` badge beside the name, in words. Colour is never the only
 * signal (9.1), which is also why the caption below the figure says "owed" or "balance".
 */
function amountColor(account: AccountView): string {
  if (account.type === "credit_card") {
    return hasOutstanding(account) ? "negative" : "content";
  }
  // An asset account can only go negative through an overdraft, and that is worth flagging.
  return account.balance.amount.startsWith("-") ? "negative" : "content";
}

function hasOutstanding(account: AccountView): boolean {
  const amount = account.outstanding?.amount;
  return amount !== undefined && Number(amount) > 0;
}
