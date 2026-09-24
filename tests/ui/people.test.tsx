import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { Stamp } from "@/components/ui/Stamp";
import { PersonList } from "@/features/people/components/PersonList";
import { PersonObligationList } from "@/features/people/components/PersonObligationList";
import type { ObligationView, PersonView } from "@/features/people/view-models/person-view-model";

/**
 * People and settlements (group 38; `design/ony/screens/SettleUp-Light.html` for the settle screen).
 *
 * The settle-up geometry and the `BALANCED` stamp are measured in a browser — the group 38 update
 * document has the numbers. What is here is the rule the whole feature turns on: **direction is always
 * in words**, and the stamp is never the only thing saying so.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/people" }));

function person(overrides: Partial<PersonView> = {}): PersonView {
  return {
    id: "65f1a2b3c4d5e6f708192a3b",
    clientId: "person-1",
    name: "Ravi Shankar",
    initials: "RS",
    notes: null,
    isArchived: false,
    archivedAt: null,
    syncVersion: 1,
    balance: {
      currency: "INR",
      direction: "person_owes_user",
      label: "owes you",
      net: { amount: "1600", currency: "INR" },
      netAbsolute: { amount: "1600", currency: "INR" },
      formattedNet: "₹1,600.00",
      personOwesUser: { amount: "1600", currency: "INR" },
      userOwesPerson: { amount: "0", currency: "INR" },
      isSettled: false,
      unsettledCount: 1,
    },
    ...overrides,
  } as PersonView;
}

function obligation(overrides: Partial<ObligationView> = {}): ObligationView {
  return {
    expenseSplitId: "s".repeat(24),
    transactionId: "t".repeat(24),
    description: "Team dinner at Toit",
    date: "2026-09-18T10:00:00.000Z",
    dateLabel: "18 Sept 2026",
    direction: "person_owes_user",
    directionLabel: "owes you",
    originalAmount: { amount: "1600", currency: "INR" },
    remainingAmount: { amount: "1600", currency: "INR" },
    formattedOriginal: "₹1,600.00",
    formattedRemaining: "₹1,600.00",
    status: "unsettled",
    statusLabel: "Unsettled",
    ...overrides,
  } as ObligationView;
}

describe("PersonList", () => {
  it("states direction in words beside the directional avatar", () => {
    /*
     * The avatar fill is mint for "owes you" and coral for "you owe", which is a glance-level cue and
     * useless to anyone who cannot see hue. `BalanceBadge` is what makes it legible.
     */
    renderWithProviders(<PersonList people={[person()]} />);

    expect(screen.getByText("Ravi Shankar")).toBeInTheDocument();
    expect(screen.getByText(/owes you/)).toBeInTheDocument();
  });

  it("uses a square avatar, because nothing in this design is round", () => {
    // It was a `Circle`. Section 5.1 has no exceptions.
    const { container } = renderWithProviders(<PersonList people={[person()]} />);

    const avatar = container.querySelector("[aria-hidden='true']")!;
    expect(avatar.textContent).toBe("RS");
    expect(window.getComputedStyle(avatar).borderRadius).not.toMatch(/50%|9999/);
  });

  it("sorts whoever needs settling to the top, and settled contacts last", () => {
    const settled = person({
      id: "b".repeat(24),
      name: "Anita",
      balance: {
        currency: "INR",
        direction: "settled",
        label: "settled up",
        net: { amount: "0", currency: "INR" },
        netAbsolute: { amount: "0", currency: "INR" },
        formattedNet: "₹0.00",
        personOwesUser: { amount: "0", currency: "INR" },
        userOwesPerson: { amount: "0", currency: "INR" },
        isSettled: true,
        unsettledCount: 0,
      },
    } as Partial<PersonView>);

    renderWithProviders(<PersonList people={[settled, person()]} />);

    const names = screen.getAllByRole("link").map((link) => link.textContent);
    expect(names[0]).toContain("Ravi Shankar");
    expect(names[1]).toContain("Anita");
  });

  it("badges an archived person", () => {
    renderWithProviders(<PersonList people={[person({ isArchived: true })]} />);
    expect(screen.getByText("Archived")).toBeInTheDocument();
  });
});

describe("PersonObligationList", () => {
  it("does not badge the default state", () => {
    /*
     * Every row in the "unsettled expenses" card is unsettled. A chip on each one is a column of
     * identical badges — the same rule the activity list follows for a plain personal expense.
     */
    renderWithProviders(<PersonObligationList obligations={[obligation()]} />);
    expect(screen.queryByText("Unsettled")).toBeNull();
  });

  it("badges the two states worth calling out", () => {
    renderWithProviders(
      <PersonObligationList
        obligations={[
          obligation({ status: "settled", statusLabel: "Settled" }),
          obligation({
            expenseSplitId: "x".repeat(24),
            status: "partially_settled",
            statusLabel: "Part settled",
            formattedRemaining: "₹600.00",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Settled")).toBeInTheDocument();
    expect(screen.getByText("Part settled")).toBeInTheDocument();
  });

  it("keeps the share-of-total treatment on a part-settled share", () => {
    renderWithProviders(
      <PersonObligationList
        obligations={[
          obligation({
            status: "partially_settled",
            statusLabel: "Part settled",
            formattedRemaining: "₹600.00",
          }),
        ]}
      />,
    );

    expect(screen.getByText("₹600.00")).toBeInTheDocument();
    expect(screen.getByText(/of ₹1,600.00/)).toBeInTheDocument();
  });

  it("states direction in words on every row", () => {
    renderWithProviders(<PersonObligationList obligations={[obligation()]} />);
    expect(screen.getByText(/18 Sept 2026 · owes you/)).toBeInTheDocument();
  });
});

describe("Stamp", () => {
  it("is hidden from assistive technology by default", () => {
    /*
     * The rule the component exists to enforce (5.4): a stamp is never the only carrier of its message.
     * On both screens that use it, the figure or sentence beside it already proves the claim.
     */
    const { container } = renderWithProviders(<Stamp label="Balanced" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("is dashed, rotated and positive-toned", () => {
    const { container } = renderWithProviders(<Stamp label="Balanced" />);

    const styles = window.getComputedStyle(container.firstElementChild!);
    expect(styles.borderStyle).toBe("dashed");
    expect(styles.transform).toBe("rotate(-7deg)");
    expect(styles.color).toBe("var(--chakra-colors-positive)");
  });

  it("has no error tone to reach for", () => {
    /*
     * Asserted as a type-level fact by omission: `StampTone` is `positive | neutral`. An unbalanced
     * settle-up uses an `Alert`, because a rotated dashed stamp makes a blocking error look ornamental.
     */
    renderWithProviders(<Stamp label="Balanced" tone="neutral" />);
    expect(screen.getByText("Balanced")).toBeInTheDocument();
  });
});
