/**
 * Escapes regular-expression metacharacters.
 *
 * Search terms reach MongoDB as `$regex` values. Without escaping, a user typing
 * `.*` would run an unbounded pattern, and `(` would be a syntax error
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 13).
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Collapses whitespace and trims. */
export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function truncate(value: string, maxLength: number): string {
  return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1)}…`;
}

/** First letters of a name, for avatar placeholders. */
export function initials(name: string, maxLetters = 2): string {
  return normalizeWhitespace(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, maxLetters)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}
