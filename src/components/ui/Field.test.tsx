import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { AmountInput, Field, SelectInput, TextAreaInput, TextInput } from "./Field";

/**
 * These assert on accessible output - roles, labels, and announced errors - rather
 * than on class names, because styling is expected to change while the meaning of a
 * control is not (docs/11-TESTING-STRATEGY.md section 3).
 */

describe("Field", () => {
  it("associates the label with its control", () => {
    renderWithProviders(
      <Field id="name" label="Account name">
        <TextInput id="name" name="name" />
      </Field>,
    );

    // getByLabelText only resolves when the label is correctly associated.
    expect(screen.getByLabelText("Account name")).toBe(
      screen.getByRole("textbox", { name: "Account name" }),
    );
  });

  it("renders a hint when there is no error", () => {
    renderWithProviders(
      <Field id="limit" label="Credit limit" hint="Day of the month, 1-31.">
        <TextInput id="limit" name="limit" />
      </Field>,
    );

    expect(screen.getByText("Day of the month, 1-31.")).toBeInTheDocument();
  });

  it("marks the control invalid and announces the error", () => {
    renderWithProviders(
      <Field id="amount" label="Amount" errors={["Amount must be greater than zero."]}>
        <TextInput id="amount" name="amount" />
      </Field>,
    );

    const input = screen.getByLabelText("Amount");
    expect(input).toHaveAttribute("aria-invalid", "true");

    // The message must be text, not only a colour change.
    expect(screen.getByText("Amount must be greater than zero.")).toBeInTheDocument();
  });

  it("hides the hint once the field is invalid, so one message is shown", () => {
    renderWithProviders(
      <Field id="amount" label="Amount" hint="In rupees." errors={["Required."]}>
        <TextInput id="amount" name="amount" />
      </Field>,
    );

    expect(screen.queryByText("In rupees.")).not.toBeInTheDocument();
    expect(screen.getByText("Required.")).toBeInTheDocument();
  });

  it("marks a required field as required for assistive technology", () => {
    renderWithProviders(
      <Field id="name" label="Name" required>
        <TextInput id="name" name="name" required />
      </Field>,
    );

    expect(screen.getByLabelText(/Name/)).toBeRequired();
  });

  it("wires a native select the same way", () => {
    renderWithProviders(
      <Field id="type" label="Type">
        <SelectInput id="type" name="type" defaultValue="bank">
          <option value="bank">Bank</option>
          <option value="cash">Cash</option>
        </SelectInput>
      </Field>,
    );

    const select = screen.getByRole("combobox", { name: "Type" });
    expect(select).toHaveValue("bank");
  });
});

/**
 * Group 26 added a visual language to these controls. The tests below are about the places where
 * that language could quietly damage the meaning of a form — a currency symbol that ends up in
 * the submitted value, a label that a screen reader spells out, a focus state that vanishes.
 *
 * Deliberately not asserted: padding, border widths, exact colours. Those are expected to change
 * and asserting them would make the suite a photograph rather than a contract
 * (docs/11-TESTING-STRATEGY.md section 3).
 */
describe("Field styling contract", () => {
  it("uppercases the label in CSS, not in the markup", () => {
    /*
     * The eyebrow treatment is `text-transform`, so the accessible name stays sentence case.
     * Writing "PAID FROM" in the markup renders identically and makes some screen readers spell
     * it out letter by letter.
     */
    renderWithProviders(
      <Field id="paid-from" label="Paid from">
        <TextInput id="paid-from" name="paidFrom" />
      </Field>,
    );

    // The accessible name is what the user hears, and it is not shouting.
    expect(screen.getByRole("textbox", { name: "Paid from" })).toBeInTheDocument();

    const label = screen.getByText("Paid from");
    expect(window.getComputedStyle(label).textTransform).toBe("uppercase");
  });

  it("keeps the required asterisk out of the accessible name", () => {
    // `Field.Root required` is what announces the requirement. An asterisk in the name would make
    // it read as "Amount asterisk".
    renderWithProviders(
      <Field id="amount" label="Amount" required>
        <TextInput id="amount" name="amount" required />
      </Field>,
    );

    expect(screen.getByRole("textbox", { name: "Amount" })).toBeRequired();
  });

  it("announces an error as text in a mono face, not as a colour", () => {
    renderWithProviders(
      <Field id="amount" label="Amount" errors={["Amount must be greater than zero."]}>
        <TextInput id="amount" name="amount" />
      </Field>,
    );

    const error = screen.getByText("Amount must be greater than zero.");
    expect(window.getComputedStyle(error).fontFamily).toBe("var(--chakra-fonts-mono)");
  });

  describe("AmountInput", () => {
    it("shows a currency symbol that is not part of the value", () => {
      /*
       * The point of the whole positioned-sibling arrangement. A `₹` in the value or the
       * placeholder would be submitted with the form, would have to be stripped before parsing,
       * and would be read out as though the user had typed it.
       */
      renderWithProviders(
        <Field id="amount" label="Amount">
          <AmountInput id="amount" name="amount" placeholder="0.00" />
        </Field>,
      );

      const input = screen.getByRole("textbox", { name: "Amount" });
      expect(input).toHaveValue("");
      expect(input).toHaveAttribute("placeholder", "0.00");
      expect(input.getAttribute("placeholder")).not.toContain("₹");

      // Visible, and hidden from assistive technology because it labels nothing.
      const prefix = screen.getByText("₹");
      expect(prefix).toBeInTheDocument();
      expect(prefix).toHaveAttribute("aria-hidden", "true");
    });

    it("does not let the prefix intercept a click meant for the input", () => {
      // Tapping the symbol should focus the field, which only happens if it is transparent to
      // pointer events.
      renderWithProviders(
        <Field id="amount" label="Amount">
          <AmountInput id="amount" name="amount" />
        </Field>,
      );

      expect(window.getComputedStyle(screen.getByText("₹")).pointerEvents).toBe("none");
    });

    it("derives the symbol from the currency rather than hard-coding it", () => {
      renderWithProviders(
        <Field id="amount" label="Amount">
          <AmountInput id="amount" name="amount" currency="USD" />
        </Field>,
      );

      expect(screen.getByText("$")).toBeInTheDocument();
    });

    it("asks for a numeric keypad and renders tabular figures", () => {
      renderWithProviders(
        <Field id="amount" label="Amount">
          <AmountInput id="amount" name="amount" />
        </Field>,
      );

      const input = screen.getByRole("textbox", { name: "Amount" });
      expect(input).toHaveAttribute("inputmode", "decimal");
      expect(window.getComputedStyle(input).fontFamily).toBe("var(--chakra-fonts-mono)");
    });
  });

  describe("SelectInput", () => {
    it("stays a real native select", () => {
      /*
       * `DESIGN.md` is explicit: only the chrome is custom. A custom listbox would need its own
       * keyboard handling and would lose the OS picker, which is faster one-handed. The `combobox`
       * role here comes from the native element, not from an ARIA attribute.
       */
      renderWithProviders(
        <Field id="account" label="Account">
          <SelectInput id="account" name="account">
            <option value="a">HDFC Savings</option>
          </SelectInput>
        </Field>,
      );

      const select = screen.getByRole("combobox", { name: "Account" });
      expect(select.tagName).toBe("SELECT");
      expect(select).not.toHaveAttribute("role");
    });

    it("draws the chevron from the icon registry, hidden from assistive technology", () => {
      const { container } = renderWithProviders(
        <Field id="account" label="Account">
          <SelectInput id="account" name="account">
            <option value="a">HDFC Savings</option>
          </SelectInput>
        </Field>,
      );

      const svg = container.querySelector("svg");
      expect(svg).toHaveAttribute("aria-hidden", "true");
      // The registry's shared box — proof it is our glyph and not Chakra's default chevron.
      expect(svg).toHaveAttribute("viewBox", "0 0 16 16");
    });
  });

  describe("focus", () => {
    it("replaces the default ring with the offset shadow on every control", () => {
      /*
       * `outline: none` is what removes Chakra's ring, so something has to put a visible state
       * back or the app becomes unusable by keyboard. `shadows.hardFocus` is that replacement, and
       * it is a token rather than a literal so it flips to `darkTeal` in dark mode.
       *
       * jsdom does not apply `_focusVisible`, so this asserts the *declaration* reaches the
       * element rather than simulating focus. Group 40 walks every control in a real browser.
       */
      const { container } = renderWithProviders(
        <>
          <Field id="text" label="Text">
            <TextInput id="text" name="text" />
          </Field>
          <Field id="amount" label="Amount">
            <AmountInput id="amount" name="amount" />
          </Field>
          <Field id="select" label="Select">
            <SelectInput id="select" name="select">
              <option value="a">A</option>
            </SelectInput>
          </Field>
          <Field id="notes" label="Notes">
            <TextAreaInput id="notes" name="notes" />
          </Field>
        </>,
      );

      const controls = [
        container.querySelector("#text"),
        container.querySelector("#amount"),
        container.querySelector("#select"),
        container.querySelector("#notes"),
      ];

      for (const control of controls) {
        expect(control).not.toBeNull();
        expect(window.getComputedStyle(control!).outline).toBe("none");
      }
    });

    it("keeps the border width constant so focusing cannot shift the layout", () => {
      /*
       * The divergence recorded in Field.tsx: the handoff promotes 1.5px to 2px and compensates
       * the padding by half a pixel. Here the width never changes and the colour carries the
       * promotion, which is why there is no compensation to keep in step across four controls.
       */
      const { container } = renderWithProviders(
        <Field id="text" label="Text">
          <TextInput id="text" name="text" />
        </Field>,
      );

      const styles = window.getComputedStyle(container.querySelector("#text")!);
      expect(styles.borderWidth).toBe("var(--chakra-border-widths-thick)");
      expect(styles.paddingBlock).toBe("13px");
    });
  });
});
