import { Box, HStack, Text } from "@chakra-ui/react";
import { CardActionLink, RowLink } from "@/components/ui/AppLink";
import { Avatar } from "@/components/ui/Avatar";
import type { AvatarRelation } from "@/components/ui/Avatar";
import { BalanceBadge } from "@/components/ui/BalanceBadge";
import { Card, CardBody, CardHeader, CardList } from "@/components/ui/Card";
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
          people.length > 0 ? <CardActionLink href="/people">See all</CardActionLink> : undefined
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
              <HStack gap="12px" minW="0">
                {/*
                  The fill encodes direction — mint when they owe you, coral when you owe them — which
                  is a glance-level cue and useless to anyone who cannot see hue. That is why it is
                  only ever drawn beside a `BalanceBadge`, which says the direction in words.
                */}
                <Avatar name={person.name} relation={avatarRelation(person)} />

                <Box minW="0">
                  <Text fontSize="row" fontWeight="600" truncate>
                    {person.name}
                  </Text>
                  <Text fontSize="meta" color="content.subtle">
                    {person.balance.unsettledCount}{" "}
                    {person.balance.unsettledCount === 1 ? "expense" : "expenses"} outstanding
                  </Text>
                </Box>
              </HStack>

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

/**
 * Maps a balance direction onto an avatar fill.
 *
 * `neutral` for a settled person. These two panels only list people with an outstanding balance, so
 * that branch is unreachable today — it exists so the function is total over the union rather than
 * asserting a state the type still permits.
 */
function avatarRelation(person: PersonView): AvatarRelation {
  switch (person.balance.direction) {
    case "person_owes_user":
      return "owesYou";
    case "user_owes_person":
      return "youOwe";
    default:
      return "neutral";
  }
}
