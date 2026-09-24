import { NAV_ITEMS } from "./NavItems";

/**
 * Where "up" goes, for every page that has a parent.
 *
 * ## Why this is a module and not a literal at each call site
 *
 * `{ href: "/transactions", label: "Activity" }` is needed in eight places — three transaction
 * detail components, four create forms, and the edit route. Written out eight times it would drift,
 * and the specific way it would drift is the one thing the back link must not do: **say a different
 * name for a place than the tab bar says.** A user who taps "Activity" in the tab bar and then sees
 * "‹ TRANSACTIONS" on a detail page has been shown two names for one screen.
 *
 * So the nav-destination parents are *derived from* `NAV_ITEMS` rather than re-typed beside it.
 * `navParent` throws if the href is not a nav item, which turns a renamed or removed route into an
 * immediate error rather than a back link pointing at a 404.
 *
 * This is the same argument `NavItems.ts` makes for sharing one list between the header and the tab
 * bar, extended one level outward.
 *
 * ## Why `/settlements` is written out
 *
 * It is the one parent that is not a nav destination, by decision — see
 * `docs/navigation-tasks/updates/GROUP-42-NAVIGATION-DECISIONS.md` section 3.2. A sixth tab would
 * have cost every label ~17% of its width at 402px, which is the crushed-label bug the restyle
 * closed twice. It is reachable from the dashboard and from `/people` instead, and its detail page
 * now has a back link, which is what made the dead end a non-issue without touching the tab bar.
 */

export type PageParent = {
  href: string;
  label: string;
};

/**
 * A parent that is one of the five nav destinations, with the label the navigation itself uses.
 *
 * Throws rather than falling back. A missing nav item here means a route was renamed and this module
 * was not updated, and a back link silently pointing somewhere wrong is worse than a build that
 * stops.
 */
function navParent(href: string): PageParent {
  const item = NAV_ITEMS.find((navItem) => navItem.href === href);

  if (!item) {
    throw new Error(
      `No nav item for "${href}". A page parent must match a NAV_ITEMS entry so the back link and ` +
        `the navigation cannot name the same destination differently.`,
    );
  }

  return { href: item.href, label: item.label };
}

/**
 * The section-level parents — where a list page sits.
 *
 * Used by every create form and every detail page.
 */
export const PARENTS = {
  /** "Accounts" */
  accounts: navParent("/accounts"),
  /** "People" */
  people: navParent("/people"),
  /** "Activity" — note the label, which is *not* "Transactions". */
  transactions: navParent("/transactions"),
  /** Not a nav destination. See the note above. */
  settlements: { href: "/settlements", label: "Settlements" } as PageParent,
} as const;

/* ------------------------------------------------------------------ *
 * Record-level parents
 * ------------------------------------------------------------------ */

/**
 * The record a child page belongs to, labelled with the record's own name.
 *
 * An edit form's parent is the **record**, not the section list: cancelling out of
 * `/accounts/[id]/edit` should land on the account that was being edited, where the change is
 * visible, rather than at the top of a list the user then has to search.
 *
 * The name is already on screen in these cases — `PageHeader`'s `description` carries it — so this
 * makes an existing string into a destination rather than adding one.
 */
export function accountParent(id: string, name: string): PageParent {
  return { href: `/accounts/${id}`, label: name };
}

export function personParent(id: string, name: string): PageParent {
  return { href: `/people/${id}`, label: name };
}

/**
 * A transaction, for its edit page.
 *
 * `description` is never empty — it is a required field on every transaction type — so there is no
 * fallback label here. A transfer's description is its `directionLabel` ("HDFC Savings → Cash"),
 * which is what the detail page titles itself with too.
 */
export function transactionParent(id: string, description: string): PageParent {
  return { href: `/transactions/${id}`, label: description };
}
