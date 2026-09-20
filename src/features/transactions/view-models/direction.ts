/**
 * Formatting for a two-sided money movement.
 *
 * Transfers and credit-card payments both read as "source → destination", and both
 * the list row, the detail screen and the delete confirmation must describe the same
 * record identically. One function keeps them honest.
 */

/**
 * An account name is only missing when the account was hard-deleted out from under a
 * historical record, so a neutral placeholder is better than a bare arrow.
 */
export function formatAccountDirection(from: string | null, to: string | null): string {
  return `${from ?? "Unknown account"} → ${to ?? "Unknown account"}`;
}
