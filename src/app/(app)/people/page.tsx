import type { Metadata } from "next";
import { Box, Flex, SimpleGrid } from "@chakra-ui/react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink, CardActionLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { SummaryTile } from "@/components/ui/Card";
import { calculatePeopleTotals } from "@/domain/people/calculations";
import { PersonList } from "@/features/people/components/PersonList";
import { getPeopleListView } from "@/features/people/queries/person-queries";
import { formatMoney, money } from "@/lib/money";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "People" };

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string }>;
}) {
  const user = await requireUser();
  const { archived, q } = await searchParams;
  const includeArchived = archived === "true";

  const people = await getPeopleListView(user.id, user.currency, {
    includeArchived,
    ...(q ? { search: q } : {}),
  });

  // Totals are computed from the same balances the rows display, so the summary
  // and the list can never disagree.
  const totals = calculatePeopleTotals(
    people.map((person) => ({
      personId: person.id,
      currency: person.balance.currency,
      personOwesUser: money(person.balance.personOwesUser.amount, person.balance.currency),
      userOwesPerson: money(person.balance.userOwesPerson.amount, person.balance.currency),
      net: money(person.balance.net.amount, person.balance.currency),
      direction: person.balance.direction,
      netAbsolute: money(person.balance.netAbsolute.amount, person.balance.currency),
      isSettled: person.balance.isSettled,
      unsettledCount: person.balance.unsettledCount,
    })),
    user.currency,
  );

  return (
    <Box as="section">
      <PageHeader
        title="People"
        description="Contacts you split expenses with."
        action={
          <AppLink href="/people/new" textDecoration="none">
            <Button>Add person</Button>
          </AppLink>
        }
      />

      {/*
        Two tiles, matching the dashboard's owed/owing pair — mint for money coming to you, coral for
        money going out. Kept as two rather than one signed figure: a single net number forces the
        reader to decode a sign, and getting that wrong is the most consequential misreading here.
      */}
      {people.length > 0 ? (
        <SimpleGrid columns={2} gap="3" mb="24px">
          <SummaryTile
            label="People owe you"
            value={formatMoney(totals.peopleOweUser)}
            hint="Across everyone"
            edge="positive"
            icon="arrow-in"
          />
          <SummaryTile
            label="You owe people"
            value={formatMoney(totals.userOwesPeople)}
            hint="Across everyone"
            edge="negative"
            icon="arrow-out"
          />
        </SimpleGrid>
      ) : null}

      {people.length === 0 ? (
        <EmptyState
          title={q ? "No matching people" : "No people yet"}
          description={
            q
              ? "Try a different name."
              : "Add the people you share expenses with, then split an expense to see who owes whom."
          }
          action={
            q ? undefined : (
              <AppLink href="/people/new" textDecoration="none">
                <Button>Add your first person</Button>
              </AppLink>
            )
          }
        />
      ) : (
        <PersonList people={people} />
      )}

      {/*
        Two links, in the same quiet mono register: one narrows the list, one leaves it.

        The settlements link is the group 47 fix for `/settlements` being unreachable. It is not a nav
        destination and deliberately stays out of the tab bar — a sixth tab would have cost every label
        about 17% of its width at 402px, reopening the crushed-label bug (group 42 section 3.2). This
        is what replaces it: `/settlements` already linked *here* ("Settle up with someone"), and this
        closes the loop, so the list is two taps from anywhere via a tab-bar destination.
      */}
      <Flex mt="24px" gap="24px" wrap="wrap" align="center">
        <CardActionLink href={includeArchived ? "/people" : "/people?archived=true"}>
          {includeArchived ? "Hide archived people" : "Show archived people"}
        </CardActionLink>

        <CardActionLink href="/settlements">Settlement history</CardActionLink>
      </Flex>
    </Box>
  );
}
