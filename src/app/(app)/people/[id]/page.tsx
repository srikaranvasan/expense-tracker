import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { AppLink, RowLink } from "@/components/ui/AppLink";
import { Avatar } from "@/components/ui/Avatar";
import type { AvatarRelation } from "@/components/ui/Avatar";
import { BalanceBadge } from "@/components/ui/BalanceBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, DetailList, DetailRow } from "@/components/ui/Card";
import { ReferenceCode } from "@/components/ui/ReferenceCode";
import { Stamp } from "@/components/ui/Stamp";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type { PersonBalanceDirection } from "@/types/common";
import { PersonArchiveButton } from "@/features/people/components/PersonArchiveButton";
import { PersonObligationList } from "@/features/people/components/PersonObligationList";
import { getPersonDetailView } from "@/features/people/queries/person-queries";
import { isAppError } from "@/lib/errors";
import { formatMoney, money } from "@/lib/money";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Person" };

export default async function PersonDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;

  const person = await getPersonDetailView(user.id, id, user.currency, user.timezone).catch(
    (error: unknown) => {
      if (isAppError(error) && error.code === "NOT_FOUND") return null;
      throw error;
    },
  );

  if (!person) notFound();

  const unsettled = person.obligations.filter((obligation) => obligation.status !== "settled");
  const settled = person.obligations.filter((obligation) => obligation.status === "settled");

  return (
    <Stack as="section" gap="5">
      <PageHeader
        title={person.name}
        description={person.notes ?? undefined}
        parent={PARENTS.people}
        /*
          Identity above the title, as the account detail page does: the same directional avatar the
          list row showed, so the page is recognisable as the row that was tapped.
        */
        meta={
          <HStack gap="10px">
            <Avatar
              name={person.name}
              relation={avatarRelation(person.balance.direction)}
              size="xl"
            />
            {person.isArchived ? <StatusBadge kind="archived" /> : null}
          </HStack>
        }
        action={
          <HStack gap="12px">
            {/* The action this screen exists for, offered where the balance is on screen. */}
            {!person.balance.isSettled && !person.isArchived ? (
              <AppLink href={`/people/${person.id}/settle`} textDecoration="none">
                <Button>Settle up</Button>
              </AppLink>
            ) : null}
            <AppLink href={`/people/${person.id}/edit`} textDecoration="none">
              <Button tone="secondary">Edit</Button>
            </AppLink>
          </HStack>
        }
      />

      {person.isArchived ? (
        <Alert tone="warning">
          This person is archived. They will not appear when splitting a new expense.
        </Alert>
      ) : null}

      <Card>
        <CardHeader
          title="Balance"
          subtitle="Derived from shared expenses and settlements"
          action={
            <BalanceBadge
              direction={person.balance.direction}
              formattedAmount={person.balance.formattedNet}
              label={person.balance.label}
            />
          }
        />
        <CardBody>
          {/*
            **Both gross figures, never one net number.** A person can owe you for one expense while
            you owe them for another, and collapsing that to "₹400" hides which way each half went.
            The `BalanceBadge` in the header states the net, in words; these two say what it came from.
          */}
          <DetailList>
            <DetailRow
              label="They owe you"
              value={formatMoney(
                money(person.balance.personOwesUser.amount, person.balance.currency),
              )}
            />
            <DetailRow
              label="You owe them"
              value={formatMoney(
                money(person.balance.userOwesPerson.amount, person.balance.currency),
              )}
            />
          </DetailList>

          {/*
            The settled state gets the `BALANCED` stamp — a derived confirmation, which is exactly
            what the stamp is for (5.4). It sits beside the words "You are square", which is what
            assistive technology reads; the stamp itself is decoration.
          */}
          {person.balance.isSettled ? (
            <Flex align="center" gap="14px" mt="18px" wrap="wrap">
              <Text fontSize="row" color="content.subtle">
                You are square with {person.name}.
              </Text>
              <Stamp label="Balanced" />
            </Flex>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Unsettled expenses"
          subtitle={`${unsettled.length} ${unsettled.length === 1 ? "expense" : "expenses"}`}
        />
        <CardBody>
          {unsettled.length === 0 ? (
            <Text fontSize="sm" color="content.muted">
              Nothing outstanding with {person.name}.
            </Text>
          ) : (
            <PersonObligationList obligations={unsettled} />
          )}
        </CardBody>
      </Card>

      {settled.length > 0 ? (
        <Card>
          <CardHeader title="Settled expenses" subtitle={`${settled.length} settled`} />
          <CardBody>
            <PersonObligationList obligations={settled} />
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Settlement history" />
        <CardBody>
          {person.settlements.length === 0 ? (
            <EmptyState
              title="No settlements yet"
              description={`Payments between you and ${person.name} will appear here.`}
            />
          ) : (
            <Stack as="ul" gap="0" listStyleType="none">
              {person.settlements.map((settlement) => (
                <Box
                  as="li"
                  key={settlement.id}
                  borderTopWidth="hairline"
                  borderColor="line.soft"
                  _first={{ borderTopWidth: "0" }}
                >
                  {/*
                    Group 47: these rows are links now.

                    They were the only money rows in the app that named a record and did not open it,
                    which mattered here more than elsewhere — `/settlements` is not in the tab bar
                    (group 42 section 3.2), so a person's settlement history is the main way anyone
                    reaches an individual settlement. `SettlementSummaryView` already carried `id`.

                    `RowLink` brings its own padding, so the `py`/`px` that used to be on the `Flex`
                    moved with it and the row keeps its height.
                  */}
                  <RowLink href={`/settlements/${settlement.id}`}>
                    <Box minW="0">
                      <Text fontSize="row" fontWeight="600">
                        {settlement.directionLabel}
                      </Text>
                      <Text fontSize="meta" color="content.subtle" mt="2px">
                        {settlement.dateLabel}
                      </Text>
                    </Box>
                    {/* Reference beside the amount, as every other money row in the app now has. */}
                    <HStack gap="14px" flexShrink="0" align="center">
                      <ReferenceCode code={settlement.referenceCode} />
                      <Text textStyle="amount" fontSize="row" fontWeight="600">
                        {settlement.formattedAmount}
                      </Text>
                    </HStack>
                  </RowLink>
                </Box>
              ))}
            </Stack>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Manage" />
        <CardBody>
          <PersonArchiveButton
            personId={person.id}
            personName={person.name}
            isArchived={person.isArchived}
            hasOutstandingBalance={!person.balance.isSettled}
            formattedBalance={person.balance.formattedNet}
            balanceLabel={person.balance.label}
          />
        </CardBody>
      </Card>
    </Stack>
  );
}

/** Mint when they owe you, coral when you owe them, neutral when square. */
function avatarRelation(direction: PersonBalanceDirection): AvatarRelation {
  switch (direction) {
    case "person_owes_user":
      return "owesYou";
    case "user_owes_person":
      return "youOwe";
    default:
      return "neutral";
  }
}
