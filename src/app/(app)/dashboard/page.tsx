import type { Metadata } from "next";
import { SimpleGrid, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink, CardActionLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader } from "@/components/ui/Card";
import { AccountBalances } from "@/features/dashboard/components/AccountBalances";
import { NetPosition } from "@/features/dashboard/components/NetPosition";
import { PeopleBalances } from "@/features/dashboard/components/PeopleBalances";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { RecentSettlements } from "@/features/dashboard/components/RecentSettlements";
import { SpendingSummary } from "@/features/dashboard/components/SpendingSummary";
import { SummaryTile } from "@/components/ui/Card";
import { getDashboardView } from "@/features/dashboard/queries/dashboard-queries";
import { formatDateTime } from "@/lib/dates";
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
      <PageHeader
        title="Dashboard"
        description="Everything calculated from your records."
        /*
          A **render timestamp**, and nothing more.
          
          Section 9.1 forbids anything that implies a stored or cached total — no "live" badge, no
          freshness indicator. This says only "these numbers were computed at this moment", which is
          literally true: every figure on the page is recalculated on each load. It is generated here,
          during the render that produced them, rather than passed through the view model, so it
          cannot report a time the figures were not computed at.
        */
        meta={
          <Text textStyle="eyebrow" letterSpacing="eyebrowWide">
            As of {formatDateTime(new Date(), user.timezone)}
          </Text>
        }
      />

      {view.totals.anyCardOverLimit ? (
        <Alert tone="error" title="A card is over its limit">
          Check your cards below — one of them is carrying more than its credit limit.
        </Alert>
      ) : null}

      <QuickActions />

      <SimpleGrid columns={{ base: 2, md: 4 }} gap="3">
        {/*
          The `edge` colours are semantic, not decorative (7.3): teal for money held, butter for
          spending, coral for a liability, mint for headroom. `tone` is a separate question — it
          colours the figure when the number itself is bad news — so card debt keeps its coral edge
          whatever it reads.
        */}
        <SummaryTile
          label="Cash & bank"
          value={view.totals.liquidBalance.formatted}
          hint="Across all accounts"
          edge="brand"
          icon="accounts"
        />
        <SummaryTile
          label={`Spent in ${view.spending.monthLabel}`}
          value={view.spending.total.formatted}
          hint="Your own share"
          edge="caution"
          icon="bar-chart"
        />
        {view.totals.hasCreditCards ? (
          <>
            <SummaryTile
              label="Card debt"
              value={view.totals.creditCardOutstanding.formatted}
              hint="Total outstanding"
              edge="negative"
              icon="card"
              tone={view.totals.anyCardOverLimit ? "negative" : "neutral"}
            />
            <SummaryTile
              label="Available credit"
              value={view.totals.availableCredit.formatted}
              hint="Still usable"
              edge="positive"
              icon="shield"
            />
          </>
        ) : (
          <>
            <SummaryTile
              label="Owed to you"
              value={view.people.peopleOweUser.formatted}
              edge="positive"
              icon="arrow-in"
              tone={view.people.peopleOweUser.amount.amount === "0" ? "neutral" : "positive"}
            />
            <SummaryTile
              label="You owe"
              value={view.people.userOwesPeople.formatted}
              edge="negative"
              icon="arrow-out"
              tone={view.people.userOwesPeople.amount.amount === "0" ? "neutral" : "negative"}
            />
          </>
        )}
      </SimpleGrid>

      {/* Net position is only meaningful once a card exists to subtract. */}
      {view.totals.hasCreditCards ? (
        <NetPosition formattedAmount={view.totals.netPosition.formatted} />
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
          action={<CardActionLink href="/transactions">See all</CardActionLink>}
        />
        {/*
          No `CardBody` around the list: `RecentTransactionList` pads its own rows so they run to the
          card's edges, like every other card here. A body wrapper inset them and left a blank band
          under the header rule.
        */}
        {view.recentTransactions.length === 0 ? (
          <CardBody>
            <Text fontSize="row" color="content.subtle">
              No transactions yet.
            </Text>
          </CardBody>
        ) : (
          <RecentTransactionList
            groups={view.recentTransactions}
            accountNames={view.recentAccountNames}
            categoryNames={view.recentCategoryNames}
            personNames={view.recentPersonNames}
          />
        )}
      </Card>

      <RecentSettlements settlements={view.recentSettlements} />
    </Stack>
  );
}
