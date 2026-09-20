import type { Metadata } from "next";
import { Box, Text } from "@chakra-ui/react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, DetailList, DetailRow } from "@/components/ui/Card";
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
            <Button size="sm">Add account</Button>
          </AppLink>
        }
      />

      {allAccounts.length > 0 ? (
        <Card mb="5">
          <CardBody>
            <DetailList>
              <DetailRow label="Bank + cash" value={formatMoney(totals.liquidBalance)} emphasis />
              <DetailRow
                label="Credit-card outstanding"
                value={formatMoney(totals.creditCardOutstanding)}
              />
              <DetailRow label="Available credit" value={formatMoney(totals.availableCredit)} />
              <DetailRow label="Net position" value={formatMoney(totals.netPosition)} emphasis />
            </DetailList>
          </CardBody>
        </Card>
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

      <Text mt="5" fontSize="sm">
        <AppLink href={includeArchived ? "/accounts" : "/accounts?archived=true"}>
          {includeArchived ? "Hide archived accounts" : "Show archived accounts"}
        </AppLink>
      </Text>
    </Box>
  );
}
