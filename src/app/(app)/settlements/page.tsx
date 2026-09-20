import type { Metadata } from "next";
import { Box, Flex, Stack, Text } from "@chakra-ui/react";
import { EmptyState } from "@/components/feedback/EmptyState";
import { PageHeader } from "@/components/layout/PageHeader";
import { AppLink, RowLink } from "@/components/ui/AppLink";
import { Button } from "@/components/ui/Button";
import { Card, CardList } from "@/components/ui/Card";
import { PAGINATION } from "@/config/constants";
import { getSettlementListView } from "@/features/settlements/queries/settlement-queries";
import { listSettlementsQuerySchema } from "@/features/settlements/schemas/settlement-schemas";
import { requireUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Settlements" };

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const parsed = listSettlementsQuerySchema.safeParse(params);
  const query = parsed.success ? parsed.data : { limit: PAGINATION.defaultLimit };

  const view = await getSettlementListView(user.id, user.timezone, {
    limit: query.limit,
    ...("cursor" in query && query.cursor ? { cursor: query.cursor } : {}),
    ...("personId" in query && query.personId ? { personId: query.personId } : {}),
    ...("from" in query && query.from ? { from: query.from } : {}),
    ...("to" in query && query.to ? { to: query.to } : {}),
  });

  return (
    <Box as="section">
      <PageHeader
        title="Settlements"
        description="Payments that cleared a shared-expense balance."
      />

      {view.items.length === 0 ? (
        <EmptyState
          title="No settlements yet"
          description="When you settle up with someone, the payment appears here."
          action={
            <AppLink href="/people" textDecoration="none">
              <Button>Go to people</Button>
            </AppLink>
          }
        />
      ) : (
        <Card>
          <CardList>
            {view.items.map((settlement) => (
              <RowLink key={settlement.id} href={`/settlements/${settlement.id}`}>
                <Box minW="0">
                  <Text fontSize="sm" fontWeight="medium" truncate>
                    {settlement.directionLabel} · {settlement.personName}
                  </Text>
                  <Text fontSize="xs" color="content.muted" truncate>
                    {settlement.dateLabel}
                    {settlement.accountName ? ` · ${settlement.accountName}` : ""}
                  </Text>
                </Box>

                <Text textStyle="amount" fontSize="sm" fontWeight="semibold" flexShrink="0">
                  {settlement.formattedAmount}
                </Text>
              </RowLink>
            ))}
          </CardList>
        </Card>
      )}

      {view.nextCursor ? (
        <Stack mt="5">
          <AppLink href={`/settlements?cursor=${view.nextCursor}`} textDecoration="none">
            <Button tone="secondary" fullWidth>
              Load older
            </Button>
          </AppLink>
        </Stack>
      ) : null}

      <Flex mt="5">
        <Text fontSize="sm">
          <AppLink href="/people">Settle up with someone</AppLink>
        </Text>
      </Flex>
    </Box>
  );
}
