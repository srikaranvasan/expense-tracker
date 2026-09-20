import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink } from "@/components/ui/AppLink";
import { Card, CardBody, CardHeader, DetailList, DetailRow } from "@/components/ui/Card";
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
      <PageHeader
        title={settlement.formattedAmount}
        description={`${settlement.directionLabel} · ${settlement.dateLabel}`}
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
            <DetailRow label="Account" value={settlement.accountName ?? "Not tracked"} />
            <DetailRow label="Date" value={settlement.dateLabel} />
            <DetailRow label="Recorded" value={settlement.createdAtLabel} />
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
