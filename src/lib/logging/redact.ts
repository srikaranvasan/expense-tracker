/**
 * Keys whose values must never reach the logs
 * (docs/12-SECURITY-AND-ERROR-HANDLING.md section 39).
 */
const SENSITIVE_KEYS = new Set(
  [
    "password",
    "passwordhash",
    "newpassword",
    "currentpassword",
    "token",
    "accesstoken",
    "refreshtoken",
    "idtoken",
    "sessiontoken",
    "authorization",
    "cookie",
    "secret",
    "authsecret",
    "apikey",
    "mongodb_uri",
    "mongodburi",
    "connectionstring",
    "cardnumber",
    "cvv",
    "pin",
  ].map((key) => key.toLowerCase()),
);

/**
 * Financial content is not a secret, but it is private. Amounts and free-text
 * fields are dropped from log payloads unless a caller explicitly opts in.
 */
const PRIVATE_KEYS = new Set(
  ["amount", "openingbalance", "creditlimit", "notes", "description", "shareamount"].map((key) =>
    key.toLowerCase(),
  ),
);

const REDACTED = "[redacted]";
const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 20;
const MAX_STRING_LENGTH = 512;

export type RedactOptions = { includePrivate?: boolean };

/**
 * Produces a log-safe copy of an arbitrary value: secrets removed, private
 * financial fields dropped, depth and size bounded.
 */
export function redact(value: unknown, options: RedactOptions = {}, depth = 0): unknown {
  if (value === null || value === undefined) return value;

  if (depth > MAX_DEPTH) return "[truncated]";

  if (typeof value === "string") {
    return value.length > MAX_STRING_LENGTH ? `${value.slice(0, MAX_STRING_LENGTH)}…` : value;
  }

  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return value;
  }

  if (value instanceof Date) return value.toISOString();

  if (value instanceof Error) {
    return { name: value.name, message: value.message };
  }

  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_ARRAY_ITEMS).map((item) => redact(item, options, depth + 1));
    if (value.length > MAX_ARRAY_ITEMS) items.push(`[+${value.length - MAX_ARRAY_ITEMS} more]`);
    return items;
  }

  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(source)) {
      const normalized = key.toLowerCase();

      if (SENSITIVE_KEYS.has(normalized)) {
        result[key] = REDACTED;
        continue;
      }
      if (!options.includePrivate && PRIVATE_KEYS.has(normalized)) {
        continue;
      }
      result[key] = redact(item, options, depth + 1);
    }

    return result;
  }

  return REDACTED;
}
