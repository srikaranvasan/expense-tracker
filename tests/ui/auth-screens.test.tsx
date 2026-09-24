import { describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { AmountInput, Field, TextInput } from "@/components/ui/Field";
import { AuthHeading } from "@/features/auth/components/AuthHeading";
import { LoginForm } from "@/features/auth/components/LoginForm";
import { RegisterForm } from "@/features/auth/components/RegisterForm";

/**
 * The unauthenticated screens (group 33; `design/ux/screens/Login.html`).
 *
 * In `tests/ui/` because what is worth asserting spans a primitive and two feature forms: the prefix
 * icon added to `TextInput`, the shared heading, and the two decisions that are easy to undo by
 * accident — sign-in's failure message staying ambiguous, and sign-up deliberately carrying no
 * prefix icons.
 *
 * The server actions are stubbed. These components call them through `useActionState`, which never
 * fires without a submit, so the stubs only need to exist.
 */

vi.mock("@/features/auth/actions/auth-actions", () => ({
  loginAction: vi.fn(),
  registerAction: vi.fn(),
}));

describe("TextInput prefix icon", () => {
  it("draws the glyph and pads the field to clear it", () => {
    const { container } = renderWithProviders(
      <Field id="email" label="Email">
        <TextInput id="email" icon="mail" />
      </Field>,
    );

    const glyph = container.querySelector("svg");
    expect(glyph).not.toBeNull();
    // 40px as drawn: the 14px base inline padding, the 15px glyph, and an 11px gap.
    expect(window.getComputedStyle(screen.getByLabelText(/Email/)).paddingInlineStart).toBe("40px");
  });

  it("lifts the prefix above the control, or it is invisible", () => {
    /*
     * The bug group 33 found, and the reason `InputPrefix` exists.
     *
     * Chakra v3's Input recipe sets `position: relative`. Two positioned siblings with
     * `z-index: auto` paint in DOM order, so the input — which has an opaque `surface` background —
     * painted over the prefix. Both the new icon **and** `AmountInput`'s currency symbol were
     * invisible in the browser while every DOM assertion passed, because jsdom paints nothing.
     *
     * This assertion cannot see paint either. What it can do is pin the one declaration that fixes
     * it, so removing it fails here rather than in a screenshot six groups later.
     */
    const { container } = renderWithProviders(
      <Field id="email" label="Email">
        <TextInput id="email" icon="mail" />
      </Field>,
    );

    // `Icon` renders the `<svg>` itself (`Box asChild`), so its parent is the prefix box.
    const prefix = container.querySelector("svg")!.parentElement!;
    const styles = window.getComputedStyle(prefix);
    expect(styles.position).toBe("absolute");
    expect(styles.zIndex).toBe("1");
    // And it must stay click-through, which is what makes raising it safe.
    expect(styles.pointerEvents).toBe("none");
  });

  it("applies the same lift to the currency prefix", () => {
    const { container } = renderWithProviders(
      <Field id="amount" label="Amount">
        <AmountInput id="amount" />
      </Field>,
    );

    const prefix = container.querySelector('[aria-hidden="true"]') as HTMLElement;
    expect(prefix.textContent).toBe("₹");
    expect(window.getComputedStyle(prefix).zIndex).toBe("1");
  });

  it("hides the glyph from assistive technology", () => {
    /*
     * The mono label above the field already names it. An announced icon would make the email field
     * read as "Email, mail, edit text".
     */
    const { container } = renderWithProviders(
      <Field id="email" label="Email">
        <TextInput id="email" icon="mail" />
      </Field>,
    );

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
    expect(screen.getByLabelText(/Email/)).toBeInTheDocument();
  });

  it("does not wrap or pad a field with no icon", () => {
    // The overwhelming majority of fields in the app. They must be unchanged by this addition.
    const { container } = renderWithProviders(
      <Field id="plain" label="Plain">
        <TextInput id="plain" />
      </Field>,
    );

    expect(container.querySelector("svg")).toBeNull();
    /*
     * `paddingInline`, not `paddingInlineStart`: without an icon the control keeps the shared 14px
     * shorthand, and jsdom reports the longhand as empty when only the shorthand was set. The
     * iconless field having no start override is exactly the point.
     */
    const styles = window.getComputedStyle(screen.getByLabelText(/Plain/));
    expect(styles.paddingInline).toBe("14px");
    expect(styles.paddingInlineStart).toBe("");
  });
});

describe("AuthHeading", () => {
  it("makes the page title the h1, not the product name", () => {
    /*
     * The product name sits above the card as a wordmark (`app/(auth)/layout.tsx`). It used to be the
     * `h1`, which meant both auth screens announced the same heading and neither said which page it
     * was.
     */
    renderWithProviders(<AuthHeading eyebrow="Ledger access" title="Sign in" />);
    expect(screen.getByRole("heading", { level: 1, name: "Sign in" })).toBeInTheDocument();
  });

  it("puts the eyebrow in teal, the one eyebrow in the app that is not grey", () => {
    renderWithProviders(<AuthHeading eyebrow="Ledger access" title="Sign in" />);

    const eyebrow = screen.getByText("Ledger access");
    const styles = window.getComputedStyle(eyebrow);
    expect(styles.color).toBe("var(--chakra-colors-brand-fg)");
    expect(styles.fontFamily).toBe("var(--chakra-fonts-mono)");
    // Uppercased by the theme rather than in the string, so a screen reader does not spell it out.
    expect(styles.textTransform).toBe("uppercase");
    expect(eyebrow.textContent).toBe("Ledger access");
  });
});

describe("LoginForm", () => {
  it("carries the two prefix glyphs the handoff draws", () => {
    const { container } = renderWithProviders(<LoginForm />);

    expect(container.querySelectorAll("svg")).toHaveLength(2);
    expect(screen.getByLabelText(/Email/)).toHaveAttribute("type", "email");
    expect(screen.getByLabelText(/Password/)).toHaveAttribute("type", "password");
  });

  it("leaves the password field without a placeholder", () => {
    // The artboard draws a row of bullets. An empty field whose placeholder is bullets looks filled in,
    // and the browser's own masking already shows them once anything is typed.
    renderWithProviders(<LoginForm />);
    expect(screen.getByLabelText(/Password/)).not.toHaveAttribute("placeholder");
  });

  it("offers the route to sign-up", () => {
    renderWithProviders(<LoginForm />);
    expect(screen.getByRole("link", { name: "Create one" })).toHaveAttribute("href", "/register");
  });
});

describe("RegisterForm", () => {
  it("carries no prefix icons, deliberately", () => {
    /*
     * Pinned because it looks like an omission and is not. Three of this form's six fields — name,
     * currency, timezone — have no glyph in the registry that means what they mean, and icons on the
     * two familiar fields with nothing on the rest reads as unfinished. The mono labels carry it.
     *
     * The two `svg`s that are present are the select indicators, not field prefixes.
     */
    const { container } = renderWithProviders(<RegisterForm defaultTimezone="Asia/Kolkata" />);

    const selects = container.querySelectorAll("select");
    expect(selects).toHaveLength(2);
    expect(container.querySelectorAll("svg")).toHaveLength(selects.length);
  });

  it("captures currency and timezone, because every later figure depends on them", () => {
    renderWithProviders(<RegisterForm defaultTimezone="Asia/Kolkata" />);

    expect(screen.getByLabelText(/Currency/)).toHaveValue("INR");
    expect(screen.getByLabelText(/Timezone/)).toHaveValue("Asia/Kolkata");
  });

  it("offers the route back to sign-in", () => {
    renderWithProviders(<RegisterForm defaultTimezone="Asia/Kolkata" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
  });
});
