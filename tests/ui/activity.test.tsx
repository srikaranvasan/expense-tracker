import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { EmptyState } from "@/components/feedback/EmptyState";
import { Button } from "@/components/ui/Button";
import { TransactionFilters } from "@/features/transactions/components/TransactionFilters";
import { TransactionList } from "@/features/transactions/components/TransactionList";
import type {
  TransactionDayGroup,
  TransactionListItem,
} from "@/features/transactions/view-models/expense-view-model";

/**
 * The activity screen (group 35; `design/ux/screens/Activity-Light.html`).
 *
 * Geometry is measured in a browser — see the group 35 update document. What is here is the row's
 * *content* logic, which is where the artboard is making decisions rather than choosing pixels: which
 * badges appear on which record, that a plain expense gets none, and that a split keeps both of its
 * figures.
 */

let mockSearch = "";

vi.mock("next/navigation", () => ({
  usePathname: () => "/transactions",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(mockSearch),
}));

function item(overrides: Partial<TransactionListItem> = {}): TransactionListItem {
  return {
    id: "65f1a2b3c4d5e6f708192a3b",
    clientId: "txn-1",
    referenceCode: "#92A3B",
    type: "expense",
    typeLabel: "Expense",
    description: "Filter coffee",
    amount: { amount: "220", currency: "INR" },
    formattedAmount: "₹220.00",
    userShare: { amount: "220", currency: "INR" },
    formattedUserShare: "₹220.00",
    isSplit: false,
    isShared: false,
    participantCount: 1,
    settlementStatus: null,
    settlementLabel: null,
    outstandingShareCount: 0,
    date: "2026-09-21T10:00:00.000Z",
    dateLabel: "21 Sept 2026",
    dayLabel: "Today",
    accountId: "acc-1",
    fromAccountId: null,
    toAccountId: null,
    categoryId: "cat-1",
    notes: null,
    paidByPersonId: null,
    syncVersion: 1,
    ...overrides,
  };
}

function group(items: TransactionListItem[], dayKey = "2026-09-21"): TransactionDayGroup {
  return { dayKey, dayLabel: items[0]?.dayLabel ?? "Today", items };
}

function renderList(items: TransactionListItem[]) {
  return renderWithProviders(
    <TransactionList
      groups={[group(items)]}
      accountNames={{ "acc-1": "Cash wallet", "acc-2": "HDFC Savings", "acc-3": "ICICI Platinum" }}
      categoryNames={{ "cat-1": "Dining out" }}
      personNames={{ "p-1": "Arun Kumar" }}
      categoryIcons={{ "cat-1": "cutlery" }}
    />,
  );
}

describe("the day grouping", () => {
  it("labels each day as a section heading", () => {
    /*
     * The artboard draws one bordered card per day with its date above it, not one long card with
     * date rows inside. The label is still an `h2` labelling a `section`, so a screen reader can move
     * day by day rather than scrolling a single undifferentiated list.
     */
    renderList([item()]);

    const heading = screen.getByRole("heading", { level: 2, name: "Today" });
    expect(heading).toBeInTheDocument();
    expect(window.getComputedStyle(heading).fontFamily).toBe("var(--chakra-fonts-mono)");
    expect(window.getComputedStyle(heading).textTransform).toBe("uppercase");
  });
});

describe("the row's swatch", () => {
  it("borrows the category's glyph for an expense", () => {
    /*
     * A generic "expense" glyph would waste the most informative thing in the row: a column of
     * activity is readable as groceries, transport, bills at a glance. The icon comes from a lookup
     * map beside the names, so a category shared by ten rows is stored once.
     */
    const { container } = renderList([item()]);
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("is outlined, not filled", () => {
    /*
     * The third swatch case, and the one that looks like the other two. A category or account swatch
     * is filled with colour; a type swatch is `surface` with an ink outline, because the colour on
     * this row belongs to the badges.
     */
    const { container } = renderList([item()]);
    const swatch = container.querySelector("svg")!.parentElement!;
    expect(window.getComputedStyle(swatch).background).toContain("--chakra-colors-surface");
  });
});

describe("the row's badges", () => {
  it("leaves a plain personal expense unbadged", () => {
    // Most rows are personal expenses. Badging the default is noise that hides the exceptions.
    renderList([item()]);

    expect(screen.queryByText("Split")).toBeNull();
    expect(screen.queryByText("Expense")).toBeNull();
    expect(screen.queryByText("Settled")).toBeNull();
  });

  it("gives a shared expense both a type and a settlement badge", () => {
    // `Activity-Light.html` draws exactly this pair: what the record is, and where it stands.
    renderList([
      item({
        description: "Team dinner at Toit",
        isShared: true,
        isSplit: true,
        settlementStatus: "partially_settled",
        settlementLabel: "Part settled",
        formattedUserShare: "₹1,600.00",
        formattedAmount: "₹4,800.00",
      }),
    ]);

    expect(screen.getByText("Split")).toBeInTheDocument();
    expect(screen.getByText("Part settled")).toBeInTheDocument();
  });

  it("badges a transfer and a card payment by type", () => {
    renderList([
      item({
        id: "a".repeat(24),
        type: "transfer",
        typeLabel: "Transfer",
        description: "Cash withdrawal",
        accountId: null,
        fromAccountId: "acc-2",
        toAccountId: "acc-1",
        categoryId: null,
      }),
      item({
        id: "b".repeat(24),
        type: "credit_card_payment",
        typeLabel: "Card payment",
        description: "Part payment",
        accountId: null,
        fromAccountId: "acc-2",
        toAccountId: "acc-3",
        categoryId: null,
      }),
    ]);

    expect(screen.getByText("Transfer")).toBeInTheDocument();
    expect(screen.getByText("Card payment")).toBeInTheDocument();
    // And the two accounts read as a direction rather than a list.
    expect(screen.getByText("HDFC Savings → Cash wallet")).toBeInTheDocument();
  });

  it("does not badge a settled state on a record with nothing to settle", () => {
    /*
     * `settlementStatus` is null for a personal expense — it creates no obligations. A row that said
     * "Unsettled" would be describing a debt that does not exist.
     */
    renderList([item({ settlementStatus: null })]);
    expect(screen.queryByText("Unsettled")).toBeNull();
  });
});

describe("the share-of-total treatment", () => {
  it("keeps both figures on a split row", () => {
    /*
     * "₹1,600.00 of ₹4,800.00" — required by 9.1 and the reason a shared expense is legible at a
     * glance. The headline is what it cost *you*; the second line is what the bill was. Collapsing
     * either direction leaves "did this cost me ₹4,800 or ₹1,600?" open.
     */
    renderList([
      item({
        isShared: true,
        isSplit: true,
        formattedUserShare: "₹1,600.00",
        formattedAmount: "₹4,800.00",
      }),
    ]);

    expect(screen.getByText("₹1,600.00")).toBeInTheDocument();
    expect(screen.getByText(/of ₹4,800.00/)).toBeInTheDocument();
  });

  it("shows one figure when there is only one", () => {
    // A personal expense's share *is* its amount. A second line repeating it would be noise.
    renderList([item()]);
    expect(screen.queryByText(/^of /)).toBeNull();
  });

  it("puts the reference before the amount, so the amount column stays flush", () => {
    const { container } = renderList([item()]);

    const cluster = screen.getByText("#92A3B").parentElement!;
    const texts = [...cluster.children].map((node) => node.textContent);
    expect(texts[0]).toBe("#92A3B");
    expect(texts[1]).toContain("₹220.00");
    expect(container).toBeTruthy();
  });
});

describe("the filter toggle", () => {
  const options = { accountOptions: [], categoryOptions: [], personOptions: [] } as const;

  it("is an ordinary button when nothing is filtered", () => {
    // A dashed teal chip reading "Filters · 0 active" would be an alarm about nothing.
    mockSearch = "";
    renderWithProviders(<TransactionFilters {...options} />);

    const toggle = screen.getByRole("button", { name: "Filters" });
    expect(window.getComputedStyle(toggle).borderStyle).not.toBe("dashed");
  });

  it("says how many filters are active without being opened", () => {
    /*
     * The requirement in its own right. A collapsed panel that hides the fact that two filters are
     * narrowing the list is how a user comes to believe they have lost transactions.
     */
    mockSearch = "type=transfer&accountId=acc-1";
    renderWithProviders(<TransactionFilters {...options} />);

    const toggle = screen.getByRole("button", { name: /Filters · 2 active/ });
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveAttribute("aria-expanded", "false");
  });

  it("becomes the dashed teal chip when something is active", () => {
    /*
     * Dashed appears in exactly two places in this design — here and on `Stamp` — which is what makes
     * it read as "provisional" rather than as decoration.
     */
    mockSearch = "type=transfer";
    renderWithProviders(<TransactionFilters {...options} />);

    const toggle = screen.getByRole("button", { name: /Filters · 1 active/ });
    const styles = window.getComputedStyle(toggle);
    expect(styles.borderStyle).toBe("dashed");
    expect(styles.borderColor).toBe("var(--chakra-colors-brand-fg)");
  });

  it("commits a search with the ink fill, not a second teal button", () => {
    /*
     * The page's primary action is "Add expense" in the header. A teal Search button below it would
     * give one screen two primaries; `secondary` would leave the row with no obvious commit.
     */
    mockSearch = "";
    renderWithProviders(<TransactionFilters {...options} />);

    const search = screen.getByRole("button", { name: "Search" });
    const styles = window.getComputedStyle(search);
    expect(styles.background).toContain("--chakra-colors-content");
    expect(styles.color).toBe("var(--chakra-colors-content-inverted)");
    expect(styles.boxShadow).toBe("none");
  });
});

describe("Button — the contrast tone", () => {
  it("is ink with inverted text and no shadow", () => {
    renderWithProviders(
      <Button tone="contrast" size="lg">
        Search
      </Button>,
    );

    const styles = window.getComputedStyle(screen.getByRole("button", { name: "Search" }));
    expect(styles.background).toContain("--chakra-colors-content");
    expect(styles.color).toBe("var(--chakra-colors-content-inverted)");
    // The offset shadow marks the *page's* primary action; this tone deliberately has none.
    expect(styles.boxShadow).toBe("none");
  });
});

describe("EmptyState — the status eyebrow", () => {
  it("names the condition in the ledger register", () => {
    /*
     * The two not-found pages use this instead of a large illustrated "404": same voice as the AS OF
     * stamp and the end-of-list notice.
     */
    renderWithProviders(
      <EmptyState eyebrow="Record not found" title="This record was not found" />,
    );

    const eyebrow = screen.getByText("Record not found");
    expect(window.getComputedStyle(eyebrow).fontFamily).toBe("var(--chakra-fonts-mono)");
    expect(screen.getByText("This record was not found")).toBeInTheDocument();
  });

  it("stays optional, so an empty list is not stamped", () => {
    // An empty list is not a condition — it is a list with nothing in it.
    renderWithProviders(<EmptyState title="No transactions yet" />);
    expect(screen.queryByText(/not found/i)).toBeNull();
  });
});
