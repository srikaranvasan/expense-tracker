import type { IconName } from "@/components/icons/names";

/**
 * The four records a user comes to this app to create.
 *
 * One list, two consumers: the mobile quick-add FAB (7.7) and the dashboard's quick-action row
 * (`features/dashboard/components/QuickActions.tsx`). They previously could not exist without
 * disagreeing, because the FAB is new and would have carried its own copy of the same four labels
 * and routes — the exact drift `NavItems.ts` was created to stop for navigation.
 *
 * The labels are the ones group 21 settled on (2.7): the **action** wording, named for the business
 * event rather than the mechanism. "Pay card", not "transfer to card"; "Split a bill", not "shared
 * expense". The type labels that appear on a saved record are a different vocabulary and live with
 * the components that render them.
 *
 * Declared primary-first, which is the dashboard's left-to-right order. The FAB stack renders it
 * reversed, because a menu that opens upward reads from the button outward — see `QuickAdd.tsx`.
 *
 * A plain `.ts` module with no React in it, so a Server Component row and a Client Component FAB can
 * both import it.
 */
export type QuickAddAction = {
  href: string;
  label: string;
  icon: IconName;
  /** The one action that carries the teal fill. Exactly one entry sets this. */
  primary?: boolean;
};

export const QUICK_ADD_ACTIONS: readonly QuickAddAction[] = [
  { href: "/transactions/new", label: "Add expense", icon: "plus", primary: true },
  { href: "/transactions/new/shared", label: "Split a bill", icon: "split" },
  { href: "/transactions/new/transfer", label: "Transfer", icon: "transfer" },
  { href: "/transactions/new/card-payment", label: "Pay card", icon: "card" },
];
