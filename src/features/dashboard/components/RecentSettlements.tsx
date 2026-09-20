import { Box, Text } from "@chakra-ui/react";
import { AppLink, RowLink } from "@/components/ui/AppLink";
import { Card, CardBody, CardHeader, CardList } from "@/components/ui/Card";
import type { SettlementView } from "@/features/settlements/view-models/settlement-view-model";

export type RecentSettlementsProps = {
  settlements: readonly SettlementView[];
};

/**
 * The last few settlements.
 *
 * Each row states the direction in words - "You paid Arun" or "Arun paid you" - rather
 * than relying on a sign, because a settlement's whole meaning is its direction.
 */
export function RecentSettlements({ settlements }: RecentSettlementsProps) {
  return (
    <Card>
      <CardHeader
        title="Recent settlements"
        action={
          settlements.length > 0 ? (
            <AppLink href="/settlements" fontSize="xs" flexShrink="0">
              See all
            </AppLink>
          ) : undefined
        }
      />

      {settlements.length === 0 ? (
        <CardBody>
          <Text fontSize="sm" color="content.muted">
            Nothing settled yet. Settlements appear here once you record a payment to or from
            someone.
          </Text>
        </CardBody>
      ) : (
        <CardList>
          {settlements.map((settlement) => (
            <RowLink key={settlement.id} href={`/settlements/${settlement.id}`}>
              <Box minW="0">
                <Text fontSize="sm" fontWeight="medium" truncate>
                  {settlement.direction === "user_to_person"
                    ? `You paid ${settlement.personName}`
                    : `${settlement.personName} paid you`}
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
      )}
    </Card>
  );
}
