/**
 * Stable client-generated identifiers.
 *
 * Every record the client can create carries one. The same id must be reused
 * across retries so the server recognises a repeat as the same operation rather
 * than a second transaction (docs/08-OFFLINE-SYNC.md section 7).
 */

/** UUID v4, using the platform generator where available. */
export function newClientId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  // Fallback for environments without randomUUID; still cryptographically random.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Distinct id for one attempt at a sync operation. */
export function newOperationId(): string {
  return `op_${newClientId().replace(/-/g, "")}`;
}
