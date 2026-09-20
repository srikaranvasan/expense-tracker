import { describe, expect, it } from "vitest";
import {
  CurrencyMismatchError,
  InvalidDecimalError,
  Money,
  addMoney,
  allocateMoney,
  compareMoney,
  divideMoney,
  formatMoney,
  isDecimalLike,
  maxMoney,
  minMoney,
  money,
  multiplyMoney,
  percentageOf,
  roundMoney,
  splitEqually,
  subtractMoney,
  sumMoney,
  toDecimal,
} from "./index";

const inr = (value: string | number) => money(value, "INR");

describe("toDecimal", () => {
  it("accepts decimal strings", () => {
    expect(toDecimal("1200.50").toFixed()).toBe("1200.5");
    expect(toDecimal("-0.05").toFixed()).toBe("-0.05");
    expect(toDecimal(".5").toFixed()).toBe("0.5");
  });

  it("rejects values that are not decimal numbers", () => {
    expect(() => toDecimal("abc")).toThrow(InvalidDecimalError);
    expect(() => toDecimal("")).toThrow(InvalidDecimalError);
    expect(() => toDecimal("1,200")).toThrow(InvalidDecimalError);
    expect(() => toDecimal("1e5")).toThrow(InvalidDecimalError);
    expect(() => toDecimal(Number.NaN)).toThrow(InvalidDecimalError);
    expect(() => toDecimal(Number.POSITIVE_INFINITY)).toThrow(InvalidDecimalError);
  });

  it("identifies decimal-like values", () => {
    expect(isDecimalLike("10.5")).toBe(true);
    expect(isDecimalLike("ten")).toBe(false);
    expect(isDecimalLike(Number.NaN)).toBe(false);
    expect(isDecimalLike(null)).toBe(false);
  });

  it("never produces exponential notation", () => {
    expect(toDecimal("0.0000001").toFixed()).toBe("0.0000001");
    expect(inr("100000000").toString()).toBe("100000000");
  });
});

describe("Money", () => {
  it("normalises the currency code", () => {
    expect(money("10", "inr").currency).toBe("INR");
  });

  it("rejects malformed currency codes", () => {
    expect(() => money("10", "RUPEE")).toThrow();
  });

  it("exposes exact and scale-padded strings", () => {
    expect(inr("1200.5").toString()).toBe("1200.5");
    expect(inr("1200.5").toFixedString()).toBe("1200.50");
  });

  it("serialises as an amount/currency pair", () => {
    expect(inr("450.25").toJSON()).toEqual({ amount: "450.25", currency: "INR" });
  });

  it("compares by amount and currency", () => {
    expect(inr("10").equals(inr("10.00"))).toBe(true);
    expect(inr("10").equals(money("10", "USD"))).toBe(false);
  });
});

describe("arithmetic", () => {
  it("adds and subtracts exactly", () => {
    expect(addMoney(inr("100"), inr("200")).toString()).toBe("300");
    expect(subtractMoney(inr("100"), inr("25")).toString()).toBe("75");
    expect(addMoney(inr("1.25"), inr("2.35")).toFixedString()).toBe("3.60");
  });

  it("avoids binary floating-point drift", () => {
    // 0.1 + 0.2 !== 0.3 with JS numbers.
    expect(addMoney(inr("0.1"), inr("0.2")).toString()).toBe("0.3");

    const cents = Array.from({ length: 10 }, () => inr("0.1"));
    expect(sumMoney(cents, "INR").toString()).toBe("1");
  });

  it("multiplies, divides and takes percentages", () => {
    expect(multiplyMoney(inr("100"), "3").toString()).toBe("300");
    expect(divideMoney(inr("100"), "4").toString()).toBe("25");
    expect(percentageOf(inr("1000"), "33.33").toString()).toBe("333.3");
  });

  it("refuses to divide by zero", () => {
    expect(() => divideMoney(inr("100"), "0")).toThrow();
  });

  it("refuses to mix currencies", () => {
    expect(() => addMoney(inr("100"), money("100", "USD"))).toThrow(CurrencyMismatchError);
    expect(() => compareMoney(inr("100"), money("100", "USD"))).toThrow(CurrencyMismatchError);
  });

  it("compares, and picks min/max", () => {
    expect(compareMoney(inr("10"), inr("20"))).toBe(-1);
    expect(compareMoney(inr("20"), inr("20"))).toBe(0);
    expect(compareMoney(inr("30"), inr("20"))).toBe(1);
    expect(minMoney(inr("10"), inr("20")).toString()).toBe("10");
    expect(maxMoney(inr("10"), inr("20")).toString()).toBe("20");
  });

  it("sums an empty list to zero in the given currency", () => {
    const total = sumMoney([], "INR");
    expect(total.isZero()).toBe(true);
    expect(total.currency).toBe("INR");
  });

  it("reports sign correctly", () => {
    expect(Money.zero("INR").isZero()).toBe(true);
    expect(inr("1").isPositive()).toBe(true);
    expect(inr("-1").isNegative()).toBe(true);
    expect(inr("-5").abs().toString()).toBe("5");
    expect(inr("5").negated().toString()).toBe("-5");
  });
});

describe("roundMoney", () => {
  it("rounds to the currency scale using half-up by default", () => {
    expect(roundMoney(inr("10.005")).toFixedString()).toBe("10.01");
    expect(roundMoney(inr("10.004")).toFixedString()).toBe("10.00");
  });

  it("supports alternative rounding modes", () => {
    expect(roundMoney(inr("10.005"), "down").toFixedString()).toBe("10.00");
    expect(roundMoney(inr("10.001"), "up").toFixedString()).toBe("10.01");
  });

  it("respects zero-decimal currencies", () => {
    expect(roundMoney(money("1234.56", "JPY")).toString()).toBe("1235");
  });
});

describe("splitEqually", () => {
  it("splits evenly divisible amounts", () => {
    const shares = splitEqually(inr("900"), 3);
    expect(shares.map((s) => s.toFixedString())).toEqual(["300.00", "300.00", "300.00"]);
  });

  it("distributes the remainder so the total is preserved", () => {
    const shares = splitEqually(inr("1000"), 3);
    expect(shares.map((s) => s.toFixedString())).toEqual(["333.34", "333.33", "333.33"]);
    expect(sumMoney(shares, "INR").toFixedString()).toBe("1000.00");
  });

  it("preserves the total for many awkward amounts and participant counts", () => {
    for (const amount of ["0.01", "0.05", "1", "10.01", "999.99", "1234.57", "100000.03"]) {
      for (const count of [1, 2, 3, 4, 5, 6, 7, 11, 13]) {
        const shares = splitEqually(inr(amount), count);
        expect(shares).toHaveLength(count);
        expect(sumMoney(shares, "INR").toFixedString()).toBe(inr(amount).toFixedString());
      }
    }
  });

  it("never produces a negative share for a positive total", () => {
    for (const share of splitEqually(inr("0.02"), 5)) {
      expect(share.isNegative()).toBe(false);
    }
  });

  it("rejects an invalid number of parts", () => {
    expect(() => splitEqually(inr("100"), 0)).toThrow();
    expect(() => splitEqually(inr("100"), -1)).toThrow();
    expect(() => splitEqually(inr("100"), 2.5)).toThrow();
  });

  it("handles negative totals without inventing money", () => {
    const shares = splitEqually(inr("-1000"), 3);
    expect(sumMoney(shares, "INR").toFixedString()).toBe("-1000.00");
  });
});

describe("allocateMoney", () => {
  it("allocates proportionally to weights", () => {
    const shares = allocateMoney(inr("1000"), ["50", "30", "20"]);
    expect(shares.map((s) => s.toFixedString())).toEqual(["500.00", "300.00", "200.00"]);
  });

  it("keeps the total exact when percentages do not divide cleanly", () => {
    const shares = allocateMoney(inr("1000"), ["33.33", "33.33", "33.34"]);
    expect(sumMoney(shares, "INR").toFixedString()).toBe("1000.00");
  });

  it("keeps the total exact for thirds expressed as equal weights", () => {
    const shares = allocateMoney(inr("0.05"), [1, 1, 1]);
    expect(shares.map((s) => s.toFixedString())).toEqual(["0.02", "0.02", "0.01"]);
    expect(sumMoney(shares, "INR").toFixedString()).toBe("0.05");
  });

  it("gives zero-weight participants nothing", () => {
    const shares = allocateMoney(inr("100"), ["0", "100"]);
    expect(shares.map((s) => s.toFixedString())).toEqual(["0.00", "100.00"]);
  });

  it("is deterministic for identical input", () => {
    const first = allocateMoney(inr("1000"), [1, 1, 1]).map((s) => s.toString());
    const second = allocateMoney(inr("1000"), [1, 1, 1]).map((s) => s.toString());
    expect(first).toEqual(second);
  });

  it("rejects empty, negative, or all-zero weights", () => {
    expect(() => allocateMoney(inr("100"), [])).toThrow();
    expect(() => allocateMoney(inr("100"), ["-1", "2"])).toThrow();
    expect(() => allocateMoney(inr("100"), ["0", "0"])).toThrow();
  });
});

describe("formatMoney", () => {
  it("formats with the currency symbol", () => {
    const formatted = formatMoney(inr("1200.5"));
    expect(formatted).toContain("1,200.50");
    expect(formatted).toMatch(/₹/);
  });

  it("can show an explicit sign", () => {
    expect(formatMoney(inr("100"), { showSign: true })).toContain("+");
    expect(formatMoney(inr("-100"), { showSign: true })).toContain("-");
  });
});
