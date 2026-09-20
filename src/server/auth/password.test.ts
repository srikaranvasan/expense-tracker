import { describe, expect, it } from "vitest";
import { fakeVerifyPassword, hashPassword, verifyPassword } from "./password";

describe("password hashing", () => {
  it("produces a bcrypt hash that verifies", async () => {
    const hash = await hashPassword("correct-horse-battery");

    expect(hash.startsWith("$2")).toBe(true);
    expect(hash).not.toContain("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
  });

  it("rejects the wrong password", async () => {
    const hash = await hashPassword("correct-horse-battery");
    expect(await verifyPassword("Correct-horse-battery", hash)).toBe(false);
    expect(await verifyPassword("", hash)).toBe(false);
  });

  it("salts, so the same password hashes differently each time", async () => {
    const [first, second] = await Promise.all([
      hashPassword("same-value"),
      hashPassword("same-value"),
    ]);
    expect(first).not.toBe(second);
  });

  it("fails closed on a malformed stored hash instead of throwing", async () => {
    expect(await verifyPassword("anything", "not-a-bcrypt-hash")).toBe(false);
    expect(await verifyPassword("anything", "")).toBe(false);
  });

  it("always reports failure for the timing-equalising path", async () => {
    expect(await fakeVerifyPassword()).toBe(false);
  });
});
