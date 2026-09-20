/**
 * Date helpers.
 *
 * Timestamps are stored in UTC and grouped using the user's timezone
 * (docs/02-DATA-MODEL.md section 27). Every function here takes the timezone
 * explicitly so no call site silently falls back to the server's locale.
 */

export type Timezone = string;

export function nowUtc(): Date {
  return new Date();
}

export function isValidDate(value: unknown): value is Date {
  return value instanceof Date && !Number.isNaN(value.getTime());
}

export function parseIsoDate(value: string): Date | null {
  const parsed = new Date(value);
  return isValidDate(parsed) ? parsed : null;
}

export function toIsoString(date: Date): string {
  return date.toISOString();
}

type DateParts = { year: number; month: number; day: number; hour: number; minute: number };

/** Wall-clock parts of a UTC instant as seen in `timezone`. */
export function getZonedParts(date: Date, timezone: Timezone): DateParts {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const lookup = (type: Intl.DateTimeFormatPartTypes): number => {
    const value = parts.find((part) => part.type === type)?.value ?? "0";
    return Number.parseInt(value, 10);
  };

  return {
    year: lookup("year"),
    month: lookup("month"),
    day: lookup("day"),
    hour: lookup("hour") % 24,
    minute: lookup("minute"),
  };
}

/**
 * Offset in minutes between `timezone` and UTC at the given instant.
 * Positive east of UTC. Computed from Intl so DST is handled.
 */
export function getTimezoneOffsetMinutes(date: Date, timezone: Timezone): number {
  const parts = getZonedParts(date, timezone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const truncatedUtc = Math.floor(date.getTime() / 60_000) * 60_000;
  return (asUtc - truncatedUtc) / 60_000;
}

/** UTC instant for local midnight of the given instant's day in `timezone`. */
export function startOfDayInTimezone(date: Date, timezone: Timezone): Date {
  const { year, month, day } = getZonedParts(date, timezone);
  return zonedWallClockToUtc(year, month, day, 0, 0, timezone);
}

/** UTC instant for the last millisecond of the given instant's local day. */
export function endOfDayInTimezone(date: Date, timezone: Timezone): Date {
  const start = startOfDayInTimezone(date, timezone);
  return new Date(addDays(start, 1).getTime() - 1);
}

/** UTC instant for local midnight on the 1st of the given instant's month. */
export function startOfMonthInTimezone(date: Date, timezone: Timezone): Date {
  const { year, month } = getZonedParts(date, timezone);
  return zonedWallClockToUtc(year, month, 1, 0, 0, timezone);
}

/** UTC instant for the last millisecond of the given instant's local month. */
export function endOfMonthInTimezone(date: Date, timezone: Timezone): Date {
  const { year, month } = getZonedParts(date, timezone);
  const nextMonthYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextMonthStart = zonedWallClockToUtc(nextMonthYear, nextMonth, 1, 0, 0, timezone);
  return new Date(nextMonthStart.getTime() - 1);
}

/**
 * Converts a wall-clock time in `timezone` to the matching UTC instant.
 *
 * Applies the offset twice because the offset itself depends on the instant
 * (DST boundaries), and the second pass settles on the correct value.
 */
export function zonedWallClockToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  timezone: Timezone,
): Date {
  const naiveUtc = Date.UTC(year, month - 1, day, hour, minute);
  const firstGuess = new Date(
    naiveUtc - getTimezoneOffsetMinutes(new Date(naiveUtc), timezone) * 60_000,
  );
  const correction = getTimezoneOffsetMinutes(firstGuess, timezone);
  return new Date(naiveUtc - correction * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

export function addMonthsInTimezone(date: Date, months: number, timezone: Timezone): Date {
  const { year, month, day, hour, minute } = getZonedParts(date, timezone);
  const totalMonths = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonth = (totalMonths % 12) + 1;
  const clampedDay = Math.min(day, daysInMonth(targetYear, targetMonth));
  return zonedWallClockToUtc(targetYear, targetMonth, clampedDay, hour, minute, timezone);
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** `YYYY-MM-DD` in the given timezone. Used for grouping. */
export function formatDateKey(date: Date, timezone: Timezone): string {
  const { year, month, day } = getZonedParts(date, timezone);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** `YYYY-MM` in the given timezone. Used for monthly grouping. */
export function formatMonthKey(date: Date, timezone: Timezone): string {
  const { year, month } = getZonedParts(date, timezone);
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function isSameDayInTimezone(left: Date, right: Date, timezone: Timezone): boolean {
  return formatDateKey(left, timezone) === formatDateKey(right, timezone);
}
