import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { CATEGORY_ICON_CHOICES } from "@/features/categories/icon-map";
import { CategoryIconPicker } from "@/features/categories/components/CategoryIconPicker";

/**
 * The category icon picker (group 39; group 21 decision 2.3).
 *
 * The screen itself is measured in a browser — the group 39 update document has the numbers. What is
 * here is the accessibility contract, because a grid of tiles is the shape this pattern is usually
 * broken in.
 */

vi.mock("next/navigation", () => ({ usePathname: () => "/categories" }));

describe("CategoryIconPicker", () => {
  it("is a real radio group with a name", () => {
    /*
     * One tab stop, arrow keys between options, and an accessible name — all three come free from
     * `role="radiogroup"` plus native radios. A grid of buttons would have to reimplement the roving
     * tabindex, and that is the part that usually goes wrong.
     */
    renderWithProviders(<CategoryIconPicker id="category-icon" />);

    const group = screen.getByRole("radiogroup", { name: "Icon" });
    expect(group).toBeInTheDocument();
    expect(screen.getAllByRole("radio")).toHaveLength(CATEGORY_ICON_CHOICES.length);
  });

  it("keeps the inputs reachable rather than removing them", () => {
    /*
     * `display: none` would take the radios out of the accessibility tree and off the keyboard, which
     * is the usual way a custom-styled radio set is broken. They are positioned and transparent
     * instead.
     */
    renderWithProviders(<CategoryIconPicker id="category-icon" />);

    for (const radio of screen.getAllByRole("radio")) {
      const styles = window.getComputedStyle(radio);
      expect(styles.display).not.toBe("none");
      expect(styles.visibility).not.toBe("hidden");
    }
  });

  it("carries the peer class the tile's focus ring depends on", () => {
    /*
     * The only link between the focused control and the visible one.
     *
     * The radio is transparent and 1px; the tile a user sees is a sibling `div` that cannot be
     * focused. Chakra resolves the tile's `_peerFocusVisible` to
     * `.peer:is(:focus-visible, [data-focus-visible]) ~ &`, so **the class is the mechanism** — drop
     * it and the picker silently has no focus indicator at all, which is exactly what group 40 found.
     *
     * jsdom computes no shadows, so the ring itself is asserted in `tests/e2e/focus-visible.spec.ts`.
     * This guards the half that is easy to delete by accident.
     */
    renderWithProviders(<CategoryIconPicker id="category-icon" />);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveClass("peer");
    }
  });

  it("submits under the field name the schema already accepts", () => {
    // `Category.icon` existed as free text before this picker; nothing in the data model changed.
    renderWithProviders(<CategoryIconPicker id="category-icon" />);

    for (const radio of screen.getAllByRole("radio")) {
      expect(radio).toHaveAttribute("name", "icon");
    }
  });

  it("selects nothing for a new category", () => {
    // A new category has no icon yet, and pre-selecting one would be a choice made on the user's behalf.
    renderWithProviders(<CategoryIconPicker id="category-icon" />);
    expect(
      screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked),
    ).toHaveLength(0);
  });

  it("pre-selects the category's stored icon", () => {
    renderWithProviders(<CategoryIconPicker id="category-icon" defaultValue="receipt" />);

    const checked = screen
      .getAllByRole("radio")
      .filter((radio) => (radio as HTMLInputElement).checked);
    expect(checked).toHaveLength(1);
    expect(checked[0]).toHaveAttribute("value", "receipt");
  });

  it("keeps an unoffered stored icon rather than rewriting it", () => {
    /*
     * A name from before this picker existed, or one the registry renamed. Showing it as unselected is
     * honest; silently switching the stored value to the fallback would change data the user never
     * touched.
     */
    renderWithProviders(<CategoryIconPicker id="category-icon" defaultValue="heart-pulse" />);

    expect(
      screen.getAllByRole("radio").filter((radio) => (radio as HTMLInputElement).checked),
    ).toHaveLength(0);
  });

  it("says the colour is not a choice", () => {
    /*
     * Group 21 rejected a `Category.color` field: the colour is derived from the id by a hash, so it is
     * stable across renames and cannot be got wrong. The hint stops a user hunting for a colour picker.
     */
    renderWithProviders(<CategoryIconPicker id="category-icon" />);
    expect(screen.getByText(/colour is chosen for you/)).toBeInTheDocument();
  });
});
