import type { Metadata } from "next";
import { Box, Text } from "@chakra-ui/react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, DetailList, DetailRow } from "@/components/ui/Card";
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
            <Button size="sm">Add person</Button>
          </AppLink>
        }
      />

      {people.length > 0 ? (
        <Card mb="5">
          <CardBody>
            <DetailList>
              <DetailRow
                label="People owe you"
                value={formatMoney(totals.peopleOweUser)}
                emphasis
              />
              <DetailRow label="You owe people" value={formatMoney(totals.userOwesPeople)} />
            </DetailList>
          </CardBody>
        </Card>
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

      <Text mt="5" fontSize="sm">
        <AppLink href={includeArchived ? "/people" : "/people?archived=true"}>
          {includeArchived ? "Hide archived people" : "Show archived people"}
        </AppLink>
      </Text>
    </Box>
  );
}
