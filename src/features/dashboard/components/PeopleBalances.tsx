import { Box, Text } from "@chakra-ui/react";
import { RowLink } from "@/components/ui/AppLink";
import { BalanceBadge } from "@/components/ui/BalanceBadge";
import { Card, CardBody, CardHeader, CardList } from "@/components/ui/Card";
import { AppLink } from "@/components/ui/AppLink";
import type { PersonView } from "@/features/people/view-models/person-view-model";

export type PeopleBalancesProps = {
  title: string;
  subtitle: string;
  people: readonly PersonView[];
  /** Shown when nobody is in this direction. */
  emptyText: string;
};

/**
 * People with an outstanding balance, in one direction.
 *
 * Split into two panels - who owes the user, and who the user owes - rather than one
 * signed list. A single list forces the reader to decode a sign on every row, and
 * getting that wrong is the most consequential misreading on the screen.
 */
export function PeopleBalances({ title, subtitle, people, emptyText }: PeopleBalancesProps) {
  return (
    <Card>
      <CardHeader
        title={title}
        subtitle={subtitle}
        action={
          people.length > 0 ? (
            <AppLink href="/people" fontSize="xs" flexShrink="0">
              See all
            </AppLink>
          ) : undefined
        }
      />

      {people.length === 0 ? (
        <CardBody>
          <Text fontSize="sm" color="content.muted">
            {emptyText}
          </Text>
        </CardBody>
      ) : (
        <CardList>
          {people.map((person) => (
            <RowLink key={person.id} href={`/people/${person.id}`}>
              <Box minW="0">
                <Text fontSize="sm" fontWeight="medium" truncate>
                  {person.name}
                </Text>
                <Text fontSize="xs" color="content.muted">
                  {person.balance.unsettledCount}{" "}
                  {person.balance.unsettledCount === 1 ? "expense" : "expenses"} outstanding
                </Text>
              </Box>

              <BalanceBadge
                direction={person.balance.direction}
                formattedAmount={person.balance.formattedNet}
                label={person.balance.label}
                size="sm"
              />
            </RowLink>
          ))}
        </CardList>
      )}
    </Card>
  );
}
