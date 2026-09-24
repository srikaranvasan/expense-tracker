import type { ReactNode } from "react";
import { Flex } from "@chakra-ui/react";
import { Button } from "./Button";

/**
 * The submit-and-cancel row at the foot of every form.
 *
 * ## Why this is a component and not a documented pattern
 *
 * It exists to make the clipped-Cancel bug unrepresentable. That bug
 * (`docs/design-tasks/01-DESIGN-SYSTEM.md` section 9.2) was not a styling slip — it was eight
 * forms independently writing:
 *
 * ```tsx
 * <HStack gap="3">
 *   <Button type="submit" fullWidth>Save</Button>
 *   <Button tone="secondary">Cancel</Button>
 * </HStack>
 * ```
 *
 * `fullWidth` is `width: 100%` of the row, so Cancel is pushed past the right edge and clipped.
 * At both widths, on every create and edit form, there was **no reachable way to cancel anything
 * in the application**.
 *
 * Fixing eight copies would have fixed it once. A ninth form would reintroduce it, because the
 * broken version is the one that looks obvious. So the row is a component, the submit button is
 * built by it rather than passed in, and there is no `fullWidth` anywhere near it.
 *
 * ## The geometry, from section 7.1
 *
 * ```text
 * primary   flex: 1                       takes the space that is left
 * cancel    flex-shrink: 0, nowrap        never gives up its label
 * order     primary first, cancel after   as drawn
 * ```
 *
 * `flex: 1` and `flex-shrink: 0` are the whole fix: the primary absorbs the remaining width
 * instead of claiming all of it, and Cancel refuses to be compressed or wrapped.
 */

export type FormActionsProps = {
  /** Label on the submit button, e.g. "Record expense". */
  submitLabel: string;
  /** Disables and spins the submit button while the action runs. */
  pending?: boolean;
  /** Blocks submission for a reason the form has already explained. */
  submitDisabled?: boolean;
  /**
   * What Cancel does.
   *
   * Required. A form with no way out is the bug this component exists to prevent, so there is no
   * way to render this row without one.
   *
   * **Push to the form's parent route** — `router.push("/accounts")` on a create,
   * `router.push("/accounts/<id>")` on an edit. An inline form passes its own dismiss handler.
   *
   * It used to be `router.back()`, and group 46 replaced all seven of those. `back()` is correct
   * only when the user arrived by clicking a link: on a cold URL it goes nowhere, after a refresh it
   * returns to the same form, and from the quick-add button it can land on any screen in the app,
   * because that button is on all of them
   * (`docs/navigation-tasks/01-NAVIGATION-AUDIT.md` section 4.3).
   *
   * So this component guarantees a Cancel exists; passing it a hierarchy route is what makes the
   * Cancel go somewhere predictable, and it keeps Cancel agreeing with the back link that
   * `PageHeader` renders above the form.
   */
  onCancel: () => void;
  /** Defaults to "Cancel". Overridden where the discarded thing has a better name. */
  cancelLabel?: string;
  /**
   * Extra controls, placed after Cancel.
   *
   * For a destructive action that belongs in the same row — "Delete expense" on an edit form.
   * Kept out of the flex-grow so it cannot squeeze Cancel.
   */
  children?: ReactNode;
};

export function FormActions({
  submitLabel,
  pending,
  submitDisabled,
  onCancel,
  cancelLabel = "Cancel",
  children,
}: FormActionsProps) {
  return (
    <Flex
      // Wraps rather than overflows if a translated label makes the row genuinely too long. That
      // is the honest failure mode: a second line, not a hidden button.
      wrap="wrap"
      align="center"
      gap="3"
      // 28px above on desktop, 22px on mobile — the vertical rhythm from section 8.
      pt={{ base: "22px", md: "28px" }}
    >
      <Button type="submit" size="lg" loading={pending} disabled={submitDisabled} flex="1">
        {submitLabel}
      </Button>

      {/*
        A ghost button, underlined, *after* the primary. All three are from the style guide, and
        the order is the part that matters: the destination for a keyboard user tabbing forward
        past Save is Cancel, not something further down the page.
      */}
      <Button
        type="button"
        tone="ghost"
        size="lg"
        onClick={onCancel}
        disabled={pending}
        flexShrink="0"
        whiteSpace="nowrap"
      >
        {cancelLabel}
      </Button>

      {children}
    </Flex>
  );
}
