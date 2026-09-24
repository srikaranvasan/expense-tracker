import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { Alert } from "@/components/feedback/Alert";
import { EmptyState } from "@/components/feedback/EmptyState";
import {
  Card,
  CardHeader,
  CardList,
  DetailList,
  DetailRow,
  GraphPaper,
  RegistrationTicks,
  SummaryTile,
  TILE_EDGES,
} from "./Card";
import { Stamp } from "./Stamp";

/**
 * Surfaces and feedback.
 *
 * The assertions are about the distinctions that carry meaning — a container card versus the
 * subject of the page, a tile's semantic edge colour, an alert that announces itself, a stamp that
 * does not. Padding and exact colours are left alone: they are expected to change, and asserting
 * them would make the suite a photograph rather than a contract
 * (docs/11-TESTING-STRATEGY.md section 3).
 */

describe("Card", () => {
  it("is a quiet container by default", () => {
    /*
     * The default matters more than the variant. A page of six cards should read as one page, which
     * only works if the ordinary card is the quiet one — 1.5px at 18% ink and no shadow.
     */
    const { container } = renderWithProviders(<Card>Body</Card>);
    const styles = window.getComputedStyle(container.firstElementChild!);

    expect(styles.borderWidth).toBe("var(--chakra-border-widths-thin)");
    expect(styles.borderColor).toBe("var(--chakra-colors-line-card)");
    expect(styles.boxShadow).toBe("none");
  });

  it("becomes the subject of the page when emphasised", () => {
    const { container } = renderWithProviders(<Card emphasis>Form</Card>);
    const styles = window.getComputedStyle(container.firstElementChild!);

    expect(styles.borderWidth).toBe("var(--chakra-border-widths-thick)");
    expect(styles.borderColor).toBe("var(--chakra-colors-line)");
    expect(styles.boxShadow).toBe("var(--chakra-shadows-hard-lg)");
  });

  it("stops clipping its contents once emphasised", () => {
    /*
     * A container card clips so a row's hover fill cannot bleed past the border. An emphasised card
     * must not, because it is a form and a form ends in a button — and every button in this design
     * has an offset shadow that would be cut off at the card edge.
     */
    const { container } = renderWithProviders(
      <>
        <Card data-testid="container">rows</Card>
        <Card emphasis data-testid="subject">
          form
        </Card>
      </>,
    );

    expect(
      window.getComputedStyle(container.querySelector('[data-testid="container"]')!).overflow,
    ).toBe("hidden");
    expect(
      window.getComputedStyle(container.querySelector('[data-testid="subject"]')!).overflow,
    ).toBe("visible");
  });

  it("gives a card header a real heading", () => {
    // So a screen reader's heading list is a map of the page rather than a list of styled text.
    renderWithProviders(<CardHeader title="Recent activity" subtitle="Last 30 days" />);

    expect(screen.getByRole("heading", { name: "Recent activity", level: 2 })).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
  });

  it("separates list rows with a hairline, not a card border", () => {
    // Eight rows drawn at card weight read as eight cards.
    const { container } = renderWithProviders(
      <CardList>
        <div>One</div>
        <div>Two</div>
      </CardList>,
    );

    const separators = [...container.querySelectorAll("*")].filter(
      (element) =>
        window.getComputedStyle(element).borderColor === "var(--chakra-colors-line-soft)",
    );

    // Two rows, one rule between them — never above the first.
    expect(separators).toHaveLength(1);
    expect(window.getComputedStyle(separators[0]!).borderTopWidth).toBe("1px");
  });

  it("renders a detail row as a real label/value pair", () => {
    renderWithProviders(
      <DetailList>
        <DetailRow label="Paid from" value="HDFC Savings" />
      </DetailList>,
    );

    expect(screen.getByText("Paid from")).toBeInTheDocument();
    expect(screen.getByText("HDFC Savings")).toBeInTheDocument();
  });

  it("uppercases a detail label in CSS so the text stays sentence case", () => {
    renderWithProviders(
      <DetailList>
        <DetailRow label="Paid from" value="HDFC Savings" />
      </DetailList>,
    );

    const label = screen.getByText("Paid from");
    expect(window.getComputedStyle(label).textTransform).toBe("uppercase");
  });
});

describe("SummaryTile", () => {
  it("colours its top edge from the semantic map", () => {
    renderWithProviders(
      <SummaryTile label="Card debt" value="₹12,400.00" edge="negative" icon="card" />,
    );

    const tile = screen.getByText("Card debt").closest("div")!.parentElement!.parentElement!;
    const styles = window.getComputedStyle(tile);
    expect(styles.borderTopWidth).toBe("var(--chakra-border-widths-tile)");
    expect(styles.borderTopColor).toBe("var(--chakra-colors-swatch-coral)");
  });

  it("maps every edge name to a swatch token", () => {
    // The five names are the meanings; the tokens are the colours. A tile picking a colour directly
    // would break the association the dashboard depends on.
    for (const token of Object.values(TILE_EDGES)) {
      expect(token).toMatch(/^swatch\./);
    }
  });

  it("keeps the edge and the figure colour independent", () => {
    /*
     * Card debt has a coral edge whatever it reads; only the figure turns negative, and only when
     * the number is bad news. Conflating the two would mean a healthy card debt looked like a
     * different kind of tile.
     */
    renderWithProviders(
      <SummaryTile label="Card debt" value="₹0.00" edge="negative" tone="neutral" />,
    );

    expect(window.getComputedStyle(screen.getByText("₹0.00")).color).toBe(
      "var(--chakra-colors-content)",
    );
  });

  it("states what the number is in words, not only in colour", () => {
    // The label is always present, so the tile reads correctly without colour at all.
    renderWithProviders(
      <SummaryTile label="Owed to you" value="₹800.00" edge="positive" tone="positive" />,
    );

    expect(screen.getByText("Owed to you")).toBeInTheDocument();
  });

  it("hides the corner marker from assistive technology", () => {
    const { container } = renderWithProviders(
      <SummaryTile label="Cash & bank" value="₹1.00" edge="brand" icon="accounts" />,
    );

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("Alert", () => {
  it("interrupts for an error and waits for everything else", () => {
    /*
     * `role="alert"` is announced immediately; `role="status"` waits for a pause. A validation
     * failure needs the first — it is the reason the user's form did not submit. A success message
     * talking over whatever they are doing next is worse than one they reach a moment later.
     */
    const { rerender } = renderWithProviders(<Alert tone="error">Amount is required.</Alert>);
    expect(screen.getByRole("alert")).toHaveTextContent("Amount is required.");

    rerender(<Alert tone="success">Saved.</Alert>);
    expect(screen.getByRole("status")).toHaveTextContent("Saved.");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("carries the message as text, with an icon as an addition", () => {
    const { container } = renderWithProviders(
      <Alert tone="warning" title="Nothing to pay">
        Add a credit card first.
      </Alert>,
    );

    expect(screen.getByText("Nothing to pay")).toBeInTheDocument();
    expect(screen.getByText("Add a credit card first.")).toBeInTheDocument();
    // Decoration: the sentence is the message.
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("tints by tone and keeps a full-ink border on all four", () => {
    renderWithProviders(
      <>
        <Alert tone="info">i</Alert>
        <Alert tone="success">s</Alert>
        <Alert tone="warning">w</Alert>
        <Alert tone="error">e</Alert>
      </>,
    );

    const blocks = [...screen.getAllByRole("status"), ...screen.getAllByRole("alert")];
    expect(blocks).toHaveLength(4);

    /*
     * `background`, not `backgroundColor`. Chakra's `bg` prop emits the `background` shorthand, and
     * jsdom does not expand a shorthand into its longhands — `backgroundColor` reads as transparent
     * on all four, which makes an obviously-correct component look broken.
     */
    const fills = blocks.map((element) => window.getComputedStyle(element).background);
    // Four distinct fills, so the tone is visible at a glance…
    expect(new Set(fills).size).toBe(4);

    // …and one border weight and colour, so they read as one component.
    for (const element of blocks) {
      const styles = window.getComputedStyle(element);
      expect(styles.borderColor).toBe("var(--chakra-colors-line)");
      expect(styles.borderWidth).toBe("var(--chakra-border-widths-thin)");
    }
  });

  it("draws its contents in ink on the three swatch fills", () => {
    // Mint, butter and coral are bright in both colour modes, which is what makes the fixed-ink rule
    // safe on them — measured 8.5:1 to 13.4:1 either way.
    for (const tone of ["success", "warning", "error"] as const) {
      const { unmount } = renderWithProviders(<Alert tone={tone}>Message.</Alert>);

      expect(window.getComputedStyle(screen.getByText("Message.")).color, tone).toBe(
        "var(--chakra-colors-content-on-swatch)",
      );
      unmount();
    }
  });

  it("does not use ink on the info tint, which is deep in dark mode", () => {
    /*
     * The one that was wrong. `brand.muted` is a *tint*, not a swatch: pale in light (`tealTint`)
     * and deep in dark (`darkTealTint`). Ink on it measures 14.6:1 light and **1.2:1 dark**, so the
     * info alert was unreadable in dark mode until this used `content.onTint` instead.
     *
     * Found by rendering the four tones in both modes; every token involved was individually
     * correct, which is why no earlier assertion caught it.
     */
    renderWithProviders(<Alert tone="info">Queued.</Alert>);

    expect(window.getComputedStyle(screen.getByText("Queued.")).color).toBe(
      "var(--chakra-colors-content-on-tint)",
    );
  });
});

describe("EmptyState", () => {
  it("offers a way onward so an empty list is not a dead end", () => {
    renderWithProviders(
      <EmptyState
        title="No accounts yet"
        description="Add the account you spend from most."
        action={<button type="button">Add account</button>}
      />,
    );

    expect(screen.getByText("No accounts yet")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Add account" })).toBeInTheDocument();
  });

  it("uses a solid border, because dashed means something else here", () => {
    /*
     * A dashed border is the stamp motif (5.4). If an empty list used dashes, the one place dashes
     * appear would stop meaning "status confirmation".
     */
    const { container } = renderWithProviders(<EmptyState title="Nothing here" />);

    expect(window.getComputedStyle(container.firstElementChild!).borderStyle).toBe("solid");
  });
});

describe("Stamp", () => {
  it("is hidden from assistive technology by default", () => {
    /*
     * The rule from 5.4: a stamp is never the only carrier of its message, so the plain text beside
     * it is what should be announced. Announcing a decorative duplicate is noise — and if a stamp
     * ever needs announcing, the screen is missing the sentence that should have been there.
     */
    const { container } = renderWithProviders(<Stamp label="Balanced" />);

    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("can be announced when it genuinely is the only text", () => {
    renderWithProviders(<Stamp label="Balanced" announce />);
    expect(screen.getByText("Balanced")).not.toHaveAttribute("aria-hidden");
  });

  it("is dashed and rotated, which is what makes it a stamp", () => {
    const { container } = renderWithProviders(<Stamp label="Audited · OK" />);
    const styles = window.getComputedStyle(container.firstElementChild!);

    expect(styles.borderStyle).toBe("dashed");
    expect(styles.transform).toBe("rotate(-7deg)");
  });

  it("uppercases in CSS rather than in the label", () => {
    renderWithProviders(<Stamp label="Balanced" announce />);
    expect(window.getComputedStyle(screen.getByText("Balanced")).textTransform).toBe("uppercase");
  });
});

describe("motifs", () => {
  it("draws four registration ticks that cannot swallow a click", () => {
    /*
     * They sit over the card, so a tick intercepting a pointer event would make the corner of a
     * form mysteriously unresponsive.
     */
    const { container } = renderWithProviders(
      <RegistrationTicks>
        <Card emphasis>Sign in</Card>
      </RegistrationTicks>,
    );

    const ticks = [...container.querySelectorAll('[aria-hidden="true"]')];
    expect(ticks).toHaveLength(4);

    for (const tick of ticks) {
      expect(window.getComputedStyle(tick).pointerEvents).toBe("none");
    }
  });

  it("draws the graph paper from a token so it flips with the colour mode", () => {
    const { container } = renderWithProviders(<GraphPaper>page</GraphPaper>);
    const styles = window.getComputedStyle(container.firstElementChild!);

    expect(styles.backgroundSize).toBe("24px 24px");
    // A literal rgba here would be a light-mode grid on a dark page.
    expect(styles.backgroundImage).toContain("--chakra-colors-line-grid");
  });
});
