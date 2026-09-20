import { Badge, Box, Circle, HStack, Text } from "@chakra-ui/react";
import { RowLink } from "@/components/ui/AppLink";
import { BalanceBadge } from "@/components/ui/BalanceBadge";
import { Card, CardList } from "@/components/ui/Card";
import type { PersonView } from "../view-models/person-view-model";

/**
 * People with their net balances.
 *
 * Sorted by outstanding amount so whoever the user most needs to settle with is at
 * the top, with settled contacts last.
 */
export function PersonList({ people }: { people: readonly PersonView[] }) {
  const sorted = [...people].sort((a, b) => {
    if (a.balance.isSettled !== b.balance.isSettled) return a.balance.isSettled ? 1 : -1;
    const byAmount = Number(b.balance.netAbsolute.amount) - Number(a.balance.netAbsolute.amount);
    return byAmount !== 0 ? byAmount : a.name.localeCompare(b.name);
  });

  return (
    <Card>
      <CardList>
        {sorted.map((person) => (
          <RowLink key={person.id} href={`/people/${person.id}`}>
            <HStack gap="3" minW="0">
              <Circle
                size="9"
                bg="brand.muted"
                color="brand.fg"
                fontSize="sm"
                fontWeight="semibold"
                flexShrink="0"
                aria-hidden="true"
              >
                {person.initials}
              </Circle>

              <Box minW="0">
                <Text fontSize="sm" fontWeight="medium" truncate>
                  {person.name}
                  {person.isArchived ? (
                    <Badge ml="2" variant="subtle" bg="surface.sunken" color="content.muted">
                      Archived
                    </Badge>
                  ) : null}
                </Text>
                {person.balance.unsettledCount > 0 ? (
                  <Text fontSize="xs" color="content.muted">
                    {person.balance.unsettledCount} unsettled{" "}
                    {person.balance.unsettledCount === 1 ? "expense" : "expenses"}
                  </Text>
                ) : null}
              </Box>
            </HStack>

            <Box flexShrink="0">
              <BalanceBadge
                direction={person.balance.direction}
                formattedAmount={person.balance.formattedNet}
                label={person.balance.label}
                size="sm"
              />
            </Box>
          </RowLink>
        ))}
      </CardList>
    </Card>
  );
}
