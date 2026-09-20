import { describe, expect, it } from "vitest";
import { buildAllocation, buildSplit, inr } from "@tests/helpers/builders";
import {
  calculateAllocatedAmount,
  calculateAllocationTotal,
  calculateRemainingSplitAmount,
  deriveSplitStatus,
  indexAllocationsBySplit,
  summariseSplit,
  summariseSplits,
} from "./calculations";

describe("calculateAllocatedAmount", () => {
  it("is zero for an unsettled split", () => {
    const split = buildSplit({ shareAmount: inr("500") });
    expect(calculateAllocatedAmount(split, []).toFixedString()).toBe("0.00");
  });

  it("sums every allocation against the split", () => {
    const split = buildSplit({ shareAmount: inr("500") });
    const allocations = [
      buildAllocation({ expenseSplitId: split.id, amount: inr("200") }),
      buildAllocation({ expenseSplitId: split.id, amount: inr("150") }),
    ];

    expect(calculateAllocatedAmount(split, allocations).toFixedString()).toBe("350.00");
  });

  it("ignores allocations belonging to other splits", () => {
    const split = buildSplit({ shareAmount: inr("500") });
    const allocations = [buildAllocation({ expenseSplitId: "someone-else", amount: inr("200") })];

    expect(calculateAllocatedAmount(split, allocations).toFixedString()).toBe("0.00");
  });

  it("ignores soft-deleted allocations", () => {
    const split = buildSplit({ shareAmount: inr("500") });
    const allocations = [
      buildAllocation({ expenseSplitId: split.id, amount: inr("200") }),
      buildAllocation({ expenseSplitId: split.id, amount: inr("100"), deletedAt: new Date() }),
    ];

    expect(calculateAllocatedAmount(split, allocations).toFixedString()).toBe("200.00");
  });
});

describe("calculateRemainingSplitAmount", () => {
  it("returns the full share when nothing is settled", () => {
    const split = buildSplit({ shareAmount: inr("500") });
    expect(calculateRemainingSplitAmount(split, []).toFixedString()).toBe("500.00");
  });

  it("reflects a partial settlement", () => {
    const split = buildSplit({ shareAmount: inr("500") });
    const allocations = [buildAllocation({ expenseSplitId: split.id, amount: inr("200") })];

    expect(calculateRemainingSplitAmount(split, allocations).toFixedString()).toBe("300.00");
  });

  it("reaches zero on full settlement", () => {
    const split = buildSplit({ shareAmount: inr("500") });
    const allocations = [
      buildAllocation({ expenseSplitId: split.id, amount: inr("200") }),
      buildAllocation({ expenseSplitId: split.id, amount: inr("300") }),
    ];

    expect(calculateRemainingSplitAmount(split, allocations).toFixedString()).toBe("0.00");
  });

  it("never reports a negative remaining amount", () => {
    // Over-allocation is rejected on write; if corrupt data appears, remaining
    // must still be meaningful.
    const split = buildSplit({ shareAmount: inr("500") });
    const allocations = [buildAllocation({ expenseSplitId: split.id, amount: inr("600") })];

    expect(calculateRemainingSplitAmount(split, allocations).toFixedString()).toBe("0.00");
  });
});

describe("deriveSplitStatus", () => {
  it("is unsettled when nothing has been allocated", () => {
    expect(deriveSplitStatus(inr("500"), inr("0"))).toBe("unsettled");
  });

  it("is partially settled when some but not all is allocated", () => {
    expect(deriveSplitStatus(inr("500"), inr("200"))).toBe("partially_settled");
    expect(deriveSplitStatus(inr("500"), inr("499.99"))).toBe("partially_settled");
  });

  it("is settled once the whole share is allocated", () => {
    expect(deriveSplitStatus(inr("500"), inr("500"))).toBe("settled");
  });

  it("treats a zero-value share as settled", () => {
    expect(deriveSplitStatus(inr("0"), inr("0"))).toBe("settled");
  });
});

describe("summariseSplit", () => {
  it("reports the full settlement picture for one split", () => {
    const split = buildSplit({ shareAmount: inr("500") });
    const allocations = [buildAllocation({ expenseSplitId: split.id, amount: inr("200") })];

    const summary = summariseSplit(split, allocations);

    expect(summary.originalAmount.toFixedString()).toBe("500.00");
    expect(summary.allocatedAmount.toFixedString()).toBe("200.00");
    expect(summary.remainingAmount.toFixedString()).toBe("300.00");
    expect(summary.status).toBe("partially_settled");
  });

  it("tracks two settlements against the same split down to zero", () => {
    const split = buildSplit({ shareAmount: inr("500") });

    const afterFirst = summariseSplit(split, [
      buildAllocation({ expenseSplitId: split.id, amount: inr("200") }),
    ]);
    expect(afterFirst.remainingAmount.toFixedString()).toBe("300.00");

    const afterSecond = summariseSplit(split, [
      buildAllocation({ expenseSplitId: split.id, amount: inr("200") }),
      buildAllocation({ expenseSplitId: split.id, amount: inr("300") }),
    ]);
    expect(afterSecond.allocatedAmount.toFixedString()).toBe("500.00");
    expect(afterSecond.remainingAmount.toFixedString()).toBe("0.00");
    expect(afterSecond.status).toBe("settled");
  });
});

describe("summariseSplits", () => {
  it("summarises several splits from one allocation list", () => {
    // Dinner ₹300, Movie ₹400, Groceries ₹500; a ₹500 settlement pays Dinner in
    // full and ₹200 of Movie.
    const dinner = buildSplit({ shareAmount: inr("300") });
    const movie = buildSplit({ shareAmount: inr("400") });
    const groceries = buildSplit({ shareAmount: inr("500") });

    const allocations = [
      buildAllocation({ expenseSplitId: dinner.id, amount: inr("300") }),
      buildAllocation({ expenseSplitId: movie.id, amount: inr("200") }),
    ];

    const summaries = summariseSplits([dinner, movie, groceries], allocations);

    expect(summaries.get(dinner.id)?.remainingAmount.toFixedString()).toBe("0.00");
    expect(summaries.get(dinner.id)?.status).toBe("settled");

    expect(summaries.get(movie.id)?.remainingAmount.toFixedString()).toBe("200.00");
    expect(summaries.get(movie.id)?.status).toBe("partially_settled");

    expect(summaries.get(groceries.id)?.remainingAmount.toFixedString()).toBe("500.00");
    expect(summaries.get(groceries.id)?.status).toBe("unsettled");
  });

  it("returns an entry for every split, even with no allocations", () => {
    const splits = [buildSplit(), buildSplit(), buildSplit()];
    expect(summariseSplits(splits, []).size).toBe(3);
  });
});

describe("indexAllocationsBySplit", () => {
  it("groups by split and drops deleted allocations", () => {
    const first = buildAllocation({ expenseSplitId: "a", amount: inr("10") });
    const second = buildAllocation({ expenseSplitId: "a", amount: inr("20") });
    const third = buildAllocation({ expenseSplitId: "b", amount: inr("30") });
    const deleted = buildAllocation({ expenseSplitId: "b", deletedAt: new Date() });

    const index = indexAllocationsBySplit([first, second, third, deleted]);

    expect(index.get("a")).toHaveLength(2);
    expect(index.get("b")).toHaveLength(1);
  });
});

describe("calculateAllocationTotal", () => {
  it("sums allocation amounts", () => {
    expect(
      calculateAllocationTotal(
        [{ amount: inr("300") }, { amount: inr("200") }],
        "INR",
      ).toFixedString(),
    ).toBe("500.00");
  });

  it("is zero for an empty list", () => {
    expect(calculateAllocationTotal([], "INR").isZero()).toBe(true);
  });
});
