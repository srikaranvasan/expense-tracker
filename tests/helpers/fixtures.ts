import { money } from "@/lib/money";
import type { Money } from "@/lib/money";

/** Shorthand for building test amounts in the default test currency. */
export function inr(amount: string | number): Money {
  return money(amount, "INR");
}

let counter = 0;

/** Unique client id per call, mirroring what a real client would generate. */
export function clientId(prefix = "test"): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter.toString(36)}-aaaaaaaa`;
}

export function operationId(prefix = "op"): string {
  return clientId(prefix);
}

/** A fixed date so assertions are not affected by the clock. */
export function fixedDate(iso = "2026-08-31T12:00:00.000Z"): Date {
  return new Date(iso);
}
