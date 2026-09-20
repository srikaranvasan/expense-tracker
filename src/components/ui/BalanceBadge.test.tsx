import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { BalanceBadge } from "./BalanceBadge";

describe("BalanceBadge", () => {
  it("states the direction in words, not only in colour", () => {
    renderWithProviders(
      <BalanceBadge direction="person_owes_user" formattedAmount="₹450.00" label="owes you" />,
    );

    expect(screen.getByText("₹450.00")).toBeInTheDocument();
    // The direction must survive for a colour-blind or screen-reader user.
    expect(screen.getByText("owes you")).toBeInTheDocument();
  });

  it("distinguishes the two directions by their label", () => {
    const { unmount } = renderWithProviders(
      <BalanceBadge direction="user_owes_person" formattedAmount="₹450.00" label="you owe" />,
    );
    expect(screen.getByText("you owe")).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <BalanceBadge direction="person_owes_user" formattedAmount="₹450.00" label="owes you" />,
    );
    expect(screen.getByText("owes you")).toBeInTheDocument();
  });

  it("shows a settled state without an amount", () => {
    renderWithProviders(
      <BalanceBadge direction="settled" formattedAmount="₹0.00" label="settled up" />,
    );

    expect(screen.getByText("Settled up")).toBeInTheDocument();
    expect(screen.queryByText("₹0.00")).not.toBeInTheDocument();
  });
});
