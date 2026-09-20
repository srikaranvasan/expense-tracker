import { formatDateKey, getZonedParts, isSameDayInTimezone, nowUtc } from "./date-utils";
import type { Timezone } from "./date-utils";

/** Presentation-only date formatting. */

export function formatDate(date: Date, timezone: Timezone, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTime(date: Date, timezone: Timezone, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export function formatMonthLabel(date: Date, timezone: Timezone, locale = "en-IN"): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    month: "long",
    year: "numeric",
  }).format(date);
}

/** "Today" / "Yesterday" / a short date, for grouping transaction lists. */
export function formatRelativeDayLabel(
  date: Date,
  timezone: Timezone,
  locale = "en-IN",
  reference: Date = nowUtc(),
): string {
  if (isSameDayInTimezone(date, reference, timezone)) return "Today";

  const yesterday = new Date(reference.getTime() - 86_400_000);
  if (isSameDayInTimezone(date, yesterday, timezone)) return "Yesterday";

  const sameYear = getZonedParts(date, timezone).year === getZonedParts(reference, timezone).year;

  return new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "short",
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/** Value for an `<input type="date">`, expressed in the user's timezone. */
export function toDateInputValue(date: Date, timezone: Timezone): string {
  return formatDateKey(date, timezone);
}
