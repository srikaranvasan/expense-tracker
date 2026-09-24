import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { Icon } from "@/components/icons/Icon";
import { Button, IconButton } from "./Button";
import { FormActions } from "./FormActions";

/**
 * Buttons and the form action row.
 *
 * The assertions here are about *behaviour and reachability*, not appearance. Two of them exist
 * because of a real bug that shipped: every create and edit form in the application had a Cancel
 * button pushed off the right edge of its container, so there was no reachable way to cancel
 * anything (docs/design-tasks/01-DESIGN-SYSTEM.md section 9.2).
 *
 * Testing "Cancel is visible" in jsdom is not possible — jsdom does no layout, so an overflowing
 * element is still "visible" to it. What *is* testable is the property that caused the overflow:
 * a submit button claiming 100% of the row. So the tests assert the flex contract instead, which
 * is the thing that was wrong.
 */

const clickButton = (name: string | RegExp) =>
  fireEvent.click(screen.getByRole("button", { name }));

describe("Button", () => {
  it("does not submit a form unless asked to", () => {
    // The default that prevents a "Show more" button inside a form from submitting it.
    renderWithProviders(<Button>Load more</Button>);
    expect(screen.getByRole("button", { name: "Load more" })).toHaveAttribute("type", "button");
  });

  it("submits when it is the submit button", () => {
    renderWithProviders(<Button type="submit">Save</Button>);
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("type", "submit");
  });

  it("meets the minimum touch target in every size", () => {
    renderWithProviders(
      <>
        <Button size="sm">Small</Button>
        <Button size="md">Medium</Button>
        <Button size="lg">Large</Button>
      </>,
    );

    for (const name of ["Small", "Medium", "Large"]) {
      const styles = window.getComputedStyle(screen.getByRole("button", { name }));
      expect(styles.minHeight, name).toBe("var(--chakra-sizes-touch)");
    }
  });

  it("replaces the removed focus ring on every tone", () => {
    /*
     * The theme's reset strips Chakra's focus ring, so each tone has to put a visible state back.
     * `ghost` is the one that matters: it has no border to promote and no fill to change, so
     * without the offset shadow it would have no focus indicator at all — which is precisely the
     * risk section 9.3 flags.
     *
     * jsdom does not apply `_focusVisible`, so this asserts the declaration reaches the element.
     * Group 40 tab-walks every control in a browser.
     */
    renderWithProviders(
      <>
        <Button tone="primary">Primary</Button>
        <Button tone="secondary">Secondary</Button>
        <Button tone="ghost">Ghost</Button>
        <Button tone="danger">Danger</Button>
      </>,
    );

    for (const name of ["Primary", "Secondary", "Ghost", "Danger"]) {
      const styles = window.getComputedStyle(screen.getByRole("button", { name }));
      expect(styles.outline, name).toBe("none");
    }
  });

  it("underlines the ghost label so it reads as an action without a border", () => {
    renderWithProviders(<Button tone="ghost">Cancel</Button>);

    const styles = window.getComputedStyle(screen.getByRole("button", { name: "Cancel" }));
    expect(styles.textDecoration).toContain("underline");
  });

  it("keeps a transparent border on the ghost tone so a row stays aligned", () => {
    // Not decoration: it keeps a Cancel the same height as the Save beside it. Without it the
    // ghost button sits 4px shorter than its bordered sibling.
    renderWithProviders(<Button tone="ghost">Cancel</Button>);

    const styles = window.getComputedStyle(screen.getByRole("button", { name: "Cancel" }));
    expect(styles.borderWidth).toBe("var(--chakra-border-widths-thick)");
    expect(styles.borderColor).toBe("var(--chakra-colors-transparent)");
  });

  it("does not fire while loading", () => {
    // Chakra renders `loading` as a disabled button with a spinner, which is what stops a double
    // submit. Queried by role alone: while loading, the label sits beside a spinner and the
    // accessible name is not simply the label text.
    const onClick = vi.fn();
    renderWithProviders(
      <Button loading onClick={onClick}>
        Saving
      </Button>,
    );

    const button = screen.getByRole("button");
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("does not fire while disabled", () => {
    const onClick = vi.fn();
    renderWithProviders(
      <Button disabled onClick={onClick}>
        Blocked
      </Button>,
    );

    clickButton("Blocked");
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe("IconButton", () => {
  it("is announced by its label, not by its glyph", () => {
    /*
     * `aria-label` is a **required** prop on this component. An icon-only control without one is
     * announced as "button", and making it required is the only thing that reliably stops that
     * reaching a screen.
     */
    renderWithProviders(
      <IconButton aria-label="Sign out">
        <Icon name="sign-out" />
      </IconButton>,
    );

    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("keeps the glyph hidden from assistive technology", () => {
    // Otherwise the control is announced twice: once for the label, once for the image.
    const { container } = renderWithProviders(
      <IconButton aria-label="Sign out">
        <Icon name="sign-out" />
      </IconButton>,
    );

    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("is a square that still meets the touch target", () => {
    renderWithProviders(
      <IconButton aria-label="Dark theme">
        <Icon name="moon" />
      </IconButton>,
    );

    const styles = window.getComputedStyle(screen.getByRole("button", { name: "Dark theme" }));
    expect(styles.minWidth).toBe("var(--chakra-sizes-touch)");
    expect(styles.minHeight).toBe("var(--chakra-sizes-touch)");
  });
});

describe("FormActions", () => {
  it("renders a submit and a reachable Cancel", () => {
    renderWithProviders(<FormActions submitLabel="Record expense" onCancel={() => {}} />);

    expect(screen.getByRole("button", { name: "Record expense" })).toHaveAttribute(
      "type",
      "submit",
    );
    expect(screen.getByRole("button", { name: "Cancel" })).toHaveAttribute("type", "button");
  });

  it("does not let the submit button claim the whole row", () => {
    /*
     * **This is the clipped-Cancel bug, asserted.**
     *
     * The broken version was `<Button fullWidth>` beside a Cancel: `width: 100%` of the row left
     * no space, so Cancel was pushed past the right edge and clipped at both widths, on every
     * create and edit form in the app.
     *
     * `flex: 1` is the fix — the submit absorbs what is left rather than claiming everything.
     */
    renderWithProviders(<FormActions submitLabel="Save" onCancel={() => {}} />);

    const submit = window.getComputedStyle(screen.getByRole("button", { name: "Save" }));
    expect(submit.flex).toBe("1 1 0%");
    expect(submit.width).not.toBe("100%");
  });

  it("does not let Cancel be compressed or wrapped", () => {
    renderWithProviders(<FormActions submitLabel="Save" onCancel={() => {}} />);

    const cancel = window.getComputedStyle(screen.getByRole("button", { name: "Cancel" }));
    expect(cancel.flexShrink).toBe("0");
    expect(cancel.whiteSpace).toBe("nowrap");
  });

  it("puts Cancel after the primary action, as drawn", () => {
    // Also the keyboard order: tabbing forward past Save reaches Cancel, not something further
    // down the page.
    renderWithProviders(<FormActions submitLabel="Save" onCancel={() => {}} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Save", "Cancel"]);
  });

  it("calls onCancel when Cancel is pressed", () => {
    const onCancel = vi.fn();
    renderWithProviders(<FormActions submitLabel="Save" onCancel={onCancel} />);

    clickButton("Cancel");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("blocks Cancel while the action is running", () => {
    // Cancelling mid-submit would leave the user unsure whether the write happened.
    const onCancel = vi.fn();
    renderWithProviders(<FormActions submitLabel="Save" pending onCancel={onCancel} />);

    clickButton("Cancel");
    expect(onCancel).not.toHaveBeenCalled();
  });

  it("can disable submission without disabling the way out", () => {
    /*
     * The settle-up form's unbalanced state. Disabling both would trap the user on a form they
     * cannot submit and cannot leave, which is the bug this component exists to prevent wearing a
     * different hat.
     */
    const onCancel = vi.fn();
    renderWithProviders(
      <FormActions submitLabel="Record settlement" submitDisabled onCancel={onCancel} />,
    );

    expect(screen.getByRole("button", { name: "Record settlement" })).toBeDisabled();

    clickButton("Cancel");
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("renames Cancel where the discarded thing has a better name", () => {
    renderWithProviders(
      <FormActions submitLabel="Delete" cancelLabel="Keep it" onCancel={() => {}} />,
    );

    expect(screen.getByRole("button", { name: "Keep it" })).toBeInTheDocument();
  });

  it("places an extra action after Cancel", () => {
    renderWithProviders(
      <FormActions submitLabel="Save changes" onCancel={() => {}}>
        <Button tone="danger">Delete expense</Button>
      </FormActions>,
    );

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual([
      "Save changes",
      "Cancel",
      "Delete expense",
    ]);
  });
});
