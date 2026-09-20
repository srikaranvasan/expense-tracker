import { describe, expect, it } from "vitest";
import { LIMITS, PAGINATION } from "@/config/constants";
import {
  clientIdString,
  currencyCode,
  emailAddress,
  entityName,
  isoDate,
  moneyString,
  nonNegativeMoneyString,
  objectIdString,
  paginationQuery,
  password,
  percentageString,
  positiveMoneyString,
  searchParamsToObject,
} from "./helpers";

/**
 * The Zod primitives every request boundary is built from.
 *
 * Covered indirectly by more than 400 integration tests, which is how they were verified up
 * to group 18. Tested directly here because they are the first line of defence on every
 * route and the cheapest place to get money wrong: `moneyString` is where a float would
 * become the authoritative value if the normalisation ever stopped happening
 * (docs/06-CODING-PRACTICES.md section 7).
 */

const ok = <T>(
  schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  value: unknown,
) => {
  const result = schema.safeParse(value);
  expect(result.success, `expected ${JSON.stringify(value)} to be accepted`).toBe(true);
  return result.data as T;
};

const rejected = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => {
  expect(schema.safeParse(value).success, `expected ${JSON.stringify(value)} to be rejected`).toBe(
    false,
  );
};

describe("objectIdString", () => {
  it("accepts a 24-character hexadecimal id in either case", () => {
    expect(ok(objectIdString, "0123456789abcdef01234567")).toBe("0123456789abcdef01234567");
    expect(ok(objectIdString, "0123456789ABCDEF01234567")).toBe("0123456789ABCDEF01234567");
  });

  it("trims surrounding whitespace", () => {
    expect(ok(objectIdString, "  0123456789abcdef01234567  ")).toBe("0123456789abcdef01234567");
  });

  it.each([
    ["too short", "abc"],
    ["too long", "0123456789abcdef012345678"],
    ["non-hexadecimal", "zzzzzzzzzzzzzzzzzzzzzzzz"],
    ["a Mongo operator", '{"$ne":null}'],
    ["a path traversal", "../../etc/passwd"],
    ["whitespace only", "   "],
    ["empty", ""],
  ])("rejects %s", (_label, value) => {
    // This is the gate that stops a hostile string reaching the driver, so each of these
    // shapes must fail here rather than deeper (docs/12 section 13).
    rejected(objectIdString, value);
  });
});

describe("clientIdString", () => {
  it("accepts the shape the offline queue generates", () => {
    expect(ok(clientIdString, "txn-550e8400-e29b-41d4")).toBe("txn-550e8400-e29b-41d4");
    expect(ok(clientIdString, "a_b-C9xy")).toBe("a_b-C9xy");
  });

  it.each([
    ["shorter than 8 characters", "short"],
    ["longer than 64", "a".repeat(65)],
    ["containing a dot", "txn.550e8400"],
    ["containing a slash", "txn/550e8400"],
    ["containing a space", "txn 550e8400"],
  ])("rejects an id %s", (_label, value) => {
    rejected(clientIdString, value);
  });

  it("keeps the id byte-for-byte, because a retry must reuse it exactly", () => {
    // A transformed clientId would make a retry look like a new operation and create a
    // duplicate transaction (docs/08-OFFLINE-SYNC.md section 7).
    const id = "txn-550e8400-e29b-41d4-a716-446655440000";
    expect(ok(clientIdString, id)).toBe(id);
  });
});

describe("moneyString", () => {
  it("normalises a number to a decimal string", () => {
    // The point of the union: a number is accepted for convenience and immediately becomes a
    // string, so no float is ever the authoritative value.
    expect(ok(moneyString, 450)).toBe("450");
    expect(typeof ok(moneyString, 450)).toBe("string");
  });

  it("preserves precision that a float would lose", () => {
    expect(ok(moneyString, "0.1")).toBe("0.1");
    expect(ok(moneyString, "1234567.891234")).toBe("1234567.891234");
  });

  it("accepts a negative amount, which opening balances need", () => {
    expect(ok(moneyString, "-2500.50")).toBe("-2500.5");
  });

  it.each([
    ["text", "not a number"],
    ["an empty string", ""],
    ["Infinity", "Infinity"],
    ["-Infinity", "-Infinity"],
    ["NaN", "NaN"],
    ["a boolean", true],
    ["null", null],
    ["an object", { amount: 1 }],
  ])("rejects %s", (_label, value) => {
    rejected(moneyString, value);
  });

  it("rejects an amount beyond the configured maximum, in both directions", () => {
    const beyond = `${Number(LIMITS.maxTransactionAmount) * 10}`;
    rejected(moneyString, beyond);
    rejected(moneyString, `-${beyond}`);
  });

  it("accepts exactly the maximum", () => {
    expect(ok(moneyString, LIMITS.maxTransactionAmount)).toBe(LIMITS.maxTransactionAmount);
  });

  it("rejects more precision than any currency has", () => {
    // Six places is the storage limit; beyond it a rounding decision would be made silently,
    // which section 55 forbids.
    rejected(moneyString, "1.1234567");
  });
});

describe("positiveMoneyString", () => {
  it("accepts the smallest amount a rupee account can hold", () => {
    expect(ok(positiveMoneyString, "0.01")).toBe("0.01");
  });

  it.each([
    ["zero", "0"],
    ["zero with decimals", "0.00"],
    ["negative", "-1"],
  ])("rejects %s", (_label, value) => {
    // A zero-amount expense is a data-entry mistake, not a financial event.
    rejected(positiveMoneyString, value);
  });
});

describe("nonNegativeMoneyString", () => {
  it("accepts zero", () => {
    expect(ok(nonNegativeMoneyString, "0")).toBe("0");
  });

  it("rejects a negative amount", () => {
    rejected(nonNegativeMoneyString, "-0.01");
  });
});

describe("percentageString", () => {
  it("accepts the boundaries and a fractional share", () => {
    expect(ok(percentageString, "0")).toBe("0");
    expect(ok(percentageString, "100")).toBe("100");
    expect(ok(percentageString, "33.333333")).toBe("33.333333");
  });

  it.each([
    ["above 100", "100.01"],
    ["negative", "-1"],
  ])("rejects a percentage %s", (_label, value) => {
    rejected(percentageString, value);
  });
});

describe("isoDate", () => {
  it("yields a Date from an ISO string", () => {
    const parsed = ok(isoDate, "2026-08-15T10:00:00.000Z");
    expect(parsed).toBeInstanceOf(Date);
    expect(parsed.toISOString()).toBe("2026-08-15T10:00:00.000Z");
  });

  it("passes a Date through", () => {
    const date = new Date("2026-08-15T10:00:00.000Z");
    expect(ok(isoDate, date).getTime()).toBe(date.getTime());
  });

  it.each([
    ["not a date", "yesterday"],
    ["empty", ""],
    ["before 1970", "1900-01-01T00:00:00.000Z"],
    ["after 2200", "2500-01-01T00:00:00.000Z"],
  ])("rejects a date that is %s", (_label, value) => {
    rejected(isoDate, value);
  });

  it("rolls an impossible calendar date forward instead of rejecting it", () => {
    /*
     * Documents a real limitation rather than asserting desired behaviour.
     *
     * `new Date("2026-02-30")` does not produce NaN — JavaScript rolls it to 2 March — so
     * the NaN check cannot catch it. A date picker cannot produce 30 February, but the REST
     * and sync paths can, and the result is an expense silently dated two days later.
     *
     * Pinned here so the behaviour is visible and any future change to `isoDate` is a
     * deliberate one. Recorded as a known gap in docs/updates/GROUP-19-TESTING.md.
     */
    const parsed = ok(isoDate, "2026-02-30T00:00:00.000Z");
    expect(parsed.toISOString()).toBe("2026-03-02T00:00:00.000Z");
  });
});

describe("entityName", () => {
  it("trims and accepts a normal name", () => {
    expect(ok(entityName, "  HDFC Savings  ")).toBe("HDFC Savings");
  });

  it("accepts exactly the maximum length and rejects one more", () => {
    expect(ok(entityName, "x".repeat(LIMITS.nameMaxLength))).toHaveLength(LIMITS.nameMaxLength);
    rejected(entityName, "x".repeat(LIMITS.nameMaxLength + 1));
  });

  it("rejects a name that is only whitespace", () => {
    // Trimming happens before the minimum length check, so this is empty rather than valid.
    rejected(entityName, "   ");
  });
});

describe("emailAddress", () => {
  it("lowercases and trims, so the same address cannot register twice", () => {
    expect(ok(emailAddress, "  Person@Example.COM ")).toBe("person@example.com");
  });

  it.each([
    ["no at sign", "person.example.com"],
    ["no domain", "person@"],
    ["empty", ""],
  ])("rejects an address with %s", (_label, value) => {
    rejected(emailAddress, value);
  });
});

describe("password", () => {
  it("enforces the minimum length", () => {
    rejected(password, "x".repeat(LIMITS.passwordMinLength - 1));
    expect(ok(password, "x".repeat(LIMITS.passwordMinLength))).toBeTruthy();
  });

  it("does not trim, because whitespace is legitimate in a passphrase", () => {
    const passphrase = "  a long pass phrase  ";
    expect(ok(password, passphrase)).toBe(passphrase);
  });

  it("rejects a password beyond the maximum, which bounds the bcrypt cost", () => {
    rejected(password, "x".repeat(LIMITS.passwordMaxLength + 1));
  });
});

describe("currencyCode", () => {
  it("uppercases a supported code", () => {
    expect(ok(currencyCode, "inr")).toBe("INR");
  });

  it("rejects an unsupported code", () => {
    rejected(currencyCode, "XYZ");
  });
});

describe("paginationQuery", () => {
  it("defaults the page size when none is asked for", () => {
    expect(ok(paginationQuery, {})).toEqual({ limit: PAGINATION.defaultLimit });
  });

  it("coerces a string limit, because query parameters are always strings", () => {
    expect(ok(paginationQuery, { limit: "25" }).limit).toBe(25);
  });

  it("caps the page size a client can demand", () => {
    expect(ok(paginationQuery, { limit: PAGINATION.maxLimit }).limit).toBe(PAGINATION.maxLimit);
    rejected(paginationQuery, { limit: PAGINATION.maxLimit + 1 });
    rejected(paginationQuery, { limit: 1_000_000 });
  });

  it.each([
    ["zero", 0],
    ["negative", -1],
    ["fractional", 1.5],
    ["not a number", "many"],
  ])("rejects a limit that is %s", (_label, limit) => {
    rejected(paginationQuery, { limit });
  });

  it("bounds the cursor length", () => {
    rejected(paginationQuery, { cursor: "x".repeat(201) });
  });
});

describe("searchParamsToObject", () => {
  it("reads a single value as a string", () => {
    expect(searchParamsToObject(new URLSearchParams("limit=10&cursor=abc"))).toEqual({
      limit: "10",
      cursor: "abc",
    });
  });

  it("collapses a repeated key into an array", () => {
    // Otherwise ?type=bank&type=cash would silently lose one value.
    expect(searchParamsToObject(new URLSearchParams("type=bank&type=cash"))).toEqual({
      type: ["bank", "cash"],
    });
  });

  it("returns an empty object for an empty query", () => {
    expect(searchParamsToObject(new URLSearchParams(""))).toEqual({});
  });

  it("keeps an empty value rather than dropping the key", () => {
    expect(searchParamsToObject(new URLSearchParams("search="))).toEqual({ search: "" });
  });
});
