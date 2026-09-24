import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { FormLayout, ReferenceBox, TintPanel } from "@/components/ui/FormLayout";
import { FormSwitcher } from "@/features/transactions/components/FormSwitcher";
import { QUICK_ADD_ACTIONS } from "@/components/layout/QuickAddActions";

/**
 * The transaction-form shell (group 36; `design/ux/screens/AddExpense-Light.html`).
 *
 * Geometry is measured in a browser — the group 36 update document has the numbers. What is here is
 * the source order the mobile layout depends on, the tint panel's foreground token, and the switcher's
 * one deliberate label exception.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/transactions/new" }));

describe("FormLayout", () => {
  it("puts the rail after the form in source order", () => {
    /*
     * Section 8 stacks the rail **below** the form on a phone, and this is how: source order, not an
     * `order` property. A user who opened this screen to record a ₹220 coffee should reach the amount
     * field without scrolling past a paragraph — and the keyboard and a screen reader get the same
     * sequence the pixels do, which `order` would have broken.
     */
    const { container } = renderWithProviders(
      <FormLayout rail={<div data-testid="rail">rail</div>}>
        <form data-testid="form" />
      </FormLayout>,
    );

    const html = container.innerHTML;
    expect(html.indexOf('data-testid="form"')).toBeLessThan(html.indexOf('data-testid="rail"'));
  });

  it("emphasises the form card, because the form is the subject of the page", () => {
    const { container } = renderWithProviders(
      <FormLayout>
        <form />
      </FormLayout>,
    );

    const card = container.querySelector("form")!.parentElement!.parentElement!;
    const styles = window.getComputedStyle(card);
    expect(styles.boxShadow).toBe("var(--chakra-shadows-hard-lg)");
    expect(styles.borderWidth).toBe("var(--chakra-border-widths-thick)");
  });

  it("renders no rail at all when there is nothing to put in it", () => {
    // The edit screens have nothing to explain that the create screens have not. A rail holding one
    // empty panel is worse than no rail.
    const { container } = renderWithProviders(
      <FormLayout>
        <form />
      </FormLayout>,
    );

    const layout = container.firstElementChild!;
    expect(layout.children).toHaveLength(1);
  });
});

describe("TintPanel", () => {
  it("uses the tint's own foreground token, never ink", () => {
    /*
     * `brand.muted` inverts lightness between colour modes — `tealTint` light, `darkTealTint` dark — so
     * ink on it measures 14.6:1 in one mode and 1.2:1 in the other. This is the mistake group 28 wrote
     * down as "a tint is not a swatch".
     */
    renderWithProviders(<TintPanel eyebrow="Why this matters">Amount is first.</TintPanel>);

    const body = screen.getByText("Amount is first.");
    expect(window.getComputedStyle(body).color).toBe("var(--chakra-colors-content-on-tint)");
  });

  it("drops the eyebrow when the surrounding card already says what is being explained", () => {
    // How the transfer and card-payment detail pages use it.
    const { container } = renderWithProviders(<TintPanel>Not spending.</TintPanel>);

    expect(screen.getByText("Not spending.")).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeNull();
  });
});

describe("ReferenceBox", () => {
  it("explains what the code is, which nothing else in the app does", () => {
    renderWithProviders(<ReferenceBox code="#E933A" hint="Kept for the life of the record." />);

    expect(screen.getByText("Reference")).toBeInTheDocument();
    expect(screen.getByText("#E933A")).toBeInTheDocument();
    expect(screen.getByText("Kept for the life of the record.")).toBeInTheDocument();
  });

  it("marks an unsaved record as a draft", () => {
    renderWithProviders(<ReferenceBox code="#E933A" draft hint="Kept for the life." />);
    expect(screen.getByText("#E933A · draft")).toBeInTheDocument();
  });

  it("renders nothing without a code", () => {
    const { container } = renderWithProviders(<ReferenceBox code={null} hint="Anything." />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("FormSwitcher", () => {
  it("offers the other three record types, never the current one", () => {
    /*
     * The failure mode it exists for: someone has started typing an expense and realises it was a
     * transfer. They must be able to say so without going back to a menu.
     */
    renderWithProviders(<FormSwitcher current="/transactions/new" />);

    expect(screen.queryByRole("link", { name: /Add expense/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Split instead/ })).toHaveAttribute(
      "href",
      "/transactions/new/shared",
    );
    expect(screen.getByRole("link", { name: /Transfer/ })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Pay card/ })).toBeInTheDocument();
  });

  it('says "Split instead", the one place the action label changes', () => {
    /*
     * Group 21 settled this (2.7). In a header beside a form already begun, "instead" is the whole
     * point of the control; on a dashboard with nothing in progress there is no "instead". The
     * exception is named here rather than being a free hand to reword any of them.
     */
    renderWithProviders(<FormSwitcher current="/transactions/new/transfer" />);

    expect(screen.getByRole("link", { name: /Split instead/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Split a bill/ })).toBeNull();
    // And the dashboard's wording is untouched.
    expect(QUICK_ADD_ACTIONS.find((action) => action.href.endsWith("/shared"))?.label).toBe(
      "Split a bill",
    );
  });

  it("carries the same glyph per action as every other route to these four", () => {
    const { container } = renderWithProviders(<FormSwitcher current="/transactions/new" />);
    expect(container.querySelectorAll("svg")).toHaveLength(QUICK_ADD_ACTIONS.length - 1);
  });
});
