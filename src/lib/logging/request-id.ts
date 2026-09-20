import { REQUEST_ID_HEADER } from "@/config/constants";

const REQUEST_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

/** Generates a correlation id such as `req_9f2c...`. */
export function generateRequestId(): string {
  return `req_${randomToken(16)}`;
}

/**
 * Uses an inbound request id when it looks safe, otherwise generates one.
 *
 * Client-supplied values are validated so a caller cannot inject newlines or
 * arbitrary text into the logs.
 */
export function resolveRequestId(headers: Headers | Record<string, string | undefined>): string {
  const incoming =
    headers instanceof Headers
      ? headers.get(REQUEST_ID_HEADER)
      : (headers[REQUEST_ID_HEADER] ?? headers[REQUEST_ID_HEADER.toUpperCase()]);

  if (incoming && REQUEST_ID_PATTERN.test(incoming)) return incoming;
  return generateRequestId();
}

/** Cryptographically random URL-safe token. */
export function randomToken(byteLength: number): string {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);

  let result = "";
  for (const byte of bytes) {
    result += byte.toString(16).padStart(2, "0");
  }
  return result;
}

export { REQUEST_ID_HEADER };
