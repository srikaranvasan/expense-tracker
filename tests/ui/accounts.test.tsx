import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AccountList } from "@/features/accounts/components/AccountList";
import type { AccountView } from "@/features/accounts/view-models/account-view-model";

/**
 * The accounts screens (group 37).
 *
 * **Not drawn anywhere in the handoff** (section 10), so these assertions carry more weight than
 * usual: there is no artboard to compare a screenshot against, and what stands in for one is the set
 * of rules the rows follow.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/accounts" }));

function account(overrides: Partial<AccountView> = {}): AccountView {
  return {
    id: "65f1a2b3c4d5e6f708192a3b",
    clientId: "acc-1",
    name: "HDFC Savings",
    type: "bank",
    typeLabel: "Bank",
    currency: "INR",
    institutionName: null,
    openingBalance: { amount: "50000", currency: "INR" },
    balance: { amount: "50000", currency: "INR" },
    formattedBalance: "₹50,000.00",
    outstanding: null,
    formattedOutstanding: null,
    creditLimit: null,
    formattedAvailableCredit: null,
    availableCredit: null,
    statementDay: null,
    paymentDueDay: null,
    overLimit: false,
    isArchived: false,
    archivedAt: null,
    syncVersion: 1,
    ...overrides,
  } as AccountView;
}

function card(overrides: Partial<AccountView> = {}): AccountView {
  return account({
    id: "c".repeat(24),
    name: "ICICI Platinum",
    type: "credit_card",
    typeLabel: "Credit card",
    outstanding: { amount: "20097", currency: "INR" },
    formattedOutstanding: "₹20,097.00",
    creditLimit: { amount: "200000", currency: "INR" },
    formattedAvailableCredit: "₹1,79,903.00",
    ...overrides,
  });
}

describe("AccountList", () => {
  it("groups by type, with each group labelled", () => {
    renderWithProviders(<AccountList accounts={[account(), card()]} />);

    expect(screen.getByRole("heading", { level: 2, name: "Bank accounts" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Credit cards" })).toBeInTheDocument();
    // No empty group heading for a type nobody has.
    expect(screen.queryByRole("heading", { level: 2, name: "Cash" })).toBeNull();
  });

  it("gives every row the account's identity swatch", () => {
    /*
     * Teal for a bank, mint for cash, coral for a card — because a card is a liability rather than money
     * held. The same mapping the dashboard and the detail page use, from one resolver.
     */
    const { container } = renderWithProviders(<AccountList accounts={[account(), card()]} />);
    expect(container.querySelectorAll("svg")).toHaveLength(2);
  });

  it("says what the figure is, in words", () => {
    /*
     * A bank row's number could be a balance, a total or a limit. The caption removes the guess, and it
     * is also what keeps the coral card figure from being colour-only information.
     */
    renderWithProviders(<AccountList accounts={[account()]} />);
    expect(screen.getByText("balance")).toBeInTheDocument();
  });

  it("shows a card's outstanding and its headroom, never a signed balance", () => {
    /*
     * "-₹20,097.00" is a correct signed value and the wrong thing to lead with: the user thinks in what
     * they owe and what is left.
     */
    renderWithProviders(<AccountList accounts={[card()]} />);

    expect(screen.getByText("₹20,097.00")).toBeInTheDocument();
    expect(screen.getByText(/₹1,79,903.00 available/)).toBeInTheDocument();
  });

  it("colours a card's debt but not a card at zero", () => {
    /*
     * Follows the dashboard (group 34 section 3.3): card debt is a liability on sight. But "₹0.00 owed"
     * is good news and reads in plain ink.
     */
    const owing = renderWithProviders(<AccountList accounts={[card()]} />);
    expect(window.getComputedStyle(screen.getByText("₹20,097.00")).color).toBe(
      "var(--chakra-colors-negative)",
    );
    owing.unmount();

    renderWithProviders(
      <AccountList
        accounts={[
          card({
            outstanding: { amount: "0", currency: "INR" },
            formattedOutstanding: "₹0.00",
          }),
        ]}
      />,
    );
    expect(window.getComputedStyle(screen.getByText("₹0.00")).color).toBe(
      "var(--chakra-colors-content)",
    );
  });

  it("states over-limit in words as well as colour", () => {
    renderWithProviders(<AccountList accounts={[card({ overLimit: true })]} />);
    expect(screen.getByText(/Over limit ·/)).toBeInTheDocument();
  });

  it("badges an archived account", () => {
    renderWithProviders(<AccountList accounts={[account({ isArchived: true })]} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });
});

describe("StatusBadge — archived", () => {
  it("carries its own foreground, because its fill is not a swatch", () => {
    /*
     * The one quiet badge. `surface.sunken` is paper in light mode and `darkPaper` in dark, so the
     * ink-in-both-modes rule the swatch fills rely on would have made this invisible the moment the
     * theme flipped.
     */
    renderWithProviders(<StatusBadge kind="archived" />);

    const label = screen.getByText("Archived");
    expect(window.getComputedStyle(label.parentElement!).color).toBe(
      "var(--chakra-colors-content-subtle)",
    );
  });

  it("still keeps the swatch rule for every other kind", () => {
    renderWithProviders(<StatusBadge kind="settled" />);
    expect(window.getComputedStyle(screen.getByText("Settled").parentElement!).color).toBe(
      "var(--chakra-colors-content-on-swatch)",
    );
  });
});
