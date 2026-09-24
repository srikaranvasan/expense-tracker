import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { Amount, DirectionAmount } from "./Amount";
import { Avatar } from "./Avatar";
import { BalanceBadge } from "./BalanceBadge";
import { ReferenceCode } from "./ReferenceCode";
import { StatusBadge } from "./StatusBadge";

// The three feature swatches are covered in `tests/ui/swatches.test.tsx`: they live in
// `features/*` because they need a resolver, and `components/ui` may not import feature logic.

/**
 * Money, identity and status.
 *
 * These components carry more product rules than anything else in the design system, and the rules
 * are what is tested. The single most important one, from section 9.1:
 *
 * > Direction is always spelled out in words — never a bare signed number or colour alone to convey
 * > who owes whom.
 *
 * Colour and glyphs cannot be verified by a test in any meaningful sense, so what is asserted is
 * that the **words** are always there, and that no component can be rendered without them.
 */

describe("Amount", () => {
  it("renders in mono with tabular figures", () => {
    // A column of amounts only aligns on the decimal point with tabular figures, which is what makes
    // a transaction list scannable.
    renderWithProviders(<Amount>₹1,600.00</Amount>);

    const styles = window.getComputedStyle(screen.getByText("₹1,600.00"));
    expect(styles.fontFamily).toBe("var(--chakra-fonts-mono)");
    expect(styles.fontVariantNumeric).toBe("tabular-nums");
  });

  it("never wraps mid-figure", () => {
    // "₹1,600.\n00" is not a number anyone can read.
    renderWithProviders(<Amount>₹1,600.00</Amount>);
    expect(window.getComputedStyle(screen.getByText("₹1,600.00")).whiteSpace).toBe("nowrap");
  });

  it("is neutral unless a tone is asked for", () => {
    // Most amounts on a screen are facts, not judgements. A total is not good or bad news.
    renderWithProviders(<Amount>₹4,800.00</Amount>);
    expect(window.getComputedStyle(screen.getByText("₹4,800.00")).color).toBe(
      "var(--chakra-colors-content)",
    );
  });
});

describe("DirectionAmount", () => {
  it("states the direction in words, not only in colour", () => {
    /*
     * The rule. All three signals are present — arrow, colour, words — and the words are the only one
     * that survives for a colour-blind user, a screen-reader user, and a printout.
     */
    renderWithProviders(
      <DirectionAmount direction="in" formattedAmount="₹1,600.00" label="Ravi owes you" />,
    );

    expect(screen.getByText("₹1,600.00")).toBeInTheDocument();
    expect(screen.getByText("Ravi owes you")).toBeInTheDocument();
  });

  it("distinguishes the two directions by their words", () => {
    const { unmount } = renderWithProviders(
      <DirectionAmount direction="out" formattedAmount="₹450.00" label="you owe Priya" />,
    );
    expect(screen.getByText("you owe Priya")).toBeInTheDocument();
    unmount();

    renderWithProviders(
      <DirectionAmount direction="in" formattedAmount="₹450.00" label="Priya owes you" />,
    );
    expect(screen.getByText("Priya owes you")).toBeInTheDocument();
  });

  it("keeps the arrow decorative, because the words already say it", () => {
    // A screen reader announcing "image, arrow, owes you" is worse than "₹1,600.00 owes you".
    const { container } = renderWithProviders(
      <DirectionAmount direction="in" formattedAmount="₹1,600.00" label="owes you" />,
    );

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("uses opposite arrows for the two directions", () => {
    // Colour is not the only non-verbal signal either: the glyph differs too, which helps in
    // greyscale and on a bad screen.
    const inbound = renderWithProviders(
      <DirectionAmount direction="in" formattedAmount="₹1.00" label="owes you" />,
    );
    const inboundPath = inbound.container.querySelector("path")?.getAttribute("d");
    inbound.unmount();

    const outbound = renderWithProviders(
      <DirectionAmount direction="out" formattedAmount="₹1.00" label="you owe" />,
    );
    const outboundPath = outbound.container.querySelector("path")?.getAttribute("d");

    expect(inboundPath).toBeTruthy();
    expect(outboundPath).toBeTruthy();
    expect(inboundPath).not.toBe(outboundPath);
  });

  it("has no settled direction to render", () => {
    /*
     * There is deliberately no `direction="settled"`. A settled balance has no direction, so the
     * component would have to invent an arrow and a colour for it. `BalanceBadge` owns that case.
     *
     * Asserted at the type level by the union; this documents the intent for a reader.
     */
    const directions: Array<"in" | "out"> = ["in", "out"];
    expect(directions).toHaveLength(2);
  });
});

describe("BalanceBadge", () => {
  it("shows a settled balance with no figure at all", () => {
    /*
     * Required by the group 29 checklist, and the reasoning matters: "₹0.00" invites "zero of what,
     * owed by whom?", and a zero rendered in a direction colour would be actively misleading.
     * "Settled up" is the fact.
     */
    renderWithProviders(
      <BalanceBadge direction="settled" formattedAmount="₹0.00" label="settled up" />,
    );

    expect(screen.getByText("Settled up")).toBeInTheDocument();
    expect(screen.queryByText("₹0.00")).not.toBeInTheDocument();
  });

  it("reads correctly for a zero balance that is not settled", () => {
    /*
     * The other half of the same checkbox. A person can have a zero *outstanding* balance while the
     * domain still reports a direction — for instance immediately after a settlement, before the
     * balance is recomputed. The figure shows, and the words still say which way it points, so the
     * row is never ambiguous.
     */
    renderWithProviders(
      <BalanceBadge direction="person_owes_user" formattedAmount="₹0.00" label="owes you" />,
    );

    expect(screen.getByText("₹0.00")).toBeInTheDocument();
    expect(screen.getByText("owes you")).toBeInTheDocument();
  });

  it("translates the domain's three states into two directions plus a badge", () => {
    for (const [direction, expected] of [
      ["person_owes_user", "owes you"],
      ["user_owes_person", "you owe"],
    ] as const) {
      const { unmount } = renderWithProviders(
        <BalanceBadge direction={direction} formattedAmount="₹10.00" label={expected} />,
      );
      expect(screen.getByText(expected)).toBeInTheDocument();
      unmount();
    }
  });
});

describe("StatusBadge", () => {
  it("carries its meaning as text", () => {
    // An icon-only badge would be unreadable to a screen reader and a guessing game for everyone else.
    renderWithProviders(<StatusBadge kind="settled" />);
    expect(screen.getByText("Settled")).toBeInTheDocument();
  });

  it("uses the type labels group 21 settled on", () => {
    // "Split" as a type label, "Card payment" as a type label — not "Split a bill" or "Pay card",
    // which are action labels.
    const split = renderWithProviders(<StatusBadge kind="split" />);
    expect(screen.getByText("Split")).toBeInTheDocument();
    split.unmount();

    renderWithProviders(<StatusBadge kind="cardPayment" />);
    expect(screen.getByText("Card payment")).toBeInTheDocument();
  });

  it("uppercases in CSS so the accessible name stays readable", () => {
    renderWithProviders(<StatusBadge kind="partSettled" />);

    const label = screen.getByText("Part settled");
    expect(window.getComputedStyle(label).textTransform).toBe("uppercase");
  });

  it("lets the label be overridden without letting the meaning drift", () => {
    // "2 of 3 settled" is a legitimate refinement; a settled badge that looks like a transfer is not.
    const { container } = renderWithProviders(
      <StatusBadge kind="partSettled" label="2 of 3 settled" />,
    );

    expect(screen.getByText("2 of 3 settled")).toBeInTheDocument();
    // Still the part-settled fill and glyph.
    expect(window.getComputedStyle(container.firstElementChild!).background).toBe(
      "var(--chakra-colors-warning-surface)",
    );
  });

  it("draws every kind in ink on a swatch fill", () => {
    // All five fills are swatch colours, which are bright in both modes — unlike the tints, where
    // fixed ink measured 1.2:1 in dark mode.
    for (const kind of ["settled", "partSettled", "split", "transfer", "cardPayment"] as const) {
      const { container, unmount } = renderWithProviders(<StatusBadge kind={kind} />);

      expect(window.getComputedStyle(container.firstElementChild!).color, kind).toBe(
        "var(--chakra-colors-content-on-swatch)",
      );
      unmount();
    }
  });
});

describe("Avatar", () => {
  it("derives its initials so two call sites cannot disagree", () => {
    renderWithProviders(<Avatar name="Ravi Shankar" />);
    expect(screen.getByText("RS")).toBeInTheDocument();
  });

  it("is hidden from assistive technology", () => {
    /*
     * The person's name is always rendered beside it, so announcing "RS" as well means hearing the
     * same person twice — once as a meaningless pair of letters.
     */
    const { container } = renderWithProviders(<Avatar name="Ravi Shankar" />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("encodes the relation in its fill, which is never the only signal", () => {
    /*
     * The fill is a glance-level cue and nothing more. A screen placing a directional avatar must
     * also carry the direction in words, which in practice means beside a `DirectionAmount` — the
     * prop is named `relation` rather than `color` to make that obligation visible at the call site.
     */
    const fills = (["self", "owesYou", "youOwe", "neutral"] as const).map((relation) => {
      const { container, unmount } = renderWithProviders(
        <Avatar name="Ravi Shankar" relation={relation} />,
      );
      const fill = window.getComputedStyle(container.firstElementChild!).background;
      unmount();
      return fill;
    });

    expect(new Set(fills).size).toBe(4);
  });

  it("keeps the initials in ink on a coloured fill", () => {
    const { container } = renderWithProviders(<Avatar name="Ravi Shankar" relation="owesYou" />);

    expect(window.getComputedStyle(container.firstElementChild!).color).toBe(
      "var(--chakra-colors-content-on-swatch)",
    );
  });
});

describe("ReferenceCode", () => {
  /*
   * Group 32 changed the prop from `recordId` to `code`.
   *
   * The component no longer derives anything: the view models carry `referenceCode` beside
   * `formattedAmount`, and a component that derived its own would be a second answer to the same
   * question. The derivation is tested in `lib/utils/reference-code.test.ts`.
   */
  it("renders the code in mono", () => {
    renderWithProviders(<ReferenceCode code="#92A3B" />);

    const code = screen.getByText("#92A3B");
    expect(window.getComputedStyle(code).fontFamily).toBe("var(--chakra-fonts-mono)");
  });

  it("renders nothing for a record with no reference", () => {
    // An empty chip or a placeholder would imply the code exists and is merely unknown.
    const { container } = renderWithProviders(<ReferenceCode code={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("marks an unsaved record as a draft, in words", () => {
    /*
     * `TXN-08232 · draft` in `AddExpense-Light.html`. Text rather than a colour or a weight change, so
     * it survives for a screen reader and for anyone who cannot tell two greys apart (9.1).
     */
    renderWithProviders(<ReferenceCode code="#92A3B" draft />);
    expect(screen.getByText("#92A3B · draft")).toBeInTheDocument();
  });

  it("switches colour inside a tinted panel", () => {
    /*
     * `content.meta` measures 4.2:1 on `tealTint` — just under AA — and `brand.muted` inverts between
     * colour modes, so the tinted case needs its own token rather than a slightly lighter grey.
     */
    const plain = renderWithProviders(<ReferenceCode code="#92A3B" />);
    expect(window.getComputedStyle(screen.getByText("#92A3B")).color).toBe(
      "var(--chakra-colors-content-meta)",
    );
    plain.unmount();

    renderWithProviders(<ReferenceCode code="#92A3B" tone="onTint" />);
    expect(window.getComputedStyle(screen.getByText("#92A3B")).color).toBe(
      "var(--chakra-colors-content-on-tint)",
    );
  });
});
