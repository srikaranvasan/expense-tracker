import { Swatch } from "@/components/ui/Swatch";
import type { TransactionType } from "@/types/common";
import { resolveTransactionIcon } from "../icon-map";

export type TransactionTypeSwatchProps = {
  type: TransactionType;
  /**
   * The category's stored icon, for an expense.
   *
   * An expense borrows its **category's** glyph rather than getting a generic one, so a column of
   * activity rows reads at a glance as groceries, transport, bills — the most informative thing in the
   * row. The other three types have no category and use a type glyph.
   */
  categoryIcon?: string | null;
};

/**
 * The 26px marker at the start of an activity row.
 *
 * The third swatch case in section 6.4, and the one that behaves differently: it is filled with
 * `surface` and outlined in ink, because it marks a *kind* rather than an identity and carries no
 * colour of its own. That is why `fixedInk` is `false` — on a `surface` fill, a glyph pinned to ink
 * would be invisible in dark mode.
 */
export function TransactionTypeSwatch({ type, categoryIcon }: TransactionTypeSwatchProps) {
  return (
    <Swatch
      bg="surface"
      icon={resolveTransactionIcon(type, categoryIcon)}
      size="md"
      fixedInk={false}
    />
  );
}
