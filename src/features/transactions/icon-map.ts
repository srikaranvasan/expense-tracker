import type { IconName } from "@/components/icons/names";
import { resolveCategoryIcon } from "@/features/categories/icon-map";
import type { TransactionType } from "@/types/common";

/**
 * The glyph inside a transaction-type swatch in the activity list.
 *
 * This is the **third** swatch case in the design, and the one that is easy to get wrong
 * because it looks like the other two. A category swatch and an account swatch are filled with
 * a colour; a transaction-type swatch is filled with `surface` and outlined in ink
 * (section 6.4). It is a marker of *kind*, not of identity, so it carries no colour of its own
 * — the row's category swatch does that job elsewhere.
 *
 * The consequence for the glyph: it is drawn in `currentColor`, **not** with the fixed-ink rule
 * that applies inside a coloured fill. On a `surface` background in dark mode, ink would be
 * invisible.
 */

/**
 * An expense borrows its category's glyph, which is why this takes the category icon.
 *
 * A generic "expense" glyph would waste the most informative thing in the row: at a glance, a
 * column of activity rows is readable as groceries, transport, bills. The other three types
 * have no category, so they get a type glyph.
 */
export function resolveTransactionIcon(
  type: TransactionType,
  categoryIcon: string | null | undefined,
): IconName {
  switch (type) {
    case "expense":
      return resolveCategoryIcon(categoryIcon);
    case "transfer":
      return "transfer";
    case "credit_card_payment":
      return "card";
    case "income":
      // Money arriving. The same glyph as an "owes you" amount, for the same reason: it is the
      // direction that matters.
      return "arrow-in";
  }
}
