import type { IconName } from "@/components/icons/names";

/**
 * The five primary destinations, with their glyphs.
 *
 * Shared by the desktop header and the bottom tab bar so the two cannot disagree about the order,
 * the labels or the icons — which they previously could, because each held its own copy of the list.
 * `docs/04-USER-FLOWS.md` section 2 treats them as one navigation shown two ways.
 *
 * A plain `.ts` module with no React in it, so both a Server Component header and a Client Component
 * tab bar can import it.
 */
export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
};

export const NAV_ITEMS: readonly NavItem[] = [
  { href: "/dashboard", label: "Home", icon: "home" },
  { href: "/transactions", label: "Activity", icon: "activity" },
  { href: "/accounts", label: "Accounts", icon: "accounts" },
  { href: "/people", label: "People", icon: "people" },
  { href: "/categories", label: "Categories", icon: "categories" },
];

/**
 * Whether a nav item is the current section.
 *
 * Prefix matching, so `/accounts/abc/edit` still highlights Accounts — a user three levels into a
 * section should still be able to see which section they are in. The trailing slash matters: without
 * it `/people` would also match a hypothetical `/peoplesomething`.
 */
export function isActiveNavItem(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
