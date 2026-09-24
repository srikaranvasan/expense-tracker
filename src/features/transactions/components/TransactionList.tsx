import { Box, Flex, HStack, Stack, Text } from "@chakra-ui/react";
import { RowLink } from "@/components/ui/AppLink";
import { Card, CardList } from "@/components/ui/Card";
import { ReferenceCode } from "@/components/ui/ReferenceCode";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TransactionTypeSwatch } from "./TransactionTypeSwatch";
import { formatAccountDirection } from "../view-models/direction";
import type { TransactionDayGroup, TransactionListItem } from "../view-models/expense-view-model";

/**
 * The account context for one row.
 *
 * A transfer or card payment has two accounts and no category, so it reads as a
 * direction rather than a list: "HDFC Savings → Cash". Everything else has at most
 * one account.
 */
function accountMeta(item: TransactionListItem, accountNames: Record<string, string>): string[] {
  if (item.fromAccountId || item.toAccountId) {
    return [
      formatAccountDirection(
        item.fromAccountId ? (accountNames[item.fromAccountId] ?? null) : null,
        item.toAccountId ? (accountNames[item.toAccountId] ?? null) : null,
      ),
    ];
  }

  const name = item.accountId ? accountNames[item.accountId] : undefined;
  return name ? [name] : [];
}

/**
 * Settlement state of a shared expense.
 *
 * Only rendered when there is something to settle, and only for the two states worth
 * calling out. Every shared expense starts unsettled, so a badge saying so on every
 * row would be noise that makes the two interesting states harder to spot. The label
 * is a word, never colour alone (docs/06-CODING-PRACTICES.md section 40).
 *
 * Now a `StatusBadge`, which is where the mapping from state to fill and glyph lives — so the same
 * state looks the same here, on a detail page and on the person screen.
 */
function SettlementBadge({ item }: { item: TransactionListItem }) {
  if (item.settlementStatus === "settled") return <StatusBadge kind="settled" />;
  if (item.settlementStatus === "partially_settled") return <StatusBadge kind="partSettled" />;
  return null;
}

/**
 * The record's own type, when it is not an ordinary personal expense.
 *
 * `Activity-Light.html` badges a split, a transfer and a card payment, and leaves a plain expense
 * unbadged — which is the same "do not badge the default" rule the settlement badge follows. An
 * expense is what most rows are; saying so on every one of them is noise.
 *
 * A shared expense gets **both** badges: `Split` states what the record is, and `Part settled` states
 * where it stands. The artboard draws exactly that pair.
 */
function TypeBadge({ item }: { item: TransactionListItem }) {
  if (item.isShared) return <StatusBadge kind="split" />;
  if (item.type === "transfer") return <StatusBadge kind="transfer" />;
  if (item.type === "credit_card_payment") return <StatusBadge kind="cardPayment" />;
  return null;
}

/**
 * Whether the row has any badge at all.
 *
 * Kept in step with the two components above by construction — it asks the same questions in the same
 * order. It exists so an unbadged row renders no wrapper, and therefore no flex gap: an ordinary
 * personal expense is the majority of rows, and a 12px indent on all of them to leave room for
 * nothing would be visible on every screen.
 */
function hasBadges(item: TransactionListItem): boolean {
  return (
    item.isShared ||
    item.type === "transfer" ||
    item.type === "credit_card_payment" ||
    item.settlementStatus === "settled" ||
    item.settlementStatus === "partially_settled"
  );
}

export type TransactionListProps = {
  groups: readonly TransactionDayGroup[];
  accountNames: Record<string, string>;
  categoryNames: Record<string, string>;
  personNames: Record<string, string>;
  /**
   * `Category.icon` by id, for the row's type swatch.
   *
   * Optional, and only the grouped list uses it: the dashboard's flat variant draws no swatch, as
   * `Dashboard-Light.html` shows. A missing entry resolves to the fallback glyph rather than failing,
   * which is what an expense with no category gets anyway.
   */
  categoryIcons?: Record<string, string | null>;
};

/**
 * Transactions grouped by day.
 *
 * A shared expense shows the user's own share as the headline figure and the full
 * amount underneath, because "what did this cost me" is the question a spending list
 * answers (docs/03-DATA-FLOW.md section 7).
 */
export function TransactionList({
  groups,
  accountNames,
  categoryNames,
  personNames,
  categoryIcons,
}: TransactionListProps) {
  // 24px between day blocks, as drawn — the eyebrow carries its own 10px below it.
  return (
    <Stack gap="24px">
      {groups.map((group) => (
        <Box as="section" key={group.dayKey} aria-labelledby={`day-${group.dayKey}`}>
          {/*
            The day label is the eyebrow device, and it sits **outside** the card — the artboard
            draws one bordered card per day with its date above it, rather than one long card with
            date rows inside. `content.subtle` rather than the eyebrow default of `content.muted`,
            as drawn: it is a divider, not a field label.

            Still an `h2` labelling a `section`, so a screen reader can move day by day.
          */}
          <Text
            id={`day-${group.dayKey}`}
            as="h2"
            textStyle="eyebrow"
            letterSpacing="0.09em"
            color="content.subtle"
            mb="10px"
          >
            {group.dayLabel}
          </Text>

          <Card>
            <CardList>
              {group.items.map((item) => {
                const meta = [
                  ...accountMeta(item, accountNames),
                  item.categoryId ? categoryNames[item.categoryId] : null,
                ].filter(Boolean);

                const payer = item.paidByPersonId
                  ? (personNames[item.paidByPersonId] ?? "Someone else")
                  : null;

                return (
                  <RowLink key={item.id} href={`/transactions/${item.id}`}>
                    {/* `flex="1"` + `minW="0"`: claims the space left by the amount cluster, and
                        allows the text inside to truncate instead of overflowing into it. */}
                    <HStack gap="12px" flex="1" minW="0" align="center">
                      {/*
                        A 26px square with the record's own glyph: an expense borrows its category's,
                        a transfer gets the arrow, a card payment the card. The fill is `surface`, not
                        a swatch — the colour on this row belongs to the badges, and a coloured square
                        here would compete with them.
                      */}
                      <TransactionTypeSwatch
                        type={item.type}
                        categoryIcon={
                          item.categoryId ? (categoryIcons?.[item.categoryId] ?? null) : null
                        }
                      />

                      {/*
                        Badges sit beside the description above 768px, as `Activity-Light.html` draws
                        them, and **below it on a phone**.

                        Not a preference. A `StatusBadge` cannot shrink — it is `nowrap` with a fixed
                        border — so at 393px it took its width first and left the description about
                        90px: "Cash withdrawal" rendered as "C…" over "HD…". That is the crushed-title
                        bug of section 9.2 in a different place, and the fix is the same one
                        `PageHeader` uses: stop sharing the row below the breakpoint.

                        One DOM position, a responsive direction. Rendering the badges twice and
                        hiding one copy would have a screen reader announce every one of them twice.
                      */}
                      <Flex
                        direction={{ base: "column", md: "row" }}
                        /*
                          `stretch`, not `flex-start`, on the stacked axis. A column flex with
                          `align-items: flex-start` sizes each child to its *content* width, which
                          left the truncating text unbounded — the meta line ran out of the row and
                          under the reference code. Stretching binds it to the row's width so
                          `truncate` has something to truncate against.
                        */
                        align={{ base: "stretch", md: "center" }}
                        gap={{ base: "6px", md: "12px" }}
                        minW="0"
                      >
                        <Box minW="0">
                          <Text fontSize="row" fontWeight="600" truncate>
                            {item.description}
                          </Text>
                          <Text fontSize="meta" color="content.subtle" truncate mt="2px">
                            {payer ? `${payer} paid` : meta.join(" · ") || item.typeLabel}
                            {payer && meta.length > 0 ? ` · ${meta.join(" · ")}` : ""}
                          </Text>
                        </Box>

                        {/*
                          Only rendered when there is something to show, or the flex gap would indent
                          every unbadged row — which is most of them.
                        */}
                        {hasBadges(item) ? (
                          <HStack gap="8px" flexShrink="0">
                            <TypeBadge item={item} />
                            <SettlementBadge item={item} />
                          </HStack>
                        ) : null}
                      </Flex>
                    </HStack>

                    {/*
                      Reference then amount, in one right-hand cluster with a 14px gap — the
                      arrangement in `Activity-Light.html`. The code sits *before* the figure so the
                      column of amounts stays flush against the row's right edge; a reference in that
                      column would break the alignment that makes a list of money scannable.
                    */}
                    <HStack gap="14px" flexShrink="0" align="center">
                      <ReferenceCode code={item.referenceCode} />

                      <Box textAlign="end">
                        <Text textStyle="amount" fontSize="control" fontWeight="600">
                          {item.type === "expense" ? item.formattedUserShare : item.formattedAmount}
                        </Text>
                        {/*
                          "₹1,600.00 of ₹4,800.00" — the share-of-total treatment, which section 9.1
                          requires and which is the whole reason a shared expense is legible at a
                          glance. The headline is what it cost *you*; the second line is what the bill
                          was. Never collapsed to one figure, in either direction.
                        */}
                        {item.isSplit ? (
                          <Text textStyle="amount" fontSize="eyebrow" color="content.subtle">
                            of {item.formattedAmount}
                          </Text>
                        ) : null}
                      </Box>
                    </HStack>
                  </RowLink>
                );
              })}
            </CardList>
          </Card>
        </Box>
      ))}
    </Stack>
  );
}

/** Simple flat variant for embedding a short recent-activity list. */
export function RecentTransactionList({
  groups,
  accountNames,
  categoryNames,
  personNames,
}: TransactionListProps) {
  const items = groups.flatMap((group) => group.items);

  /*
   * `CardList` rather than a padded `Stack`, so the rows run to the card's edges and the first one
   * starts immediately under the header rule — as every other card on the dashboard does. Previously
   * this sat inside a `CardBody`, which inset the rows and left a blank band under the header.
   */
  return (
    <CardList>
      {items.map((item) => (
        <Flex
          key={item.id}
          align="center"
          justify="space-between"
          gap="4"
          paddingInline={{ base: "16px", md: "24px" }}
          paddingBlock={{ base: "13px", md: "16px" }}
        >
          <Box minW="0">
            <Text fontSize="sm" fontWeight="medium" truncate>
              {item.description}
            </Text>
            <Text fontSize="xs" color="content.muted" truncate>
              {item.dayLabel}
              {accountMeta(item, accountNames)
                .map((entry) => ` · ${entry}`)
                .join("")}
              {item.categoryId && categoryNames[item.categoryId]
                ? ` · ${categoryNames[item.categoryId]}`
                : ""}
              {item.paidByPersonId
                ? ` · ${personNames[item.paidByPersonId] ?? "Someone else"} paid`
                : ""}
            </Text>
          </Box>

          {/*
            The dashboard stacks them instead: amount, reference underneath, both right-aligned
            (`Dashboard-Light.html`). A narrower column has no room for a side-by-side pair, and the
            reference is the less urgent of the two.
          */}
          <Box flexShrink="0" textAlign="end">
            <Text textStyle="amount" fontSize="row" fontWeight="600">
              {item.type === "expense" ? item.formattedUserShare : item.formattedAmount}
            </Text>
            <ReferenceCode code={item.referenceCode} display="block" />
          </Box>
        </Flex>
      ))}
    </CardList>
  );
}
