import { describe, expect, it } from "vitest";
import { buildSharedExpense, buildSplit, buildTransaction, inr } from "@tests/helpers/builders";
import {
  calculateMonthlySpending,
  calculateSpendingByCategory,
  calculateSpendingForMonth,
  calculateTotalSpending,
  indexSplitsByTransaction,
  isNonSpendingType,
  isSpending,
  userSpendingFor,
} from "./calculations";

const IST = "Asia/Kolkata";
const ARUN = "personArun";

describe("isSpending", () => {
  it("counts only expenses", () => {
    expect(isSpending(buildTransaction({ type: "expense" }))).toBe(true);
    expect(isSpending(buildTransaction({ type: "transfer" }))).toBe(false);
    expect(isSpending(buildTransaction({ type: "credit_card_payment" }))).toBe(false);
    expect(isSpending(buildTransaction({ type: "income" }))).toBe(false);
  });

  it("agrees with isNonSpendingType", () => {
    expect(isNonSpendingType("transfer")).toBe(true);
    expect(isNonSpendingType("credit_card_payment")).toBe(true);
    expect(isNonSpendingType("income")).toBe(true);
    expect(isNonSpendingType("expense")).toBe(false);
  });
});

describe("userSpendingFor", () => {
  it("is the full amount for an expense with no splits", () => {
    const transaction = buildTransaction({ amount: inr("450") });
    expect(userSpendingFor(transaction, []).toFixedString()).toBe("450.00");
  });

  it("is the full amount for a personal expense with a single user split", () => {
    const transaction = buildTransaction({ amount: inr("450") });
    const split = buildSplit({
      transactionId: transaction.id,
      participantType: "user",
      shareAmount: inr("450"),
    });

    expect(userSpendingFor(transaction, [split]).toFixedString()).toBe("450.00");
  });

  it("is only the user's share of a shared expense", () => {
    // Paid ₹1,200, own share ₹400. Spending is ₹400.
    const { transaction, splits } = buildSharedExpense({
      amount: "1200",
      participants: [
        { personId: null, share: "400" },
        { personId: ARUN, share: "400" },
        { personId: "personVijay", share: "400" },
      ],
    });

    expect(userSpendingFor(transaction, splits).toFixedString()).toBe("400.00");
  });

  it("is the user's share even when someone else paid", () => {
    const { transaction, splits } = buildSharedExpense({
      amount: "900",
      paidByPersonId: ARUN,
      participants: [
        { personId: null, share: "450" },
        { personId: ARUN, share: "450" },
      ],
    });

    expect(userSpendingFor(transaction, splits).toFixedString()).toBe("450.00");
  });

  it("is zero when the user has no share", () => {
    // The user paid for other people only.
    const { transaction, splits } = buildSharedExpense({
      amount: "600",
      participants: [
        { personId: ARUN, share: "300" },
        { personId: "personVijay", share: "300" },
      ],
    });

    expect(userSpendingFor(transaction, splits).toFixedString()).toBe("0.00");
  });

  it("is zero for a non-expense transaction", () => {
    for (const type of ["transfer", "credit_card_payment", "income"] as const) {
      const transaction = buildTransaction({ type, amount: inr("5000"), paidBy: null });
      expect(userSpendingFor(transaction, []).isZero()).toBe(true);
    }
  });

  it("is zero for a deleted expense", () => {
    const transaction = buildTransaction({ amount: inr("450"), deletedAt: new Date() });
    expect(userSpendingFor(transaction, []).isZero()).toBe(true);
  });

  it("ignores deleted splits", () => {
    const transaction = buildTransaction({ amount: inr("1000") });
    const active = buildSplit({
      transactionId: transaction.id,
      participantType: "user",
      shareAmount: inr("500"),
    });
    const deleted = buildSplit({
      transactionId: transaction.id,
      participantType: "user",
      shareAmount: inr("500"),
      deletedAt: new Date(),
    });

    expect(userSpendingFor(transaction, [active, deleted]).toFixedString()).toBe("500.00");
  });

  it("ignores splits belonging to other transactions", () => {
    const transaction = buildTransaction({ amount: inr("450") });
    const foreign = buildSplit({ transactionId: "other-txn", shareAmount: inr("999") });

    expect(userSpendingFor(transaction, [foreign]).toFixedString()).toBe("450.00");
  });
});

describe("calculateTotalSpending", () => {
  it("is zero with no transactions", () => {
    expect(calculateTotalSpending([], [], "INR").isZero()).toBe(true);
  });

  it("adds personal expenses and only the user's share of shared ones", () => {
    const personal = buildSharedExpense({
      amount: "500",
      participants: [{ personId: null, share: "500" }],
    });
    const shared = buildSharedExpense({
      amount: "1200",
      participants: [
        { personId: null, share: "400" },
        { personId: ARUN, share: "800" },
      ],
    });

    const total = calculateTotalSpending(
      [personal.transaction, shared.transaction],
      [...personal.splits, ...shared.splits],
      "INR",
    );

    // 500 + 400, not 500 + 1200.
    expect(total.toFixedString()).toBe("900.00");
  });

  it("excludes transfers and credit-card payments", () => {
    const expense = buildTransaction({ type: "expense", amount: inr("500") });
    const transfer = buildTransaction({ type: "transfer", amount: inr("5000"), paidBy: null });
    const payment = buildTransaction({
      type: "credit_card_payment",
      amount: inr("18500"),
      paidBy: null,
    });

    const total = calculateTotalSpending([expense, transfer, payment], [], "INR");
    expect(total.toFixedString()).toBe("500.00");
  });

  it("stays exact across many decimal amounts", () => {
    const transactions = Array.from({ length: 10 }, () =>
      buildTransaction({ type: "expense", amount: inr("0.1") }),
    );

    expect(calculateTotalSpending(transactions, [], "INR").toFixedString()).toBe("1.00");
  });
});

describe("calculateSpendingByCategory", () => {
  it("groups by category, highest first", () => {
    const food = "catFood";
    const transport = "catTransport";

    const transactions = [
      buildTransaction({ type: "expense", amount: inr("300"), categoryId: food }),
      buildTransaction({ type: "expense", amount: inr("200"), categoryId: food }),
      buildTransaction({ type: "expense", amount: inr("400"), categoryId: transport }),
    ];

    const result = calculateSpendingByCategory(transactions, [], "INR");

    expect(result[0]?.categoryId).toBe(food);
    expect(result[0]?.amount.toFixedString()).toBe("500.00");
    expect(result[0]?.transactionCount).toBe(2);
    expect(result[1]?.categoryId).toBe(transport);
    expect(result[1]?.amount.toFixedString()).toBe("400.00");
  });

  it("groups uncategorised spending under null", () => {
    const transactions = [
      buildTransaction({ type: "expense", amount: inr("150"), categoryId: null }),
    ];

    const result = calculateSpendingByCategory(transactions, [], "INR");
    expect(result[0]?.categoryId).toBeNull();
  });

  it("uses the user's share for a shared expense", () => {
    const shared = buildSharedExpense({
      amount: "1200",
      participants: [
        { personId: null, share: "400" },
        { personId: ARUN, share: "800" },
      ],
    });
    const withCategory = { ...shared.transaction, categoryId: "catFood" };

    const result = calculateSpendingByCategory([withCategory], shared.splits, "INR");
    expect(result[0]?.amount.toFixedString()).toBe("400.00");
  });

  it("omits an expense the user has no share in", () => {
    const shared = buildSharedExpense({
      amount: "600",
      participants: [{ personId: ARUN, share: "600" }],
    });

    expect(calculateSpendingByCategory([shared.transaction], shared.splits, "INR")).toEqual([]);
  });
});

describe("calculateMonthlySpending", () => {
  it("groups by month in the user's timezone", () => {
    const transactions = [
      buildTransaction({
        type: "expense",
        amount: inr("100"),
        date: new Date("2026-07-15T06:00:00.000Z"),
      }),
      buildTransaction({
        type: "expense",
        amount: inr("200"),
        date: new Date("2026-08-02T06:00:00.000Z"),
      }),
      buildTransaction({
        type: "expense",
        amount: inr("300"),
        date: new Date("2026-08-20T06:00:00.000Z"),
      }),
    ];

    const result = calculateMonthlySpending(transactions, [], "INR", IST);

    expect(result.map((entry) => entry.monthKey)).toEqual(["2026-07", "2026-08"]);
    expect(result[1]?.amount.toFixedString()).toBe("500.00");
    expect(result[1]?.transactionCount).toBe(2);
  });

  it("assigns a late-evening expense to the local month, not the UTC one", () => {
    // 2026-07-31 20:00 UTC is 2026-08-01 01:30 in India.
    const transaction = buildTransaction({
      type: "expense",
      amount: inr("100"),
      date: new Date("2026-07-31T20:00:00.000Z"),
    });

    const result = calculateMonthlySpending([transaction], [], "INR", IST);
    expect(result[0]?.monthKey).toBe("2026-08");
  });
});

describe("calculateSpendingForMonth", () => {
  it("totals only the month containing the reference date", () => {
    const transactions = [
      buildTransaction({
        type: "expense",
        amount: inr("100"),
        date: new Date("2026-07-15T06:00:00.000Z"),
      }),
      buildTransaction({
        type: "expense",
        amount: inr("250"),
        date: new Date("2026-08-05T06:00:00.000Z"),
      }),
    ];

    const august = calculateSpendingForMonth(
      transactions,
      [],
      "INR",
      IST,
      new Date("2026-08-20T06:00:00.000Z"),
    );

    expect(august.toFixedString()).toBe("250.00");
  });

  it("is zero for a month with no spending", () => {
    const result = calculateSpendingForMonth(
      [],
      [],
      "INR",
      IST,
      new Date("2026-08-20T00:00:00.000Z"),
    );
    expect(result.isZero()).toBe(true);
  });
});

describe("indexSplitsByTransaction", () => {
  it("groups by transaction and drops deleted splits", () => {
    const first = buildSplit({ transactionId: "a" });
    const second = buildSplit({ transactionId: "a" });
    const third = buildSplit({ transactionId: "b" });
    const deleted = buildSplit({ transactionId: "b", deletedAt: new Date() });

    const index = indexSplitsByTransaction([first, second, third, deleted]);

    expect(index.get("a")).toHaveLength(2);
    expect(index.get("b")).toHaveLength(1);
  });
});
