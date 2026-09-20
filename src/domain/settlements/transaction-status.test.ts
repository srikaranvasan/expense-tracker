import { describe, expect, it } from "vitest";
import { buildPersonObligations } from "@/domain/people/calculations";
import type { PersonObligation } from "@/domain/people/calculations";
import {
  buildAllocation,
  buildSharedExpense,
  buildTransaction,
  inr,
} from "@tests/helpers/builders";
import { toSplitEntries } from "@tests/helpers/builders";
import {
  deriveTransactionSettlementStatus,
  summariseTransactionSettlements,
} from "./transaction-status";

/** Builds the obligations for one shared expense with the given allocations. */
function obligationsFor(
  expense: ReturnType<typeof buildSharedExpense>,
  allocations: Parameters<typeof buildPersonObligations>[1] = [],
): PersonObligation[] {
  return buildPersonObligations(toSplitEntries([expense]), allocations);
}

describe("deriveTransactionSettlementStatus", () => {
  it("reports no status when nothing is owed", () => {
    // A personal expense: the user's own share is nobody's debt.
    const expense = buildSharedExpense({
      amount: "450",
      accountId: "acc1",
      participants: [{ personId: null, share: "450" }],
    });

    const result = deriveTransactionSettlementStatus(obligationsFor(expense));

    expect(result.status).toBeNull();
    expect(result.obligationCount).toBe(0);
  });

  it("reports unsettled when a share is owed and nothing has been paid", () => {
    const expense = buildSharedExpense({
      amount: "1000",
      accountId: "acc1",
      participants: [
        { personId: null, share: "400" },
        { personId: "person1", share: "600" },
      ],
    });

    const result = deriveTransactionSettlementStatus(obligationsFor(expense));

    expect(result.status).toBe("unsettled");
    expect(result.obligationCount).toBe(1);
    expect(result.outstandingCount).toBe(1);
  });

  it("reports partially settled when part of a share has been paid", () => {
    const expense = buildSharedExpense({
      amount: "1000",
      accountId: "acc1",
      participants: [
        { personId: null, share: "400" },
        { personId: "person1", share: "600" },
      ],
    });
    const personSplit = expense.splits.find((split) => split.personId === "person1")!;

    const result = deriveTransactionSettlementStatus(
      obligationsFor(expense, [
        buildAllocation({ expenseSplitId: personSplit.id, amount: inr("200") }),
      ]),
    );

    expect(result.status).toBe("partially_settled");
    expect(result.outstandingCount).toBe(1);
  });

  it("reports settled when the share is fully paid", () => {
    const expense = buildSharedExpense({
      amount: "1000",
      accountId: "acc1",
      participants: [
        { personId: null, share: "400" },
        { personId: "person1", share: "600" },
      ],
    });
    const personSplit = expense.splits.find((split) => split.personId === "person1")!;

    const result = deriveTransactionSettlementStatus(
      obligationsFor(expense, [
        buildAllocation({ expenseSplitId: personSplit.id, amount: inr("600") }),
      ]),
    );

    expect(result.status).toBe("settled");
    expect(result.outstandingCount).toBe(0);
  });

  it("is not settled while any one participant still owes", () => {
    const expense = buildSharedExpense({
      amount: "900",
      accountId: "acc1",
      participants: [
        { personId: null, share: "300" },
        { personId: "person1", share: "300" },
        { personId: "person2", share: "300" },
      ],
    });
    const first = expense.splits.find((split) => split.personId === "person1")!;

    const result = deriveTransactionSettlementStatus(
      obligationsFor(expense, [buildAllocation({ expenseSplitId: first.id, amount: inr("300") })]),
    );

    // One of two people is square. Calling the expense settled would be a lie.
    expect(result.status).toBe("partially_settled");
    expect(result.obligationCount).toBe(2);
    expect(result.outstandingCount).toBe(1);
  });

  it("tracks a debt the user owes, not only debts owed to them", () => {
    // A person paid, so the user owes their own share.
    const expense = buildSharedExpense({
      amount: "800",
      accountId: null,
      paidByPersonId: "person1",
      participants: [
        { personId: null, share: "300" },
        { personId: "person1", share: "500" },
      ],
    });

    const result = deriveTransactionSettlementStatus(obligationsFor(expense));

    expect(result.status).toBe("unsettled");
    expect(result.obligationCount).toBe(1);
  });
});

describe("summariseTransactionSettlements", () => {
  it("rolls up each transaction separately in one pass", () => {
    const settledExpense = buildSharedExpense({
      amount: "1000",
      accountId: "acc1",
      participants: [
        { personId: null, share: "400" },
        { personId: "person1", share: "600" },
      ],
    });
    const openExpense = buildSharedExpense({
      amount: "500",
      accountId: "acc1",
      participants: [
        { personId: null, share: "250" },
        { personId: "person2", share: "250" },
      ],
    });

    const settledSplit = settledExpense.splits.find((split) => split.personId === "person1")!;

    const obligations = buildPersonObligations(toSplitEntries([settledExpense, openExpense]), [
      buildAllocation({ expenseSplitId: settledSplit.id, amount: inr("600") }),
    ]);

    const summaries = summariseTransactionSettlements(obligations);

    expect(summaries.get(settledExpense.transaction.id)?.status).toBe("settled");
    expect(summaries.get(openExpense.transaction.id)?.status).toBe("unsettled");
  });

  it("omits transactions that create no obligations", () => {
    const personal = buildTransaction({ type: "expense", amount: inr("450") });

    const summaries = summariseTransactionSettlements([]);

    expect(summaries.has(personal.id)).toBe(false);
    expect(summaries.size).toBe(0);
  });
});
