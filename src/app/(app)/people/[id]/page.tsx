import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { BalanceBadge } from "@/components/ui/BalanceBadge";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, DetailList, DetailRow } from "@/components/ui/Card";
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
        action={
          <AppLink href={`/people/${person.id}/edit`} textDecoration="none">
            <Button size="sm" tone="secondary">
              Edit
            </Button>
          </AppLink>
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

          {!person.balance.isSettled ? (
            <Box mt="4">
              <AppLink href={`/people/${person.id}/settle`} textDecoration="none">
                <Button fullWidth>Settle up</Button>
              </AppLink>
            </Box>
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
            <Stack
              as="ul"
              gap="0"
              listStyleType="none"
              separator={<Box borderTopWidth="1px" borderColor="line" />}
            >
              {person.settlements.map((settlement) => (
                <Flex
                  as="li"
                  key={settlement.id}
                  align="center"
                  justify="space-between"
                  gap="4"
                  py="3"
                >
                  <Box minW="0">
                    <Text fontSize="sm" fontWeight="medium">
                      {settlement.directionLabel}
                    </Text>
                    <Text fontSize="xs" color="content.muted">
                      {settlement.dateLabel}
                    </Text>
                  </Box>
                  <Text textStyle="amount" fontSize="sm" fontWeight="semibold" flexShrink="0">
                    {settlement.formattedAmount}
                  </Text>
                </Flex>
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
