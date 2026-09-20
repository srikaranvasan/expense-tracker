import type { Metadata } from "next";
import { SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AccountBalances } from "@/features/dashboard/components/AccountBalances";
import { PeopleBalances } from "@/features/dashboard/components/PeopleBalances";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { RecentSettlements } from "@/features/dashboard/components/RecentSettlements";
import { SpendingSummary } from "@/features/dashboard/components/SpendingSummary";
import { SummaryTile } from "@/features/dashboard/components/SummaryTile";
import { getDashboardView } from "@/features/dashboard/queries/dashboard-queries";
import { RecentTransactionList } from "@/features/transactions/components/TransactionList";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

/**
 * The dashboard.
 *
 * Every figure on this page is recomputed from the underlying records on each load.
 * Nothing here is a stored total, which is the point: a cached aggregate is the first
 * number that disagrees with the list it summarises
 * (docs/01-MVP-SCOPE.md section 4).
 */
export default async function DashboardPage() {
  const user = await requireUser();
  const view = await getDashboardView(user.id, user.currency, user.timezone);

  if (view.isEmpty) {
    return (
      <Stack as="section" gap="5">
        <PageHeader title="Dashboard" description="Nothing recorded yet." />

        <QuickActions />

        <EmptyState
          title="Your dashboard is waiting on some data"
          description="Record an expense and this page will fill in with balances, spending and who owes what. Everything here is calculated from what you enter, so nothing is ever out of date."
          action={
            <AppLink href="/transactions/new" textDecoration="none">
              <Button>Record your first expense</Button>
            </AppLink>
          }
        />

        <AccountBalances accounts={view.accounts} />
      </Stack>
    );
  }

  return (
    <Stack as="section" gap="5">
      <PageHeader title="Dashboard" description="Everything calculated from your records." />

      {view.totals.anyCardOverLimit ? (
        <Alert tone="error" title="A card is over its limit">
          Check your cards below — one of them is carrying more than its credit limit.
        </Alert>
      ) : null}

      <QuickActions />

      <SimpleGrid columns={{ base: 2, md: 4 }} gap="3">
        <SummaryTile
          label="Cash & bank"
          value={view.totals.liquidBalance.formatted}
          hint="Across all accounts"
        />
        <SummaryTile
          label={`Spent in ${view.spending.monthLabel}`}
          value={view.spending.total.formatted}
          hint="Your own share"
        />
        {view.totals.hasCreditCards ? (
          <>
            <SummaryTile
              label="Card debt"
              value={view.totals.creditCardOutstanding.formatted}
              hint="Total outstanding"
              tone={view.totals.anyCardOverLimit ? "negative" : "neutral"}
            />
            <SummaryTile
              label="Available credit"
              value={view.totals.availableCredit.formatted}
              hint="Still usable"
            />
          </>
        ) : (
          <>
            <SummaryTile
              label="Owed to you"
              value={view.people.peopleOweUser.formatted}
              tone={view.people.peopleOweUser.amount.amount === "0" ? "neutral" : "positive"}
            />
            <SummaryTile
              label="You owe"
              value={view.people.userOwesPeople.formatted}
              tone={view.people.userOwesPeople.amount.amount === "0" ? "neutral" : "negative"}
            />
          </>
        )}
      </SimpleGrid>

      {/* Net position is only meaningful once a card exists to subtract. */}
      {view.totals.hasCreditCards ? (
        <Card>
          <CardBody>
            <Text fontSize="sm" color="content.muted">
              Net position — cash and bank minus what you owe on cards
            </Text>
            <Text textStyle="amount" fontSize="xl" fontWeight="semibold" mt="1">
              {view.totals.netPosition.formatted}
            </Text>
          </CardBody>
        </Card>
      ) : null}

      <SpendingSummary spending={view.spending} />

      <AccountBalances accounts={view.accounts} />

      <SimpleGrid columns={{ base: 1, md: 2 }} gap="4">
        <PeopleBalances
          title="Owes you"
          subtitle="People with an outstanding balance"
          people={view.peopleOwingUser}
          emptyText="Nobody owes you anything right now."
        />
        <PeopleBalances
          title="You owe"
          subtitle="People you still need to pay"
          people={view.peopleUserOwes}
          emptyText="You are square with everyone."
        />
      </SimpleGrid>

      <Card>
        <CardHeader
          title="Recent activity"
          action={
            <AppLink href="/transactions" fontSize="xs" flexShrink="0">
              See all
            </AppLink>
          }
        />
        <CardBody>
          {view.recentTransactions.length === 0 ? (
            <Text fontSize="sm" color="content.muted">
              No transactions yet.
            </Text>
          ) : (
            <RecentTransactionList
              groups={view.recentTransactions}
              accountNames={view.recentAccountNames}
              categoryNames={view.recentCategoryNames}
              personNames={view.recentPersonNames}
            />
          )}
        </CardBody>
      </Card>

      <RecentSettlements settlements={view.recentSettlements} />
    </Stack>
  );
}
