import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { AppLink } from "@/components/ui/AppLink";
import { Card, CardBody, CardHeader, DetailList, DetailRow } from "@/components/ui/Card";
import { ReferenceCode } from "@/components/ui/ReferenceCode";
import { SettlementDeleteButton } from "@/features/settlements/components/SettlementDeleteButton";
import { getSettlementDetailView } from "@/features/settlements/queries/settlement-queries";
import { isAppError } from "@/lib/errors";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Settlement" };

export default async function SettlementDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;

  const settlement = await getSettlementDetailView(user.id, id, user.timezone).catch(
    (error: unknown) => {
      if (isAppError(error) && error.code === "NOT_FOUND") return null;
      throw error;
    },
  );

  if (!settlement) notFound();

  return (
    <Stack as="section" gap="5">
      {/*
        The back link here is the one that closes a genuine dead end, not just a missing convenience.
        `/settlements` is not in the tab bar (group 42 section 3.2), so before this the only way off
        this page was a nav destination in another section entirely — the page's own list was
        unreachable. See audit section 6.1.
      */}
      <PageHeader
        title={settlement.formattedAmount}
        description={`${settlement.directionLabel} · ${settlement.dateLabel}`}
        parent={PARENTS.settlements}
      />

      <Card>
        <CardHeader title="Payment" />
        <CardBody>
          <DetailList>
            <DetailRow label="Amount" value={settlement.formattedAmount} emphasis />
            <DetailRow label="Direction" value={settlement.directionLabel} />
            <DetailRow
              label="Person"
              value={
                <AppLink href={`/people/${settlement.personId}`}>{settlement.personName}</AppLink>
              }
            />
            {/*
              Linked in group 47, so this page treats its account the way it already treated its
              person. "Not tracked" is a real state — a settlement can be recorded without saying
              which account the cash moved through — and stays plain text.
            */}
            <DetailRow
              label="Account"
              value={
                settlement.accountId && settlement.accountName ? (
                  <AppLink href={`/accounts/${settlement.accountId}`}>
                    {settlement.accountName}
                  </AppLink>
                ) : (
                  (settlement.accountName ?? "Not tracked")
                )
              }
            />
            <DetailRow label="Date" value={settlement.dateLabel} />
            <DetailRow label="Recorded" value={settlement.createdAtLabel} />
            {/*
              A settlement has one card, not the expense screens' separate "Record" block, so the
              reference joins the payment's own rows — last, because it names the row rather than
              describing the payment.
            */}
            <DetailRow
              label="Reference"
              value={<ReferenceCode code={settlement.referenceCode} fontSize="meta" />}
            />
          </DetailList>

          {settlement.notes ? (
            <Box mt="4">
              <Text fontSize="xs" fontWeight="semibold" color="content.muted" mb="1">
                Notes
              </Text>
              <Text fontSize="sm" whiteSpace="pre-wrap">
                {settlement.notes}
              </Text>
            </Box>
          ) : null}
        </CardBody>
      </Card>

      <Card>
        <CardHeader
          title="Expenses settled"
          subtitle={`${settlement.allocations.length} ${settlement.allocations.length === 1 ? "expense" : "expenses"}`}
        />
        <CardBody>
          <Stack
            as="ul"
            gap="0"
            listStyleType="none"
            separator={<Box borderTopWidth="1px" borderColor="line" />}
          >
            {settlement.allocations.map((allocation) => (
              <Flex as="li" key={allocation.id} justify="space-between" gap="4" py="3">
                <Box minW="0">
                  {allocation.transactionId ? (
                    <AppLink
                      href={`/transactions/${allocation.transactionId}`}
                      fontSize="sm"
                      fontWeight="medium"
                      color="content"
                      textDecoration="none"
                      display="block"
                      truncate
                    >
                      {allocation.expenseDescription}
                    </AppLink>
                  ) : (
                    <Text fontSize="sm" fontWeight="medium" truncate>
                      {allocation.expenseDescription}
                    </Text>
                  )}
                  <Text fontSize="xs" color="content.muted">
                    {allocation.expenseDateLabel}
                  </Text>
                </Box>

                <Text textStyle="amount" fontSize="sm" fontWeight="semibold" flexShrink="0">
                  {allocation.formattedAmount}
                </Text>
              </Flex>
            ))}
          </Stack>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Manage" />
        <CardBody>
          <SettlementDeleteButton
            settlementId={settlement.id}
            personId={settlement.personId}
            personName={settlement.personName}
            formattedAmount={settlement.formattedAmount}
          />
        </CardBody>
      </Card>
    </Stack>
  );
}
