import { Box, Text } from "@chakra-ui/react";
import { CardActionLink, RowLink } from "@/components/ui/AppLink";
import { Card, CardBody, CardHeader, CardList } from "@/components/ui/Card";
import { ReferenceCode } from "@/components/ui/ReferenceCode";
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
            <CardActionLink href="/settlements">See all</CardActionLink>
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

              {/* Stacked, matching the dashboard's recent-activity rows rather than the wider lists. */}
              <Box flexShrink="0" textAlign="end">
                <Text textStyle="amount" fontSize="sm" fontWeight="semibold">
                  {settlement.formattedAmount}
                </Text>
                <ReferenceCode code={settlement.referenceCode} display="block" />
              </Box>
            </RowLink>
          ))}
        </CardList>
      )}
    </Card>
  );
}
