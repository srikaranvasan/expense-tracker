import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { Field, SelectInput, TextInput } from "./Field";

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
