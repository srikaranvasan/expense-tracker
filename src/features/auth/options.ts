import { SUPPORTED_CURRENCIES } from "@/config/constants";

/**
 * Plain option lists for the auth forms.
 *
 * Kept out of the schema module so the client bundle does not have to pull in the
 * validation library just to render two `<select>` elements.
 */

export const currencyOptions: readonly string[] = SUPPORTED_CURRENCIES;

/**
 * Common IANA zones offered in the picker. Any valid zone is accepted by the
 * schema; this list only shapes the UI.
 */
export const commonTimezones = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "Europe/Berlin",
  "America/New_York",
  "America/Los_Angeles",
  "Australia/Sydney",
  "UTC",
] as const;

export type CommonTimezone = (typeof commonTimezones)[number];
