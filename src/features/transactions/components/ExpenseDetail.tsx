import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { PageHeader } from "@/components/layout/PageHeader";
import { PARENTS } from "@/components/layout/Parents";
import { AppLink, RowLink } from "@/components/ui/AppLink";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardList, DetailList, DetailRow } from "@/components/ui/Card";
import { ReferenceCode } from "@/components/ui/ReferenceCode";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { ExpenseDeleteButton } from "./ExpenseDeleteButton";
import type { ExpenseDetailView } from "../view-models/expense-view-model";

export type ExpenseDetailProps = {
  expense: ExpenseDetailView;
};

/**
 * Detail layout for an expense.
 *
 * Shows the user's share as its own row only when it differs from the amount, so a
 * personal expense is not padded with a row that repeats the line above it.
 */
export function ExpenseDetail({ expense }: ExpenseDetailProps) {
  const isExpense = expense.type === "expense";
  const canEditInline = isExpense && !expense.isShared;

  return (
    <Stack as="section" gap="5">
      {/*
        A shared expense has no `Edit` action (see `canEditInline`), so before group 45 this page had
        nothing in its header at all and no link out of any of its cards — the most complex record in
        the app was the hardest to leave (audit 6.2). The back link is now unconditional; the
        participant rows below are the other half of the fix.
      */}
      <PageHeader
        title={expense.description}
        description={`${expense.typeLabel} · ${expense.dateLabel}`}
        parent={PARENTS.transactions}
        action={
          canEditInline ? (
            <AppLink href={`/transactions/${expense.id}/edit`} textDecoration="none">
              <Button size="sm" tone="secondary">
                Edit
              </Button>
            </AppLink>
          ) : undefined
        }
      />

      <Card>
        <CardHeader
          title="Details"
          action={
            expense.isShared ? (
              // The same two chips the activity row carries, from the same component — so a record
              // looks the same in the list it was found in and on the page it opens.
              <HStack gap="8px" flexShrink="0">
                <StatusBadge kind="split" />
                {expense.settlementStatus === "settled" ? <StatusBadge kind="settled" /> : null}
                {expense.settlementStatus === "partially_settled" ? (
                  <StatusBadge kind="partSettled" />
                ) : null}
              </HStack>
            ) : undefined
          }
        />
        <CardBody>
          {/*
            **Three amounts, kept distinct** on a shared expense (9.1): the full bill here, the user's
            own share on the row below, and each participant's share in the "Split between" card. All
            three are real and different, and collapsing any two of them is the misreading this screen
            exists to prevent — "did this cost me ₹4,800 or ₹1,600?" is not a question a detail page
            should leave open.

            "Your share" only appears when it differs, so a personal expense is not padded with a row
            repeating the line above it.
          */}
          <DetailList>
            <DetailRow label="Amount" value={expense.formattedAmount} emphasis />
            {expense.isSplit ? (
              <DetailRow label="Your share" value={expense.formattedUserShare} emphasis />
            ) : null}
            {isExpense ? <DetailRow label="Paid by" value={expense.paidByName} /> : null}
            <DetailRow
              label="Account"
              value={<AccountRef id={expense.accountId} name={expense.accountName} />}
            />
            {/*
              The category links to a **filtered activity list**, not to a category page — there is no
              category detail route, and `/categories` is a management screen for renaming and
              archiving rather than a place to see what was spent. "What else went to Groceries?" is
              the question a user is actually asking here.
            */}
            <DetailRow
              label="Category"
              value={
                expense.categoryId && expense.categoryName ? (
                  <AppLink href={`/transactions?categoryId=${expense.categoryId}`}>
                    {expense.categoryName}
                  </AppLink>
                ) : (
                  (expense.categoryName ?? "Uncategorised")
                )
              }
            />
            <DetailRow label="Date" value={expense.dateLabel} />
          </DetailList>

          {expense.notes ? <NotesBlock notes={expense.notes} /> : null}
        </CardBody>
      </Card>

      {expense.isShared ? (
        <Card>
          <CardHeader
            title="Split between"
            subtitle={
              expense.outstandingShareCount > 0
                ? `${expense.participants.length} participants · ${expense.outstandingShareCount} still owing`
                : `${expense.participants.length} participants · all settled`
            }
          />
          <CardList>
            {expense.participants.map((participant) => {
              /*
                Group 47: a participant row is a link to that person, which is what turns this card
                from a list of names into a way off the page (audit 6.2). "Ravi owes me ₹1,600 — what
                else does he owe me?" is one tap now instead of a trip through the tab bar.

                The user's own row is **not** a link: there is no `/people` record for the account
                holder, and a row that looks like a link and does nothing is worse than plain text.
                `personId` is null for the user, so the same condition covers both.
              */
              const linkable = !participant.isUser && participant.personId !== null;

              const body = (
                <>
                  <HStack gap="12px" minW="0">
                    {/*
                      `relation="self"` for the user — teal, the one avatar fill that means "you" rather
                      than a direction. The other participants get the neutral fill: this card lists who
                      the bill was split between, and nobody's *balance* direction is being stated here.
                    */}
                    <Avatar
                      name={participant.name}
                      relation={participant.isUser ? "self" : "neutral"}
                      size="md"
                    />
                    <Text fontSize="row" fontWeight="600" truncate>
                      {participant.name}
                    </Text>
                  </HStack>

                  <Text textStyle="amount" fontSize="row" fontWeight="600" flexShrink="0">
                    {participant.formattedShare}
                  </Text>
                </>
              );

              /*
                `RowLink` for the linkable rows, which is the same whole-row target every other list in
                the app uses — far easier to hit on a phone than a small text link on the name, and it
                brings its own padding, hover fill and inset focus ring. The non-linkable row keeps the
                `Flex` with matching padding so the two read as one list.
              */
              return linkable ? (
                <RowLink key={participant.expenseSplitId} href={`/people/${participant.personId}`}>
                  {body}
                </RowLink>
              ) : (
                <Flex
                  key={participant.expenseSplitId}
                  align="center"
                  justify="space-between"
                  gap="4"
                  paddingInline={{ base: "16px", md: "24px" }}
                  paddingBlock={{ base: "13px", md: "16px" }}
                >
                  {body}
                </Flex>
              );
            })}
          </CardList>
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Record" />
        <CardBody>
          <DetailList>
            {/*
              First row in the card, because it is the record's *name* — the thing a user reads out
              when asking about this line. Created and updated are facts about it.
            */}
            <DetailRow
              label="Reference"
              value={<ReferenceCode code={expense.referenceCode} fontSize="meta" />}
            />
            <DetailRow label="Created" value={expense.createdAtLabel} />
            <DetailRow label="Last updated" value={expense.updatedAtLabel} />
          </DetailList>
        </CardBody>
      </Card>

      {isExpense ? (
        <Card>
          <CardHeader title="Manage" />
          <CardBody>
            <ExpenseDeleteButton expenseId={expense.id} description={expense.description} />
          </CardBody>
        </Card>
      ) : null}
    </Stack>
  );
}

/**
 * An account named in a `DetailRow`, as a link when it can be one.
 *
 * Group 47. Before this, every account, card and category on every transaction detail page was a
 * plain string, so a user reading "HDFC Savings" had to go to the tab bar, open Accounts and find it
 * again (audit 4.4). `/settlements/[id]` already linked its person, which is the precedent this
 * follows — a plain `AppLink`, not a new primitive.
 *
 * Three cases, which is why this is a component and not an inline ternary repeated six times across
 * three files:
 *
 * ```text
 * no name          "—"            the account was deleted, or none was recorded
 * name, no id      plain text     should not happen, but a label is better than a broken link
 * name and id      a link
 * ```
 *
 * The id comes from `TransactionListItem`, which every detail view extends — so this needed no
 * view-model change (group 42 section 3.9).
 */
export function AccountRef({ id, name }: { id: string | null; name: string | null }) {
  if (!name) return <>—</>;
  if (!id) return <>{name}</>;

  return <AppLink href={`/accounts/${id}`}>{name}</AppLink>;
}

export function NotesBlock({ notes }: { notes: string }) {
  return (
    <Box mt="18px" pt="16px" borderTopWidth="hairline" borderColor="line.soft">
      {/* The eyebrow device, like every other label on these screens. */}
      <Text textStyle="eyebrow" mb="6px">
        Notes
      </Text>
      {/* `pre-wrap`, so a note the user laid out in lines stays laid out in lines. */}
      <Text fontSize="row" whiteSpace="pre-wrap">
        {notes}
      </Text>
    </Box>
  );
}
