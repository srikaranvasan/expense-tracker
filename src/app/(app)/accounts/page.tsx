import type { Metadata } from "next";
import { Box, SimpleGrid } from "@chakra-ui/react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink, CardActionLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { SummaryTile } from "@/components/ui/Card";
import { calculateAccountTotals } from "@/domain/accounts/calculations";
import { AccountList } from "@/features/accounts/components/AccountList";
import { getAccountListView } from "@/features/accounts/queries/account-queries";
import { formatMoney } from "@/lib/money";
import { requireUser } from "@/server/auth/session";
import { loadAccountMovements } from "@/server/services/accounts/account-balances";
import { listAccounts } from "@/server/services/accounts/account-service";

export const metadata: Metadata = { title: "Accounts" };

export default async function AccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string }>;
}) {
  const user = await requireUser();
  const { archived } = await searchParams;
  const includeArchived = archived === "true";

  const accounts = await getAccountListView(user.id, { includeArchived });

  // Totals cover every account, archived included: an archived account still holds
  // money and still owes money.
  const allAccounts = await listAccounts(user.id, { includeArchived: true });
  const movements = await loadAccountMovements(user.id);
  const totals = calculateAccountTotals(allAccounts, movements, user.currency);

  return (
    <Box as="section">
      <PageHeader
        title="Accounts"
        description="Bank, cash and credit-card accounts."
        action={
          <AppLink href="/accounts/new" textDecoration="none">
            <Button>Add account</Button>
          </AppLink>
        }
      />

      {/*
        Summary tiles, not a detail list.

        This screen is not drawn (section 10), so it borrows the dashboard's device: the same four
        figures appear there, and a user moving between the two screens should recognise them. The
        `edge` colours are semantic — teal for money held, coral for a liability, mint for headroom,
        sky for a neutral computed figure — and the same four the dashboard uses.

        Totals cover archived accounts too: an archived account still holds money and still owes it.
      */}
      {allAccounts.length > 0 ? (
        <SimpleGrid columns={{ base: 2, md: 4 }} gap="3" mb="24px">
          <SummaryTile
            label="Bank + cash"
            value={formatMoney(totals.liquidBalance)}
            hint="Across all accounts"
            edge="brand"
            icon="accounts"
          />
          <SummaryTile
            label="Card outstanding"
            value={formatMoney(totals.creditCardOutstanding)}
            hint="Total owed"
            edge="negative"
            icon="card"
          />
          {/*
            The hint changes sign with the figure. Available credit goes negative when a card is over
            its limit, and "Still usable" beside "-₹10,097.00" is a sentence that contradicts its own
            number. The figure is correct either way; only the caption has to keep up.
          */}
          <SummaryTile
            label="Available credit"
            value={formatMoney(totals.availableCredit)}
            hint={totals.availableCredit.isNegative() ? "Over the limit" : "Still usable"}
            edge="positive"
            icon="shield"
          />
          <SummaryTile
            label="Net position"
            value={formatMoney(totals.netPosition)}
            hint="Held minus owed"
            edge="info"
            icon="equals"
          />
        </SimpleGrid>
      ) : null}

      {accounts.length === 0 ? (
        <EmptyState
          title={includeArchived ? "No accounts yet" : "No active accounts"}
          description="Add a bank account, cash, or a credit card to start recording expenses against it."
          action={
            <AppLink href="/accounts/new" textDecoration="none">
              <Button>Add your first account</Button>
            </AppLink>
          }
        />
      ) : (
        <AccountList accounts={accounts} />
      )}

      {/*
        The archived toggle, in the same mono register as the activity list's end-of-list notice: it is
        a statement about the extent of the list rather than an action on a record.
      */}
      <Box mt="24px">
        <CardActionLink href={includeArchived ? "/accounts" : "/accounts?archived=true"}>
          {includeArchived ? "Hide archived accounts" : "Show archived accounts"}
        </CardActionLink>
      </Box>
    </Box>
  );
}
