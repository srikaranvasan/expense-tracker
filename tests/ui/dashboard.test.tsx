import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { NetPosition } from "@/features/dashboard/components/NetPosition";
import { PeopleBalances } from "@/features/dashboard/components/PeopleBalances";
import { QuickActions } from "@/features/dashboard/components/QuickActions";
import { QUICK_ADD_ACTIONS } from "@/components/layout/QuickAddActions";
import type { PersonView } from "@/features/people/view-models/person-view-model";

/**
 * Dashboard blocks (group 34; `design/ux/screens/Dashboard-*.html`).
 *
 * The page itself is measured in a browser — see the group 34 update document, which has the numbers.
 * What is here is the part a screenshot cannot pin: the rules the design depends on and the states
 * the seeded browser run could not reach.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

function person(overrides: Partial<PersonView> = {}): PersonView {
  return {
    id: "65f1a2b3c4d5e6f708192a3b",
    clientId: "person-1",
    name: "Ravi Shankar",
    notes: null,
    archivedAt: null,
    isArchived: false,
    syncVersion: 1,
    balance: {
      direction: "person_owes_user",
      label: "owes you",
      net: { amount: "1600", currency: "INR" },
      formattedNet: "₹1,600.00",
      unsettledCount: 1,
    },
    ...overrides,
  } as PersonView;
}

describe("NetPosition", () => {
  it("states that the figure was computed, not stored", () => {
    /*
     * Section 9.1 forbids anything implying a stored or cached total. This band says the opposite in
     * as many words: `equals` plus "computed", which is the same claim the page header's AS OF eyebrow
     * makes about every other figure on the screen.
     */
    renderWithProviders(<NetPosition formattedAmount="₹49,412.50" />);

    expect(screen.getByText("computed")).toBeInTheDocument();
    expect(screen.getByText("₹49,412.50")).toBeInTheDocument();
  });

  it("names the equation in the label, so the marker does not have to be announced", () => {
    /*
     * The marker is `aria-hidden`: "computed" describes how the figure was produced, not what it is,
     * and the label is already the equation in words. A screen reader hearing "equals computed" after
     * the amount would gain nothing.
     */
    const { container } = renderWithProviders(<NetPosition formattedAmount="₹49,412.50" />);

    expect(
      screen.getByText("Net position — cash and bank minus what you owe on cards"),
    ).toBeInTheDocument();
    expect(screen.getByText("computed").closest("[aria-hidden='true']")).not.toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses the tint's own foreground token, not ink", () => {
    /*
     * `brand.muted` inverts lightness between colour modes — `tealTint` light, `darkTealTint` dark —
     * so ink on it measures 14.6:1 in one mode and 1.2:1 in the other. `content.onTint` is the token
     * that survives both.
     */
    renderWithProviders(<NetPosition formattedAmount="₹49,412.50" />);

    const label = screen.getByText("Net position — cash and bank minus what you owe on cards");
    expect(window.getComputedStyle(label).color).toBe("var(--chakra-colors-content-on-tint)");
  });
});

describe("QuickActions", () => {
  it("carries the same glyph per action as the mobile quick-add", () => {
    // One shared list, so the two affordances for the same four routes cannot show different icons.
    const { container } = renderWithProviders(<QuickActions />);

    expect(container.querySelectorAll("svg")).toHaveLength(QUICK_ADD_ACTIONS.length);
    for (const action of QUICK_ADD_ACTIONS) {
      expect(screen.getByRole("link", { name: action.label })).toHaveAttribute("href", action.href);
    }
  });

  it("is hidden below the breakpoint, where the floating button replaces it", () => {
    /*
     * `Mobile-Dashboard-Light.html` has no quick-action row: on a phone these four are the quick-add
     * button and nothing else. Asserted against the emitted stylesheet, because jsdom evaluates no
     * media queries.
     */
    renderWithProviders(<QuickActions />);

    const css = [...document.querySelectorAll("style")].map((tag) => tag.textContent).join("");
    expect(css).toMatch(/min-width:\s*48rem/);
  });
});

describe("PeopleBalances", () => {
  it("draws a directional avatar beside a direction stated in words", () => {
    /*
     * The avatar fill encodes direction — mint when they owe you, coral when you owe them — which is a
     * glance-level cue and useless to anyone who cannot see hue. So it is only ever drawn next to a
     * `BalanceBadge`, which says it.
     */
    const { container } = renderWithProviders(
      <PeopleBalances
        title="Owes you"
        subtitle="People with an outstanding balance"
        people={[person()]}
        emptyText="Nobody owes you anything right now."
      />,
    );

    const avatar = container.querySelector("[aria-hidden='true']")!;
    expect(avatar.textContent).toBe("RS");
    expect(window.getComputedStyle(avatar).background).toContain("--chakra-colors-swatch-mint");
    // And the words are on the row too.
    expect(screen.getByText(/owes you/)).toBeInTheDocument();
  });

  it("flips the fill for the other direction", () => {
    const { container } = renderWithProviders(
      <PeopleBalances
        title="You owe"
        subtitle="People you still need to pay"
        people={[
          person({
            name: "Priya Nair",
            balance: {
              direction: "user_owes_person",
              label: "you owe",
              net: { amount: "1800", currency: "INR" },
              formattedNet: "₹1,800.00",
              unsettledCount: 1,
            },
          } as Partial<PersonView>),
        ]}
        emptyText="You are square with everyone."
      />,
    );

    const avatar = container.querySelector("[aria-hidden='true']")!;
    expect(window.getComputedStyle(avatar).background).toContain("--chakra-colors-swatch-coral");
  });

  it("drops the action link when the panel is empty", () => {
    // A "See all" pointing at a list the user has no rows in is an invitation to a dead end.
    renderWithProviders(
      <PeopleBalances
        title="Owes you"
        subtitle="People with an outstanding balance"
        people={[]}
        emptyText="Nobody owes you anything right now."
      />,
    );

    expect(screen.queryByRole("link", { name: "See all" })).toBeNull();
    expect(screen.getByText("Nobody owes you anything right now.")).toBeInTheDocument();
  });
});

describe("StatusBadge — overLimit", () => {
  it("is its own kind, not a relabelled settlement state", () => {
    /*
     * It shares the butter fill and the triangle with `partSettled`, and reusing that kind with a
     * label override would have made an account condition read as a settlement state. `kind` names the
     * meaning; the label only refines it.
     */
    renderWithProviders(<StatusBadge kind="overLimit" />);
    expect(screen.getByText("Over limit")).toBeInTheDocument();
  });
});
