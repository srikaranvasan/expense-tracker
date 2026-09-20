import type { Money } from "./money";
import { currencyScale } from "./money";

/**
 * Presentation-only currency formatting.
 *
 * Formatting never feeds back into calculations: the authoritative value stays a
 * `Money`, and this produces a display string.
 */
export function formatMoney(
  value: Money,
  options: { locale?: string; showSign?: boolean; compact?: boolean } = {},
): string {
  const { locale = "en-IN", showSign = false, compact = false } = options;
  const scale = currencyScale(value.currency);

  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: compact ? 0 : scale,
    maximumFractionDigits: scale,
    ...(showSign ? { signDisplay: "exceptZero" as const } : {}),
  });

  // Intl needs a JS number. This is display-only; the Money value is unchanged.
  return formatter.format(Number(value.toFixedString()));
}

/** Currency symbol only, for use next to a numeric input. */
export function currencySymbol(currency: string, locale = "en-IN"): string {
  const parts = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).formatToParts(0);

  return parts.find((part) => part.type === "currency")?.value ?? currency;
}
