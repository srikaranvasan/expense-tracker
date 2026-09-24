import { describe, expect, it } from "vitest";
import { renderWithProviders } from "@tests/helpers/render";
import { Swatch } from "@/components/ui/Swatch";
import { AccountSwatch } from "@/features/accounts/components/AccountSwatch";
import { CategorySwatch } from "@/features/categories/components/CategorySwatch";
import { TransactionTypeSwatch } from "@/features/transactions/components/TransactionTypeSwatch";

/**
 * The three swatch cases from section 6.4.
 *
 * In `tests/ui/` rather than beside the components because the three feature swatches live in three
 * different features, and the thing worth testing is how they *differ* from each other — which is
 * only visible with all three in one file.
 *
 * They are in `features/*` at all because each needs its feature's resolver, and `components/ui` is
 * barred from importing feature logic (docs/05-FOLDER-STRUCTURE.md). The generic shell is
 * `components/ui/Swatch.tsx`.
 */

const fillOf = (container: HTMLElement) =>
  window.getComputedStyle(container.firstElementChild!).background;

const glyphColorOf = (container: HTMLElement) =>
  window.getComputedStyle(container.querySelector("svg")!).color;

describe("Swatch shell", () => {
  it("requires a decision about the glyph colour", () => {
    /*
     * `fixedInk` has no default on purpose. Both answers look correct in light mode and only one of
     * them is correct in dark, so a caller that has not thought about it should not get a working
     * component by accident.
     */
    const pinned = renderWithProviders(<Swatch bg="swatch.mint" icon="bank" fixedInk />);
    expect(glyphColorOf(pinned.container)).toBe("var(--chakra-colors-content-on-swatch)");
    pinned.unmount();

    const inherited = renderWithProviders(<Swatch bg="surface" icon="bank" fixedInk={false} />);
    expect(glyphColorOf(inherited.container)).not.toBe("var(--chakra-colors-content-on-swatch)");
  });

  it("keeps its glyph decorative", () => {
    // A swatch sits beside the name of the thing it depicts, so the glyph is a second rendering of
    // text that is already on the page.
    const { container } = renderWithProviders(<Swatch bg="swatch.sky" icon="card" fixedInk />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("CategorySwatch", () => {
  it("renders a glyph even when the category has no stored icon", () => {
    // Which is every category a user created, because the form never offered the field.
    const { container } = renderWithProviders(
      <CategorySwatch categoryId="65f1a2b3c4d5e6f708192a3b" icon={null} />,
    );

    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("takes its colour from the id, not the icon", () => {
    /*
     * The colour must survive an edit. Changing the icon — or renaming the category, which does not
     * reach this component at all — cannot move the colour, because a year of charts would shift with
     * it.
     */
    const first = renderWithProviders(
      <CategorySwatch categoryId="65f1a2b3c4d5e6f708192a3b" icon="utensils" />,
    );
    const fill = fillOf(first.container);
    first.unmount();

    for (const icon of ["cart", "bolt", null]) {
      const next = renderWithProviders(
        <CategorySwatch categoryId="65f1a2b3c4d5e6f708192a3b" icon={icon} />,
      );
      expect(fillOf(next.container), `icon=${icon}`).toBe(fill);
      next.unmount();
    }
  });

  it("gives different categories different colours", () => {
    // Not a guarantee for any two ids — five buckets — but the resolver must not collapse everything
    // into one, which is what a naive hash over similar ids does.
    const fills = new Set(
      [
        "65f1a2b3c4d5e6f708192a3b",
        "65f1a2b3c4d5e6f70819aaaa",
        "65f1a2b3c4d5e6f70819bbbb",
        "65f1a2b3c4d5e6f70819cccc",
        "65f1a2b3c4d5e6f70819dddd",
      ].map((id) => {
        const { container, unmount } = renderWithProviders(
          <CategorySwatch categoryId={id} icon={null} />,
        );
        const fill = fillOf(container);
        unmount();
        return fill;
      }),
    );

    expect(fills.size).toBeGreaterThan(1);
  });

  it("pins its glyph to ink", () => {
    const { container } = renderWithProviders(
      <CategorySwatch categoryId="65f1a2b3c4d5e6f708192a3b" icon="utensils" />,
    );
    expect(glyphColorOf(container)).toBe("var(--chakra-colors-content-on-swatch)");
  });
});

describe("AccountSwatch", () => {
  it("colours a credit card as a liability", () => {
    // Teal is the brand, mint is positive, coral is negative. A card is not money held.
    const card = renderWithProviders(<AccountSwatch type="credit_card" />);
    expect(fillOf(card.container)).toBe("var(--chakra-colors-swatch-coral)");
    card.unmount();

    const bank = renderWithProviders(<AccountSwatch type="bank" />);
    expect(fillOf(bank.container)).toBe("var(--chakra-colors-swatch-teal)");
    bank.unmount();

    const cash = renderWithProviders(<AccountSwatch type="cash" />);
    expect(fillOf(cash.container)).toBe("var(--chakra-colors-swatch-mint)");
  });

  it("pins its glyph to ink", () => {
    const { container } = renderWithProviders(<AccountSwatch type="bank" />);
    expect(glyphColorOf(container)).toBe("var(--chakra-colors-content-on-swatch)");
  });
});

describe("TransactionTypeSwatch", () => {
  it("is filled with surface, not a swatch colour", () => {
    /*
     * The case that looks like the other two and is not. It marks a *kind* rather than an identity, so
     * it carries no colour of its own — the row's category swatch does that job elsewhere.
     */
    const { container } = renderWithProviders(<TransactionTypeSwatch type="transfer" />);
    expect(fillOf(container)).toBe("var(--chakra-colors-surface)");
  });

  it("does not pin its glyph to ink", () => {
    // Because the fill is `surface`, which is dark in dark mode: a fixed ink glyph would be invisible.
    const { container } = renderWithProviders(<TransactionTypeSwatch type="transfer" />);
    expect(glyphColorOf(container)).not.toBe("var(--chakra-colors-content-on-swatch)");
  });

  it("gives an expense its category's glyph", () => {
    // So a column of activity rows reads at a glance as groceries, transport, bills.
    const expense = renderWithProviders(
      <TransactionTypeSwatch type="expense" categoryIcon="utensils" />,
    );
    const expensePath = expense.container.querySelector("path")?.getAttribute("d");
    expense.unmount();

    const transfer = renderWithProviders(<TransactionTypeSwatch type="transfer" />);
    const transferPath = transfer.container.querySelector("path")?.getAttribute("d");

    expect(expensePath).toBeTruthy();
    expect(expensePath).not.toBe(transferPath);
  });

  it("falls back for an expense whose category has no icon", () => {
    const { container } = renderWithProviders(
      <TransactionTypeSwatch type="expense" categoryIcon={null} />,
    );
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
