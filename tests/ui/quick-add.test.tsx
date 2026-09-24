import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { QuickAdd } from "@/components/layout/QuickAdd";
import { QUICK_ADD_ACTIONS } from "@/components/layout/QuickAddActions";

/**
 * The mobile quick-add button (7.7).
 *
 * In `tests/ui/` alongside `shell.test.tsx`: it is a piece of the shell, and like the two navigations
 * its correctness is mostly about the contract it keeps with something else — here the dashboard's
 * quick-action row, which offers the same four routes.
 *
 * Almost everything below is about the keyboard path, because that is the part of this component that
 * cannot be checked by looking at it. The geometry is measured in a browser instead — see the group 31
 * update document.
 *
 * `usePathname` is stubbed because `QuickAdd` closes itself on navigation.
 */

vi.mock("next/navigation", () => ({
  usePathname: () => mockPathname,
}));

let mockPathname = "/dashboard";

/** The trigger. Its accessible name is constant; `aria-expanded` carries the state. */
function fab(): HTMLElement {
  return screen.getByRole("button", { name: "Quick add" });
}

function openMenu(): void {
  fireEvent.click(fab());
}

describe("QuickAdd — the closed state", () => {
  it("offers one control and nothing else", () => {
    renderWithProviders(<QuickAdd />);

    expect(fab()).toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("reports that it is collapsed", () => {
    /*
     * Without this a screen-reader user is told "Quick add, button" and has no way to know that
     * pressing it reveals four more controls, or that they are now revealed.
     */
    renderWithProviders(<QuickAdd />);
    expect(fab()).toHaveAttribute("aria-expanded", "false");
  });

  it("draws no scrim", () => {
    // `div`, because the plus glyph inside the button is `aria-hidden` too — and should be.
    const { container } = renderWithProviders(<QuickAdd />);
    expect(container.querySelector('div[aria-hidden="true"]')).toBeNull();

    fireEvent.click(fab());
    expect(container.querySelector('div[aria-hidden="true"]')).not.toBeNull();
  });
});

describe("QuickAdd — the open state", () => {
  it("reveals the four actions", () => {
    renderWithProviders(<QuickAdd />);
    openMenu();

    for (const action of QUICK_ADD_ACTIONS) {
      expect(screen.getByRole("link", { name: action.label })).toHaveAttribute("href", action.href);
    }
  });

  it("offers exactly the actions the dashboard row offers", () => {
    /*
     * The reason `QuickAddActions.ts` exists. Two controls for the same four records previously would
     * have held two copies of the labels and routes, which is how "Pay card" in one place becomes
     * "Card payment" in the other — the terminology drift group 21 had to settle (2.7).
     */
    expect(QUICK_ADD_ACTIONS.map((action) => action.label)).toEqual([
      "Add expense",
      "Split a bill",
      "Transfer",
      "Pay card",
    ]);
    expect(QUICK_ADD_ACTIONS.filter((action) => action.primary)).toHaveLength(1);
  });

  it("stacks them outward from the button, in DOM order", () => {
    /*
     * The stack opens upward, so the visual order is the reverse of the dashboard's. It is produced by
     * reversing the array rather than by `flex-direction: column-reverse`, so DOM order still equals
     * visual order — which is the order `Tab` follows (WCAG 2.4.3).
     */
    renderWithProviders(<QuickAdd />);
    openMenu();

    expect(screen.getAllByRole("link").map((link) => link.textContent)).toEqual([
      "Pay card",
      "Transfer",
      "Split a bill",
      "Add expense",
    ]);
  });

  it("reports that it is expanded, and says which group it controls", () => {
    renderWithProviders(<QuickAdd />);
    openMenu();

    const group = screen.getByRole("group", { name: "Quick add" });
    expect(fab()).toHaveAttribute("aria-expanded", "true");
    expect(fab()).toHaveAttribute("aria-controls", group.id);
  });

  it("does not announce the scrim", () => {
    // It is a pointer affordance. Escape is the keyboard path, and the button is the real control.
    renderWithProviders(<QuickAdd />);
    openMenu();

    expect(screen.getByRole("group", { name: "Quick add" })).toBeInTheDocument();
    // Four action links and no fifth "close" control that only a mouse could find.
    expect(screen.getAllByRole("link")).toHaveLength(4);
    expect(screen.getAllByRole("button")).toHaveLength(1);
  });

  it("rotates the plus instead of swapping it for a close glyph", () => {
    // One control changing state, rather than two controls in the same place.
    const { container } = renderWithProviders(<QuickAdd />);

    const glyphBox = () => container.querySelector("button > span") as HTMLElement;
    expect(window.getComputedStyle(glyphBox()).transform).toBe("rotate(0deg)");

    openMenu();
    expect(window.getComputedStyle(glyphBox()).transform).toBe("rotate(45deg)");
  });
});

describe("QuickAdd — the keyboard path", () => {
  it("moves focus to the action nearest the button", () => {
    /*
     * Not the first link, which is the conventional menu behaviour: in an upward stack the first link
     * is the furthest from the thumb and the least likely action. Focus should land where the eye does.
     */
    renderWithProviders(<QuickAdd />);
    openMenu();

    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Add expense" }));
  });

  it("closes on Escape and gives focus back to the button", () => {
    renderWithProviders(<QuickAdd />);
    openMenu();

    fireEvent.keyDown(document.activeElement!, { key: "Escape" });

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    expect(document.activeElement).toBe(fab());
  });

  it("keeps Tab inside the layer", () => {
    /*
     * A hand-rolled trap over five elements. The cycle is visual order top to bottom, then the button:
     * Pay card, Transfer, Split a bill, Add expense, Quick add, and round again.
     */
    renderWithProviders(<QuickAdd />);
    openMenu();

    const order = ["Pay card", "Transfer", "Split a bill", "Add expense"];

    // Focus starts on the last link; one Tab reaches the button, a second wraps to the first link.
    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(fab());

    fireEvent.keyDown(document.activeElement!, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: order[0] }));

    for (const label of order.slice(1)) {
      fireEvent.keyDown(document.activeElement!, { key: "Tab" });
      expect(document.activeElement, label).toBe(screen.getByRole("link", { name: label }));
    }
  });

  it("cycles backwards on Shift+Tab", () => {
    renderWithProviders(<QuickAdd />);
    openMenu();

    // From "Add expense" back through the stack.
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Split a bill" }));

    // And from the first link it wraps round to the button, not out of the layer.
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByRole("link", { name: "Pay card" }));

    fireEvent.keyDown(document.activeElement!, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(fab());
  });

  it("closes again when pressed a second time", () => {
    renderWithProviders(<QuickAdd />);
    openMenu();
    openMenu();

    expect(fab()).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });
});

describe("QuickAdd — mounting", () => {
  it("closes itself on navigation", () => {
    /*
     * It lives in the shell, so a client-side route change does not unmount it. Without this, tapping
     * a pill would navigate and leave the menu and its scrim sitting over the new page.
     */
    mockPathname = "/dashboard";
    const { rerender } = renderWithProviders(<QuickAdd />);
    openMenu();
    expect(screen.getAllByRole("link")).toHaveLength(4);

    mockPathname = "/transactions/new";
    rerender(<QuickAdd />);

    expect(screen.queryAllByRole("link")).toHaveLength(0);
    mockPathname = "/dashboard";
  });

  it("does not take focus when navigation closes it", () => {
    // `close()` returns focus to the button; doing that here would steal it from the new page.
    mockPathname = "/dashboard";
    const { rerender } = renderWithProviders(<QuickAdd />);
    openMenu();

    mockPathname = "/transactions/new";
    rerender(<QuickAdd />);

    expect(document.activeElement).not.toBe(fab());
    mockPathname = "/dashboard";
  });

  it("is a phone-only control", () => {
    /*
     * Above `md` the same four actions are already a row on the dashboard and the header carries the
     * navigation, so a floating button would be a third route to the same four pages.
     *
     * Asserted against the emitted stylesheet, because jsdom evaluates no media queries — the same
     * technique `shell.test.tsx` uses for the safe-area inset.
     */
    renderWithProviders(<QuickAdd />);

    const css = [...document.querySelectorAll("style")].map((tag) => tag.textContent).join("");
    expect(css).toMatch(/min-width:\s*48rem/);
    expect(css).toContain("display:none");
  });

  it("reserves room for itself above the tab bar and the home indicator", () => {
    // 84px in the artboard over a 64px bar; the bar grows by the inset, so this has to as well.
    const { container } = renderWithProviders(<QuickAdd />);

    const layer = container.querySelector("[style], div > div") as HTMLElement;
    expect(layer).toBeTruthy();

    const css = [...document.querySelectorAll("style")].map((tag) => tag.textContent).join("");
    expect(css).toContain("calc(84px + env(safe-area-inset-bottom))");
  });

  it("sits below the tab bar when closed and above it when open", () => {
    /*
     * 7.7 wants the button above the page and below the tab bar's border. But an open menu traps
     * focus, so leaving the bar bright and one tap away would be an inconsistency: unreachable by
     * keyboard, reachable by thumb. Open, the whole layer clears it.
     */
    const { container } = renderWithProviders(<QuickAdd />);
    const layer = container.firstElementChild!.firstElementChild as HTMLElement;

    expect(window.getComputedStyle(layer).zIndex).toBe("var(--chakra-z-index-docked)");

    openMenu();
    expect(window.getComputedStyle(layer).zIndex).toBe("var(--chakra-z-index-overlay)");
  });
});
