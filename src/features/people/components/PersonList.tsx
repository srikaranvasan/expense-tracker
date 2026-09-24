import { Box, Flex, HStack, Text } from "@chakra-ui/react";
import { RowLink } from "@/components/ui/AppLink";
import { Avatar } from "@/components/ui/Avatar";
import type { AvatarRelation } from "@/components/ui/Avatar";
import { BalanceBadge } from "@/components/ui/BalanceBadge";
import { Card, CardList } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
            <HStack gap="12px" flex="1" minW="0">
              {/*
                A square with initials, not a circle — nothing in this design is round (5.1). The fill
                encodes direction, which is a glance-level cue and useless to anyone who cannot see
                hue, so it only ever appears beside the `BalanceBadge` that states the direction in
                words.
              */}
              <Avatar name={person.name} relation={avatarRelation(person)} size="lg" />

              {/* The badge stacks below the name on a phone; `StatusBadge` cannot shrink. */}
              <Flex
                direction={{ base: "column", md: "row" }}
                align={{ base: "stretch", md: "center" }}
                gap={{ base: "6px", md: "10px" }}
                minW="0"
              >
                <Box minW="0">
                  <Text fontSize="row" fontWeight="600" truncate>
                    {person.name}
                  </Text>
                  {person.balance.unsettledCount > 0 ? (
                    <Text fontSize="meta" color="content.subtle" mt="2px">
                      {person.balance.unsettledCount} unsettled{" "}
                      {person.balance.unsettledCount === 1 ? "expense" : "expenses"}
                    </Text>
                  ) : null}
                </Box>

                {person.isArchived ? (
                  <HStack gap="8px" flexShrink="0">
                    <StatusBadge kind="archived" />
                  </HStack>
                ) : null}
              </Flex>
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

/**
 * Maps a balance direction onto an avatar fill.
 *
 * Mint when they owe you, coral when you owe them, and the one non-bright fill when you are square —
 * a settled person should not be flagged in either colour.
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
