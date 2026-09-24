import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { BackLink } from "./BackLink";

/**
 * The upward affordance the app spent its whole life without.
 *
 * Two of these assertions are the point of the component rather than details of it:
 *
 *  - **It is an anchor with an `href`.** A button calling `router.back()` would look identical and
 *    behave differently on a cold URL, which is the defect this primitive replaces
 *    (`docs/navigation-tasks/01-NAVIGATION-AUDIT.md` section 4.3). Asserting the role and the
 *    attribute is what stops someone "simplifying" it back into a history call.
 *  - **The accessible name names the destination.** "Accounts" alone does not say it goes anywhere,
 *    and a screen-reader user hearing a list of links gets no spatial context from the page.
 */

describe("BackLink", () => {
  it("renders a link, not a button", () => {
    renderWithProviders(<BackLink href="/accounts" label="Accounts" />);

    const link = screen.getByRole("link", { name: "Back to Accounts" });
    expect(link).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("points at the href it was given", () => {
    renderWithProviders(<BackLink href="/people/abc123" label="Priya Menon" />);

    expect(screen.getByRole("link", { name: "Back to Priya Menon" })).toHaveAttribute(
      "href",
      "/people/abc123",
    );
  });

  it("names the destination in its accessible name", () => {
    renderWithProviders(<BackLink href="/transactions" label="Activity" />);

    // Not just "Back", and not just "Activity".
    expect(screen.getByRole("link", { name: "Back to Activity" })).toBeInTheDocument();
  });

  it("shows the bare destination name on screen", () => {
    /*
     * WCAG 2.5.3 Label in Name: the visible string has to be contained in the accessible name, so a
     * speech-input user saying "click Accounts" activates it. Visible "Accounts" inside "Back to
     * Accounts" satisfies it; the reverse — visible "Back", name "Accounts" — would not.
     */
    renderWithProviders(<BackLink href="/accounts" label="Accounts" />);

    const link = screen.getByRole("link", { name: "Back to Accounts" });
    expect(link).toHaveTextContent("Accounts");
    expect(link).not.toHaveTextContent("Back to");
  });

  it("hides the chevron from assistive technology", () => {
    // The glyph repeats what the accessible name already says.
    const { container } = renderWithProviders(<BackLink href="/accounts" label="Accounts" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("aria-hidden", "true");
  });
});
