import { describe, expect, it } from "vitest";
import { inr } from "@tests/helpers/builders";
import { sumMoney } from "@/lib/money";
import {
  allocateOldestFirst,
  assertAllocationsCoverSettlement,
  assertSettlementWithinOutstanding,
  assertValidAllocations,
  assertValidSettlementAmount,
  obligationDirectionFor,
  requiredDirectionFor,
  totalRemaining,
} from "./validators";
import type { AllocationTarget } from "./validators";

const ARUN = "personArun";
const VIJAY = "personVijay";

function target(overrides: Partial<AllocationTarget> = {}): AllocationTarget {
  return {
    expenseSplitId: "split1",
    direction: "person_owes_user",
    personId: ARUN,
    originalAmount: inr("500"),
    remainingAmount: inr("500"),
    ...overrides,
  };
}

function targetMap(...targets: AllocationTarget[]): Map<string, AllocationTarget> {
  return new Map(targets.map((entry) => [entry.expenseSplitId, entry]));
}

describe("assertValidSettlementAmount", () => {
  it("accepts a positive, correctly scaled amount", () => {
    expect(() => assertValidSettlementAmount(inr("300"))).not.toThrow();
  });

  it("rejects zero and negative amounts", () => {
    expect(() => assertValidSettlementAmount(inr("0"))).toThrow(/greater than zero/i);
    expect(() => assertValidSettlementAmount(inr("-100"))).toThrow();
  });

  it("rejects an over-precise amount", () => {
    expect(() => assertValidSettlementAmount(inr("100.005"))).toThrow(/decimal places/i);
  });
});

describe("direction pairing", () => {
  it("clears a person's debt with a payment from them", () => {
    expect(requiredDirectionFor("person_owes_user")).toBe("person_to_user");
    expect(obligationDirectionFor("person_to_user")).toBe("person_owes_user");
  });

  it("clears the user's debt with a payment from the user", () => {
    expect(requiredDirectionFor("user_owes_person")).toBe("user_to_person");
    expect(obligationDirectionFor("user_to_person")).toBe("user_owes_person");
  });
});

describe("assertValidAllocations", () => {
  const base = {
    direction: "person_to_user" as const,
    personId: ARUN,
  };

  it("accepts a full settlement of one obligation", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("500"),
        allocations: [{ expenseSplitId: "split1", amount: inr("500") }],
        targets: targetMap(target()),
      }),
    ).not.toThrow();
  });

  it("accepts a partial settlement of one obligation", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("200"),
        allocations: [{ expenseSplitId: "split1", amount: inr("200") }],
        targets: targetMap(target()),
      }),
    ).not.toThrow();
  });

  it("accepts a settlement spread across several obligations", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("500"),
        allocations: [
          { expenseSplitId: "split1", amount: inr("300") },
          { expenseSplitId: "split2", amount: inr("200") },
        ],
        targets: targetMap(
          target({ expenseSplitId: "split1", remainingAmount: inr("300") }),
          target({ expenseSplitId: "split2", remainingAmount: inr("400") }),
        ),
      }),
    ).not.toThrow();
  });

  it("rejects an unallocated settlement", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("500"),
        allocations: [],
        targets: targetMap(target()),
      }),
    ).toThrow(/which expenses/i);
  });

  it("rejects allocations that do not add up to the settlement amount", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("500"),
        allocations: [{ expenseSplitId: "split1", amount: inr("300") }],
        targets: targetMap(target()),
      }),
    ).toThrow(/add up to the payment amount/i);
  });

  it("rejects settling more than a share's remaining amount", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("600"),
        allocations: [{ expenseSplitId: "split1", amount: inr("600") }],
        targets: targetMap(target({ remainingAmount: inr("500") })),
      }),
    ).toThrow(/more than the amount still outstanding/i);
  });

  it("reports the remaining and requested amounts on over-settlement", () => {
    try {
      assertValidAllocations({
        ...base,
        settlementAmount: inr("600"),
        allocations: [{ expenseSplitId: "split1", amount: inr("600") }],
        targets: targetMap(target({ remainingAmount: inr("500") })),
      });
      expect.unreachable("should have thrown");
    } catch (error) {
      const details = (error as { details?: Record<string, unknown> }).details ?? {};
      expect(details.remaining).toBe("500.00");
      expect(details.requested).toBe("600.00");
      expect(details.expenseSplitId).toBe("split1");
    }
  });

  it("rejects settling a share that is already fully settled", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("100"),
        allocations: [{ expenseSplitId: "split1", amount: inr("100") }],
        targets: targetMap(target({ remainingAmount: inr("0") })),
      }),
    ).toThrow(/still outstanding/i);
  });

  it("rejects the same expense twice in one payment", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("400"),
        allocations: [
          { expenseSplitId: "split1", amount: inr("200") },
          { expenseSplitId: "split1", amount: inr("200") },
        ],
        targets: targetMap(target()),
      }),
    ).toThrow(/cannot be settled twice/i);
  });

  it("rejects a zero allocation", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("500"),
        allocations: [
          { expenseSplitId: "split1", amount: inr("500") },
          { expenseSplitId: "split2", amount: inr("0") },
        ],
        targets: targetMap(target(), target({ expenseSplitId: "split2" })),
      }),
    ).toThrow(/greater than zero/i);
  });

  it("rejects an unknown expense", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("500"),
        allocations: [{ expenseSplitId: "missing", amount: inr("500") }],
        targets: targetMap(target()),
      }),
    ).toThrow(/could not be found/i);
  });

  it("rejects an expense belonging to a different person", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("500"),
        allocations: [{ expenseSplitId: "split1", amount: inr("500") }],
        targets: targetMap(target({ personId: VIJAY })),
      }),
    ).toThrow(/does not involve this person/i);
  });

  it("rejects settling money you owe with a payment received", () => {
    // The user received money, so it cannot clear a debt the user owes.
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("450"),
        allocations: [{ expenseSplitId: "split1", amount: inr("450") }],
        targets: targetMap(target({ direction: "user_owes_person", remainingAmount: inr("450") })),
      }),
    ).toThrow(/money you owe, not money owed to you/i);
  });

  it("rejects settling money owed to you with a payment made", () => {
    expect(() =>
      assertValidAllocations({
        settlementAmount: inr("450"),
        direction: "user_to_person",
        personId: ARUN,
        allocations: [{ expenseSplitId: "split1", amount: inr("450") }],
        targets: targetMap(target({ direction: "person_owes_user", remainingAmount: inr("450") })),
      }),
    ).toThrow(/money owed to you, not money you owe/i);
  });

  it("accepts a payment made against money the user owes", () => {
    expect(() =>
      assertValidAllocations({
        settlementAmount: inr("450"),
        direction: "user_to_person",
        personId: ARUN,
        allocations: [{ expenseSplitId: "split1", amount: inr("450") }],
        targets: targetMap(target({ direction: "user_owes_person", remainingAmount: inr("450") })),
      }),
    ).not.toThrow();
  });

  it("rejects an over-precise allocation", () => {
    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("100.005"),
        allocations: [{ expenseSplitId: "split1", amount: inr("100.005") }],
        targets: targetMap(target()),
      }),
    ).toThrow(/decimal places/i);
  });

  it("rejects more allocations than the limit allows", () => {
    const many = Array.from({ length: 120 }, (_, index) => ({
      expenseSplitId: `split${index}`,
      amount: inr("1"),
    }));

    expect(() =>
      assertValidAllocations({
        ...base,
        settlementAmount: inr("120"),
        allocations: many,
        targets: targetMap(
          ...many.map((allocation) =>
            target({ expenseSplitId: allocation.expenseSplitId, remainingAmount: inr("1") }),
          ),
        ),
      }),
    ).toThrow(/more than/i);
  });
});

describe("assertAllocationsCoverSettlement", () => {
  it("accepts an exact match", () => {
    expect(() =>
      assertAllocationsCoverSettlement(inr("500"), [
        { expenseSplitId: "a", amount: inr("300") },
        { expenseSplitId: "b", amount: inr("200") },
      ]),
    ).not.toThrow();
  });

  it("rejects a one-paisa shortfall", () => {
    expect(() =>
      assertAllocationsCoverSettlement(inr("500"), [
        { expenseSplitId: "a", amount: inr("499.99") },
      ]),
    ).toThrow(/add up to the payment amount/i);
  });

  it("reports both totals so the form can show the gap", () => {
    try {
      assertAllocationsCoverSettlement(inr("500"), [{ expenseSplitId: "a", amount: inr("300") }]);
      expect.unreachable("should have thrown");
    } catch (error) {
      const details = (error as { details?: Record<string, unknown> }).details ?? {};
      expect(details.settlementAmount).toBe("500.00");
      expect(details.allocatedAmount).toBe("300.00");
    }
  });
});

describe("assertSettlementWithinOutstanding", () => {
  it("accepts a settlement up to the outstanding total", () => {
    expect(() => assertSettlementWithinOutstanding(inr("800"), inr("800"))).not.toThrow();
    expect(() => assertSettlementWithinOutstanding(inr("300"), inr("800"))).not.toThrow();
  });

  it("rejects more than is outstanding, naming the total", () => {
    expect(() => assertSettlementWithinOutstanding(inr("900"), inr("800"))).toThrow(/800\.00/);
  });
});

describe("allocateOldestFirst", () => {
  it("fills the oldest obligation first", () => {
    const allocations = allocateOldestFirst(inr("400"), [
      target({ expenseSplitId: "oldest", remainingAmount: inr("300") }),
      target({ expenseSplitId: "newer", remainingAmount: inr("500") }),
    ]);

    expect(allocations).toEqual([
      { expenseSplitId: "oldest", amount: expect.objectContaining({}) },
      { expenseSplitId: "newer", amount: expect.objectContaining({}) },
    ]);
    expect(allocations[0]?.amount.toFixedString()).toBe("300.00");
    expect(allocations[1]?.amount.toFixedString()).toBe("100.00");
  });

  it("stops once the payment is exhausted", () => {
    const allocations = allocateOldestFirst(inr("200"), [
      target({ expenseSplitId: "a", remainingAmount: inr("300") }),
      target({ expenseSplitId: "b", remainingAmount: inr("300") }),
    ]);

    expect(allocations).toHaveLength(1);
    expect(allocations[0]?.amount.toFixedString()).toBe("200.00");
  });

  it("always produces allocations that sum to the payment when funds allow", () => {
    const allocations = allocateOldestFirst(inr("750"), [
      target({ expenseSplitId: "a", remainingAmount: inr("300") }),
      target({ expenseSplitId: "b", remainingAmount: inr("300") }),
      target({ expenseSplitId: "c", remainingAmount: inr("300") }),
    ]);

    expect(
      sumMoney(
        allocations.map((allocation) => allocation.amount),
        "INR",
      ).toFixedString(),
    ).toBe("750.00");
  });

  it("skips fully settled obligations", () => {
    const allocations = allocateOldestFirst(inr("100"), [
      target({ expenseSplitId: "settled", remainingAmount: inr("0") }),
      target({ expenseSplitId: "open", remainingAmount: inr("300") }),
    ]);

    expect(allocations).toHaveLength(1);
    expect(allocations[0]?.expenseSplitId).toBe("open");
  });

  it("allocates nothing when there is nothing outstanding", () => {
    expect(allocateOldestFirst(inr("100"), [])).toEqual([]);
  });
});

describe("totalRemaining", () => {
  it("sums the outstanding amounts", () => {
    expect(
      totalRemaining(
        [
          target({ expenseSplitId: "a", remainingAmount: inr("300") }),
          target({ expenseSplitId: "b", remainingAmount: inr("200") }),
        ],
        "INR",
      ).toFixedString(),
    ).toBe("500.00");
  });

  it("is zero for an empty list", () => {
    expect(totalRemaining([], "INR").isZero()).toBe(true);
  });
});
