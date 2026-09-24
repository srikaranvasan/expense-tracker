import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { Icon } from "./Icon";
import { ICON_NAMES } from "./names";
import { ICONS, ICON_VIEWBOX } from "./registry";

/**
 * The glyphs as *drawings*, and the component that renders them.
 *
 * In the `ui` project because the registry is JSX; the name vocabulary and the three resolvers
 * are tested in `names.test.ts`, which needs no DOM.
 *
 * Whether a glyph looks right is a question for a designer. What a test can hold is the set of
 * invariants that make 42 hand-transcribed drawings behave like one coherent set — which is
 * exactly what breaks silently when a 43rd is added in a hurry.
 */

describe("glyph geometry", () => {
  it.each(ICON_NAMES)("%s has a stroke weight in the 1.2-2 range", (name) => {
    // Tuned per glyph and deliberately not normalised, but outside this range a glyph stops
    // belonging to the set: below 1.2 it disappears at 11px inside a category swatch, above 2 it
    // reads as a different family.
    expect(ICONS[name].stroke).toBeGreaterThanOrEqual(1.2);
    expect(ICONS[name].stroke).toBeLessThanOrEqual(2);
  });

  it.each(ICON_NAMES)("%s has something to draw", (name) => {
    expect(ICONS[name].children).toBeTruthy();
  });

  it("draws every glyph in the same 16-unit box", () => {
    /*
     * The invariant that makes the per-glyph `stroke` numbers comparable at all. `<Icon>` scales
     * the viewBox to the requested pixel size, so a glyph in a 12x8 box is scaled twice as much
     * as a 16-unit one and its nominal weight paints twice as heavy. The handoff specifies
     * `0 0 12 8` for `chevron-down`; that was not carried over, for exactly this reason.
     */
    expect(ICON_VIEWBOX).toBe("0 0 16 16");

    const { container } = renderWithProviders(
      <>
        {ICON_NAMES.map((name) => (
          <Icon key={name} name={name} />
        ))}
      </>,
    );

    const boxes = new Set(
      [...container.querySelectorAll("svg")].map((svg) => svg.getAttribute("viewBox")),
    );
    expect([...boxes]).toEqual([ICON_VIEWBOX]);
  });
});

describe("Icon", () => {
  it("paints with the glyph's own stroke weight, as an attribute", () => {
    /*
     * Presentation **attributes** on the `<svg>`, not CSS. That is what lets the three glyphs with a
     * per-child weight override it: a child's own attribute beats an inherited value, whereas CSS on
     * the parent would beat the child's attribute. See the note in Icon.tsx.
     */
    const { container } = renderWithProviders(<Icon name="home" />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("stroke-width", String(ICONS.home.stroke));
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("fill", "none");
  });

  it("lets a glyph override the weight on one of its own children", () => {
    // `accounts` draws the card's chip lighter than its outline so it reads as detail rather than
    // structure. If the parent weight ever becomes CSS, this is the assertion that catches it.
    const { container } = renderWithProviders(<Icon name="accounts" />);
    const [outline, chip] = [...container.querySelectorAll("rect")];

    expect(outline).not.toHaveAttribute("stroke-width");
    expect(chip).toHaveAttribute("stroke-width", "1.3");
  });

  it("renders the viewBox as an attribute", () => {
    const { container } = renderWithProviders(<Icon name="home" />);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", "0 0 16 16");
  });

  it("uses the same box for a chevron as for everything else", () => {
    const { container } = renderWithProviders(<Icon name="chevron-down" />);
    expect(container.querySelector("svg")).toHaveAttribute("viewBox", ICON_VIEWBOX);
  });

  it("is hidden from assistive technology by default", () => {
    /*
     * The default that matters most. Almost every icon in this design sits beside a text label,
     * where announcing it repeats the label — worse than silence. Making this the default means
     * a screen has to opt *in* to an announced icon rather than remember to opt out.
     */
    const { container } = renderWithProviders(<Icon name="check" />);

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelector("svg")).not.toHaveAttribute("role");
  });

  it("becomes an announced image when given a label", () => {
    renderWithProviders(<Icon name="alert-triangle" label="Warning" />);

    const svg = screen.getByRole("img", { name: "Warning" });
    expect(svg).not.toHaveAttribute("aria-hidden");
  });

  it("resolves a named context size", () => {
    // 6.3: 11px inside a 20px category swatch, 20px on the FAB.
    const { container } = renderWithProviders(
      <>
        <Icon name="cutlery" size="swatchSm" />
        <Icon name="plus" size="fab" />
      </>,
    );

    const [small, large] = [...container.querySelectorAll("svg")];
    expect(small).toHaveAttribute("width", "11px");
    expect(small).toHaveAttribute("height", "11px");
    expect(large).toHaveAttribute("width", "20px");
  });

  it("accepts an arbitrary length", () => {
    const { container } = renderWithProviders(<Icon name="plus" size="1.5rem" />);
    expect(container.querySelector("svg")).toHaveAttribute("width", "1.5rem");
  });

  it("applies the fixed-ink rule inside a swatch", () => {
    /*
     * The rule that cannot be `currentColor`. A glyph on any of the five swatch fills is ink in
     * **both** themes, because every fill is bright enough for dark ink and light ink measures
     * 1.4:1 to 2.1:1 on them. Inheriting the surrounding text colour would erase the glyph in
     * dark mode.
     */
    const { container } = renderWithProviders(<Icon name="bank" onSwatch />);
    const svg = container.querySelector("svg")!;

    expect(window.getComputedStyle(svg).color).toBe("var(--chakra-colors-content-on-swatch)");
  });

  it("inherits its colour when it is not inside a swatch", () => {
    // The default, and what makes one glyph usable in a nav link, a button and an alert: it paints in
    // `currentColor` and sets no colour of its own.
    const { container } = renderWithProviders(<Icon name="bank" />);
    const svg = container.querySelector("svg")!;

    expect(svg).toHaveAttribute("stroke", "currentColor");
    // No colour declared on the element itself — `canvastext` is jsdom's initial value, i.e. the
    // inherited default rather than anything this component set.
    expect(svg.style.color).toBe("");
  });

  it("does not shrink in a flex row", () => {
    // An icon squashed to 9px beside a long label is the most common way this set stops reading.
    const { container } = renderWithProviders(<Icon name="transfer" />);
    expect(window.getComputedStyle(container.querySelector("svg")!).flexShrink).toBe("0");
  });

  it("renders every glyph without throwing", () => {
    // Cheap totality check: a malformed child, a missing entry, or a bad prop spread on any one
    // of 42 glyphs surfaces here rather than on the screen that first uses it.
    for (const name of ICON_NAMES) {
      const { container, unmount } = renderWithProviders(<Icon name={name} />);
      expect(container.querySelector("svg"), name).not.toBeNull();
      unmount();
    }
  });

  it("marks the filled details as filled", () => {
    // `cart`, `car` and `ellipsis` are the only exceptions to stroke-only. Their dots must not
    // inherit `fill="none"` from the parent or they vanish.
    const { container } = renderWithProviders(<Icon name="cart" />);
    const circles = [...container.querySelectorAll("circle")];

    expect(circles).toHaveLength(2);
    for (const circle of circles) {
      expect(circle).toHaveAttribute("fill", "currentColor");
    }
  });
});
