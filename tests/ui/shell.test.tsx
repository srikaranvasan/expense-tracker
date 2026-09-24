import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { BottomNav } from "@/components/layout/BottomNav";
import { DiamondMark } from "@/components/layout/DiamondMark";
import { HeaderNav } from "@/components/layout/HeaderNav";
import { NAV_ITEMS, isActiveNavItem } from "@/components/layout/NavItems";
import { PageHeader } from "@/components/layout/PageHeader";

/**
 * The application shell.
 *
 * In `tests/ui/` because the pieces span `components/layout` and only make sense together — the
 * desktop nav and the bottom tab bar are one navigation shown two ways, and what is worth asserting is
 * that they agree.
 *
 * `usePathname` is stubbed per test: both nav components are Client Components whose entire
 * active-state logic depends on it.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

let mockPathname = "/dashboard";

describe("navigation items", () => {
  it("are shared by both navigations", () => {
    /*
     * The desktop header and the bottom tab bar previously held separate copies of this list, which
     * meant the order, the labels and (once icons existed) the glyphs could drift apart. One module,
     * two consumers.
     */
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      "Home",
      "Activity",
      "Accounts",
      "People",
      "Categories",
    ]);
  });

  it("marks a section active from anywhere inside it", () => {
    // A user three levels into Accounts should still be able to see which section they are in.
    expect(isActiveNavItem("/accounts", "/accounts")).toBe(true);
    expect(isActiveNavItem("/accounts/abc", "/accounts")).toBe(true);
    expect(isActiveNavItem("/accounts/abc/edit", "/accounts")).toBe(true);
  });

  it("does not match a different route that merely starts the same", () => {
    // The trailing slash in the prefix check is what makes this true.
    expect(isActiveNavItem("/peoplesomething", "/people")).toBe(false);
    expect(isActiveNavItem("/transactions", "/transactions/new")).toBe(false);
  });
});

describe("HeaderNav", () => {
  it("renders every destination as a link with an icon", () => {
    mockPathname = "/dashboard";
    const { container } = renderWithProviders(<HeaderNav />);

    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
    // One decorative glyph per link.
    expect(container.querySelectorAll("svg")).toHaveLength(NAV_ITEMS.length);
  });

  it("marks the current section for assistive technology, not only in colour", () => {
    /*
     * `aria-current="page"` is the point. The teal underline and the weight change are visual;
     * without this, a screen-reader user has no way to know where they are.
     */
    mockPathname = "/accounts/abc";
    renderWithProviders(<HeaderNav />);

    expect(screen.getByRole("link", { name: "Accounts" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
  });

  it("reserves the underline space on every item", () => {
    /*
     * Transparent rather than absent. If only the active item had a 3px border, every label would
     * shift up by 3px as navigation moved the active item — a jolt on every page change.
     */
    mockPathname = "/dashboard";
    renderWithProviders(<HeaderNav />);

    for (const item of NAV_ITEMS) {
      const link = screen.getByRole("link", { name: item.label });
      expect(window.getComputedStyle(link).borderBottomWidth, item.label).toBe(
        "var(--chakra-border-widths-accent)",
      );
    }
  });

  it("names the navigation, so a screen reader can distinguish it from the tab bar", () => {
    mockPathname = "/dashboard";
    renderWithProviders(<HeaderNav />);
    expect(screen.getByRole("navigation", { name: "Primary" })).toBeInTheDocument();
  });
});

describe("BottomNav", () => {
  it("renders the same destinations as the header", () => {
    mockPathname = "/dashboard";
    renderWithProviders(<BottomNav />);

    for (const item of NAV_ITEMS) {
      expect(screen.getByRole("link", { name: item.label })).toHaveAttribute("href", item.href);
    }
  });

  it("marks the current section for assistive technology", () => {
    mockPathname = "/people/abc";
    renderWithProviders(<BottomNav />);

    expect(screen.getByRole("link", { name: "People" })).toHaveAttribute("aria-current", "page");
  });

  it("uses the same underline idiom as the desktop nav", () => {
    // One active-state idiom at both widths rather than two.
    mockPathname = "/dashboard";
    renderWithProviders(<BottomNav />);

    const active = screen.getByRole("link", { name: "Home" });
    expect(window.getComputedStyle(active).borderBottomWidth).toBe(
      "var(--chakra-border-widths-accent)",
    );
  });

  it("keeps every tab a comfortable touch target", () => {
    mockPathname = "/dashboard";
    renderWithProviders(<BottomNav />);

    for (const item of NAV_ITEMS) {
      const link = screen.getByRole("link", { name: item.label });
      expect(window.getComputedStyle(link).minHeight, item.label).toBe("var(--chakra-sizes-touch)");
    }
  });

  it("respects the iPhone home-indicator inset", () => {
    /*
     * Without this the last 20px of the bar sits under the home indicator and is unreachable.
     *
     * Asserted against the emitted stylesheet rather than a computed value: jsdom cannot parse
     * `env()`, so `getComputedStyle` reports an empty string whether the declaration is there or not.
     * This at least proves it was emitted; whether the phone honours it is a device question.
     */
    mockPathname = "/dashboard";
    renderWithProviders(<BottomNav />);

    const css = [...document.querySelectorAll("style")].map((tag) => tag.textContent).join("");
    expect(css).toContain("env(safe-area-inset-bottom)");
  });

  it("gives the tab bar a distinct accessible name", () => {
    mockPathname = "/dashboard";
    renderWithProviders(<BottomNav />);
    expect(screen.getByRole("navigation", { name: "Main" })).toBeInTheDocument();
  });
});

describe("PageHeader", () => {
  it("renders the title as the page's h1", () => {
    renderWithProviders(<PageHeader title="Accounts" />);
    expect(screen.getByRole("heading", { level: 1, name: "Accounts" })).toBeInTheDocument();
  });

  it("stacks the title and its action below 768px", () => {
    /*
     * Half the fix for the crushed-title bug (9.2). At 402px a title sharing a row with "Record
     * shared expense" was left about 150px and wrapped to one word per line.
     *
     * jsdom does not evaluate media queries, so this asserts the responsive declaration reaches the
     * element. The layout itself is measured in a browser — see the group 30 update document.
     *
     * ## Why this no longer reads `container.firstElementChild`
     *
     * Group 44 wrapped the component in an outer `Stack` to hold the optional `parent` back link, so
     * the first child is now that wrapper — which is a column at *every* width. Asserting on it would
     * have kept passing while saying nothing, which is the worst outcome for a regression test
     * guarding a bug fix.
     *
     * The title row is now found through the heading, which is what the assertion is actually about.
     */
    renderWithProviders(
      <PageHeader title="Record shared expense" action={<button type="button">Add</button>} />,
    );

    // heading → the `Box minW="0"` that holds title and description → the title row itself.
    const titleRow = screen.getByRole("heading", { level: 1 }).parentElement!.parentElement!;

    // jsdom evaluates no media queries, so it reports the `base` value — which is the mobile one, and
    // is exactly the half of the pair that fixes the bug. The desktop row is measured in a browser;
    // see the group 30 update document.
    expect(window.getComputedStyle(titleRow).flexDirection).toBe("column");
  });

  it("has no parent link unless one is given", () => {
    // The five nav destinations and the two boundary screens genuinely have no parent.
    renderWithProviders(<PageHeader title="Accounts" />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("renders a parent link above the title when given one", () => {
    renderWithProviders(
      <PageHeader title="HDFC Savings" parent={{ href: "/accounts", label: "Accounts" }} />,
    );

    expect(screen.getByRole("link", { name: "Back to Accounts" })).toHaveAttribute(
      "href",
      "/accounts",
    );
  });

  it("puts the parent link before the h1 in reading order", () => {
    /*
     * The reason `parent` is rendered inside the `header` element rather than above it: a
     * screen-reader user should reach "Back to Accounts" as part of the page's header landmark, and
     * before the heading that names the page.
     */
    renderWithProviders(
      <PageHeader title="HDFC Savings" parent={{ href: "/accounts", label: "Accounts" }} />,
    );

    const link = screen.getByRole("link", { name: "Back to Accounts" });
    const heading = screen.getByRole("heading", { level: 1 });

    expect(link.compareDocumentPosition(heading) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("keeps the parent link inside the header landmark", () => {
    const { container } = renderWithProviders(
      <PageHeader title="HDFC Savings" parent={{ href: "/accounts", label: "Accounts" }} />,
    );

    const header = container.querySelector("header");
    expect(header).toContainElement(screen.getByRole("link", { name: "Back to Accounts" }));
  });

  it("still aligns meta and action to the title row when there is a parent", () => {
    /*
     * The parent link is a sibling of the title row, not a child of it. If it were inside the row's
     * first item, desktop `align="baseline"` would align `meta` to the back link's baseline instead of
     * the title's — a visible 20px drop on the dashboard. Asserting the structure is what prevents
     * someone flattening it.
     */
    renderWithProviders(
      <PageHeader
        title="Dashboard"
        parent={{ href: "/accounts", label: "Accounts" }}
        meta={<span>As of 21 Sep 2026</span>}
      />,
    );

    const titleRow = screen.getByRole("heading", { level: 1 }).parentElement!.parentElement!;
    const link = screen.getByRole("link", { name: "Back to Accounts" });

    expect(titleRow).toContainElement(screen.getByText("As of 21 Sep 2026"));
    expect(titleRow).not.toContainElement(link);
  });

  it("keeps the meta slot separate from the action slot", () => {
    /*
     * The dashboard's AS OF eyebrow is a render timestamp, not a control. Putting it where a button
     * goes would make it look like one.
     */
    renderWithProviders(
      <PageHeader
        title="Dashboard"
        meta={<span>As of 21 Sep 2026</span>}
        action={<button type="button">Add</button>}
      />,
    );

    expect(screen.getByText("As of 21 Sep 2026")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add" })).toBeInTheDocument();
  });

  it("renders a description when there is one", () => {
    renderWithProviders(
      <PageHeader title="Activity" description="Everything you have recorded." />,
    );
    expect(screen.getByText("Everything you have recorded.")).toBeInTheDocument();
  });
});

describe("DiamondMark", () => {
  it("is a rotated square, not an image", () => {
    // No path data to get wrong, and it inherits the palette tokens so it flips with the colour mode.
    const { container } = renderWithProviders(<DiamondMark />);

    const styles = window.getComputedStyle(container.firstElementChild!);
    expect(styles.transform).toBe("rotate(45deg)");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("is hidden from assistive technology", () => {
    // The application name is always rendered beside it.
    const { container } = renderWithProviders(<DiamondMark />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("thins its border at the small size", () => {
    // A 2px border on an 8px square is a quarter of it: the shape stops reading as a diamond.
    const small = renderWithProviders(<DiamondMark size="sm" />);
    expect(window.getComputedStyle(small.container.firstElementChild!).borderWidth).toBe(
      "var(--chakra-border-widths-hairline)",
    );
    small.unmount();

    const large = renderWithProviders(<DiamondMark size="lg" />);
    expect(window.getComputedStyle(large.container.firstElementChild!).borderWidth).toBe(
      "var(--chakra-border-widths-thick)",
    );
  });
});
