import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@tests/helpers/render";
import { Alert } from "@/components/feedback/Alert";
import { NAV_ITEMS } from "@/components/layout/NavItems";
import {
  PARENTS,
  accountParent,
  personParent,
  transactionParent,
} from "@/components/layout/Parents";
import { AppLink } from "@/components/ui/AppLink";
import { FormActions } from "@/components/ui/FormActions";

/**
 * The navigation series (groups 42-48).
 *
 * ## Why these assertions and not others
 *
 * Every screen this series touched already rendered, compiled and passed its tests **before** the
 * work — a missing back link is invisible to a type checker and to every visual check. So what is
 * asserted here is specifically the set of things that were silently wrong:
 *
 *  - a parent route's label agreeing with the tab bar's label for the same place
 *  - Cancel landing somewhere hierarchical rather than wherever history happened to point
 *  - a guard alert carrying an action, not just a sentence telling the user to go somewhere
 *
 * The per-screen wiring (`parent={PARENTS.accounts}` on `/accounts/[id]`) is asserted by
 * `tests/e2e/navigation.spec.ts`, which walks the real routes with a real browser — that is the only
 * place a *cold URL* can be opened, and the cold URL is the case `router.back()` got wrong.
 */

const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
  usePathname: () => "/transactions/new",
  useRouter: () => ({ push: routerPush, back: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  routerPush.mockClear();
});

describe("page parents", () => {
  it("takes its label from the navigation, so the two cannot disagree", () => {
    /*
     * The failure this prevents is a user tapping "Activity" in the tab bar, opening a record, and
     * being offered "‹ TRANSACTIONS" — two names for one screen. `PARENTS` derives from `NAV_ITEMS`
     * rather than repeating it, and this asserts the derivation rather than the current strings.
     */
    for (const parent of [PARENTS.accounts, PARENTS.people, PARENTS.transactions]) {
      const navItem = NAV_ITEMS.find((item) => item.href === parent.href);
      expect(navItem).toBeDefined();
      expect(parent.label).toBe(navItem!.label);
    }
  });

  it('labels /transactions "Activity", which is not its path', () => {
    // The one parent where the obvious guess is wrong, and the reason the derivation matters.
    expect(PARENTS.transactions.href).toBe("/transactions");
    expect(PARENTS.transactions.label).toBe("Activity");
  });

  it("carries settlements, which is deliberately not a nav destination", () => {
    /*
     * Group 42 section 3.2: a sixth tab would have taken ~17% off every label's width at 402px, which
     * is the crushed-label bug the restyle closed twice. Reachability was fixed with links instead —
     * so this parent is written out rather than derived, and that is intentional.
     */
    expect(PARENTS.settlements).toEqual({ href: "/settlements", label: "Settlements" });
    expect(NAV_ITEMS.some((item) => item.href === "/settlements")).toBe(false);
  });

  it("points a record's child page at the record, labelled with its name", () => {
    // An edit form's parent is the thing being edited, not the top of a list the user must re-search.
    expect(accountParent("abc", "HDFC Savings")).toEqual({
      href: "/accounts/abc",
      label: "HDFC Savings",
    });
    expect(personParent("xyz", "Priya Menon")).toEqual({
      href: "/people/xyz",
      label: "Priya Menon",
    });
    expect(transactionParent("t1", "Big Basket groceries")).toEqual({
      href: "/transactions/t1",
      label: "Big Basket groceries",
    });
  });
});

describe("Cancel destination", () => {
  it("pushes to a route instead of walking history", () => {
    /*
     * The defect being fixed (audit 4.3). `router.back()` was correct only when the user had clicked in
     * from a link. On a cold URL it went nowhere; after a refresh it returned to the same form; and
     * from the quick-add button — which is on every authenticated screen — it could land anywhere at
     * all.
     *
     * `FormActions` is unchanged: `onCancel` is still required and the row's geometry is untouched.
     * What changed is what the eight callers pass it.
     */
    renderWithProviders(
      <FormActions submitLabel="Save changes" onCancel={() => routerPush("/accounts/abc")} />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(routerPush).toHaveBeenCalledWith("/accounts/abc");
  });

  it("still refuses to render a form row with no way out", () => {
    // `onCancel` stays required. Group 27 made an unreachable Cancel unrepresentable; this series only
    // changed where it goes, and that guarantee must survive.
    renderWithProviders(<FormActions submitLabel="Save" onCancel={() => {}} />);
    expect(screen.getByRole("button", { name: "Cancel" })).toBeEnabled();
  });
});

describe("guard alerts", () => {
  it("carries an action to the record it tells the user to create", () => {
    /*
     * All five prerequisite guards said "Add an account first" and did not link anywhere (audit 5.7).
     * Worse, a guard replaces the whole form — so `FormActions` never renders and there was no Cancel
     * either. These screens are the most common first experience in the app, and nothing on them moved.
     */
    renderWithProviders(
      <Alert
        tone="warning"
        title="Add an account first"
        action={<AppLink href="/accounts/new">Add an account</AppLink>}
      >
        An expense has to be paid from somewhere.
      </Alert>,
    );

    expect(screen.getByRole("link", { name: "Add an account" })).toHaveAttribute(
      "href",
      "/accounts/new",
    );
  });

  it("places the action below the prose, not beside the icon", () => {
    const { container } = renderWithProviders(
      <Alert
        tone="warning"
        title="Add someone first"
        action={<AppLink href="/people/new">Add</AppLink>}
      >
        A shared expense needs at least one other person.
      </Alert>,
    );

    // The action belongs to the text stack, so it aligns with the description rather than the glyph.
    const description = screen.getByText("A shared expense needs at least one other person.");
    const action = screen.getByRole("link", { name: "Add" });
    expect(description.parentElement).toContainElement(action);
    expect(container.querySelector("svg")).not.toContainElement(action);
  });

  it("renders unchanged when it has no action, which most alerts do not", () => {
    renderWithProviders(<Alert tone="error">Something went wrong.</Alert>);

    expect(screen.getByText("Something went wrong.")).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
