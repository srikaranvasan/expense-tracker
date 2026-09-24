import { money } from "@/lib/money";
import type { Money } from "@/lib/money";

/** Shorthand for building test amounts in the default test currency. */
export function inr(amount: string | number): Money {
  return money(amount, "INR");
}

let counter = 0;

/**
 * Unique client id per call, mirroring what a real client would generate.
 *
 * The **trailing** segment is the one that varies, and that is deliberate. Group 32 derives a record's
 * ledger reference from the last five characters of its `clientId`, so a fixture ending in a constant
 * suffix gives every record in a test the same reference code. This one used to end `-aaaaaaaa`, and
 * `tests/integration/reference-codes.test.ts` found it: thirty distinct expenses, one distinct code.
 *
 * A real `clientId` is a UUID v4 (`lib/utils/client-id.ts`) whose tail is random, so varying the end is
 * also the more faithful imitation. The prefix stays because it makes a failure message readable.
 */
export function clientId(prefix = "test"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36).padStart(8, "0")}`;
}

export function operationId(prefix = "op"): string {
  return clientId(prefix);
}

/** A fixed date so assertions are not affected by the clock. */
export function fixedDate(iso = "2026-08-31T12:00:00.000Z"): Date {
  return new Date(iso);
}
