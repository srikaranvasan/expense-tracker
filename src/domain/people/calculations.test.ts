import { describe, expect, it } from "vitest";
import {
  buildAllocation,
  buildSharedExpense,
  buildSplit,
  buildTransaction,
  inr,
  toSplitEntries,
} from "@tests/helpers/builders";
import {
  buildPersonObligations,
  calculatePeopleTotals,
  calculatePersonBalance,
  calculatePersonBalances,
  classifyObligation,
  unsettledObligationsFor,
} from "./calculations";

const ARUN = "personArun";
const VIJAY = "personVijay";

describe("classifyObligation", () => {
  it("makes a person owe the user when the user paid", () => {
    const transaction = buildTransaction({ paidBy: { type: "user", personId: null } });
    const split = buildSplit({
      transactionId: transaction.id,
      participantType: "person",
      personId: ARUN,
      shareAmount: inr("400"),
    });

    expect(classifyObligation(transaction, split)).toEqual({
      direction: "person_owes_user",
      personId: ARUN,
    });
  });

  it("makes the user owe a person when that person paid", () => {
    const transaction = buildTransaction({ paidBy: { type: "person", personId: ARUN } });
    const split = buildSplit({
      transactionId: transaction.id,
      participantType: "user",
      personId: null,
      shareAmount: inr("450"),
    });

    expect(classifyObligation(transaction, split)).toEqual({
      direction: "user_owes_person",
      personId: ARUN,
    });
  });

  it("creates no obligation for the payer's own share", () => {
    const userPaid = buildTransaction({ paidBy: { type: "user", personId: null } });
    const userSplit = buildSplit({ transactionId: userPaid.id, participantType: "user" });
    expect(classifyObligation(userPaid, userSplit)).toBeNull();

    const arunPaid = buildTransaction({ paidBy: { type: "person", personId: ARUN } });
    const arunSplit = buildSplit({
      transactionId: arunPaid.id,
      participantType: "person",
      personId: ARUN,
    });
    expect(classifyObligation(arunPaid, arunSplit)).toBeNull();
  });

  it("ignores an obligation between two other people", () => {
    // Arun paid and Vijay consumed. That is between them, not the user.
    const transaction = buildTransaction({ paidBy: { type: "person", personId: ARUN } });
    const split = buildSplit({
      transactionId: transaction.id,
      participantType: "person",
      personId: VIJAY,
    });

    expect(classifyObligation(transaction, split)).toBeNull();
  });

  it("ignores non-expense transactions", () => {
    for (const type of ["transfer", "credit_card_payment", "income"] as const) {
      const transaction = buildTransaction({ type, paidBy: null });
      const split = buildSplit({ participantType: "person", personId: ARUN });
      expect(classifyObligation(transaction, split)).toBeNull();
    }
  });

  it("ignores deleted transactions and deleted splits", () => {
    const deletedTransaction = buildTransaction({ deletedAt: new Date() });
    const split = buildSplit({ participantType: "person", personId: ARUN });
    expect(classifyObligation(deletedTransaction, split)).toBeNull();

    const transaction = buildTransaction();
    const deletedSplit = buildSplit({
      participantType: "person",
      personId: ARUN,
      deletedAt: new Date(),
    });
    expect(classifyObligation(transaction, deletedSplit)).toBeNull();
  });
});

describe("calculatePersonBalance", () => {
  it("is settled when there is no history", () => {
    const balance = calculatePersonBalance(ARUN, [], [], "INR");

    expect(balance.isSettled).toBe(true);
    expect(balance.direction).toBe("settled");
    expect(balance.net.isZero()).toBe(true);
  });

  it("reports what a person owes after the user pays for the group", () => {
    // ₹1,200 dinner paid by the user, split three ways.
    const expense = buildSharedExpense({
      amount: "1200",
      participants: [
        { personId: null, share: "400" },
        { personId: ARUN, share: "400" },
        { personId: VIJAY, share: "400" },
      ],
    });

    const entries = toSplitEntries([expense]);

    const arun = calculatePersonBalance(ARUN, entries, [], "INR");
    expect(arun.personOwesUser.toFixedString()).toBe("400.00");
    expect(arun.userOwesPerson.toFixedString()).toBe("0.00");
    expect(arun.direction).toBe("person_owes_user");
    expect(arun.netAbsolute.toFixedString()).toBe("400.00");

    const vijay = calculatePersonBalance(VIJAY, entries, [], "INR");
    expect(vijay.netAbsolute.toFixedString()).toBe("400.00");
  });

  it("reports what the user owes when someone else pays", () => {
    // Arun paid ₹900, split between the user and Arun.
    const expense = buildSharedExpense({
      amount: "900",
      paidByPersonId: ARUN,
      participants: [
        { personId: null, share: "450" },
        { personId: ARUN, share: "450" },
      ],
    });

    const balance = calculatePersonBalance(ARUN, toSplitEntries([expense]), [], "INR");

    expect(balance.userOwesPerson.toFixedString()).toBe("450.00");
    expect(balance.personOwesUser.toFixedString()).toBe("0.00");
    expect(balance.direction).toBe("user_owes_person");
  });

  it("adds up several expenses in the same direction", () => {
    const first = buildSharedExpense({
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: ARUN, share: "500" },
      ],
    });
    const second = buildSharedExpense({
      amount: "600",
      participants: [
        { personId: null, share: "300" },
        { personId: ARUN, share: "300" },
      ],
    });

    const balance = calculatePersonBalance(ARUN, toSplitEntries([first, second]), [], "INR");
    expect(balance.personOwesUser.toFixedString()).toBe("800.00");
    expect(balance.unsettledCount).toBe(2);
  });

  it("nets obligations that run in both directions", () => {
    const userPaid = buildSharedExpense({
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: ARUN, share: "500" },
      ],
    });
    const arunPaid = buildSharedExpense({
      amount: "400",
      paidByPersonId: ARUN,
      participants: [
        { personId: null, share: "200" },
        { personId: ARUN, share: "200" },
      ],
    });

    const balance = calculatePersonBalance(ARUN, toSplitEntries([userPaid, arunPaid]), [], "INR");

    expect(balance.personOwesUser.toFixedString()).toBe("500.00");
    expect(balance.userOwesPerson.toFixedString()).toBe("200.00");
    expect(balance.net.toFixedString()).toBe("300.00");
    expect(balance.direction).toBe("person_owes_user");
  });

  it("reduces the balance by a settlement allocation", () => {
    const expense = buildSharedExpense({
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: ARUN, share: "500" },
      ],
    });
    const arunSplit = expense.splits.find((split) => split.personId === ARUN)!;

    const balance = calculatePersonBalance(
      ARUN,
      toSplitEntries([expense]),
      [buildAllocation({ expenseSplitId: arunSplit.id, amount: inr("300") })],
      "INR",
    );

    expect(balance.personOwesUser.toFixedString()).toBe("200.00");
    expect(balance.net.toFixedString()).toBe("200.00");
  });

  it("becomes settled once every obligation is fully allocated", () => {
    const first = buildSharedExpense({
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: ARUN, share: "500" },
      ],
    });
    const second = buildSharedExpense({
      amount: "600",
      participants: [
        { personId: null, share: "300" },
        { personId: ARUN, share: "300" },
      ],
    });

    const firstSplit = first.splits.find((split) => split.personId === ARUN)!;
    const secondSplit = second.splits.find((split) => split.personId === ARUN)!;

    const balance = calculatePersonBalance(
      ARUN,
      toSplitEntries([first, second]),
      [
        buildAllocation({ expenseSplitId: firstSplit.id, amount: inr("500") }),
        buildAllocation({ expenseSplitId: secondSplit.id, amount: inr("300") }),
      ],
      "INR",
    );

    expect(balance.isSettled).toBe(true);
    expect(balance.direction).toBe("settled");
    expect(balance.unsettledCount).toBe(0);
  });

  it("matches the documented running example", () => {
    // Arun owes ₹500 then ₹300 (total ₹800); a ₹300 settlement leaves ₹500.
    const first = buildSharedExpense({
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: ARUN, share: "500" },
      ],
    });
    const second = buildSharedExpense({
      amount: "600",
      participants: [
        { personId: null, share: "300" },
        { personId: ARUN, share: "300" },
      ],
    });

    const entries = toSplitEntries([first, second]);
    expect(calculatePersonBalance(ARUN, entries, [], "INR").net.toFixedString()).toBe("800.00");

    const secondSplit = second.splits.find((split) => split.personId === ARUN)!;
    const settled = calculatePersonBalance(
      ARUN,
      entries,
      [buildAllocation({ expenseSplitId: secondSplit.id, amount: inr("300") })],
      "INR",
    );

    expect(settled.net.toFixedString()).toBe("500.00");
  });

  it("keeps an uneven three-way split exact", () => {
    // ₹1,000 across three people: 333.34 / 333.33 / 333.33.
    const expense = buildSharedExpense({
      amount: "1000",
      participants: [
        { personId: null, share: "333.34" },
        { personId: ARUN, share: "333.33" },
        { personId: VIJAY, share: "333.33" },
      ],
    });

    const entries = toSplitEntries([expense]);
    const arun = calculatePersonBalance(ARUN, entries, [], "INR");
    const vijay = calculatePersonBalance(VIJAY, entries, [], "INR");

    expect(arun.net.toFixedString()).toBe("333.33");
    expect(vijay.net.toFixedString()).toBe("333.33");
  });
});

describe("buildPersonObligations", () => {
  it("returns one obligation per user/person split, newest first", () => {
    const older = buildSharedExpense({
      amount: "200",
      description: "Older",
      date: new Date("2026-08-01T00:00:00.000Z"),
      participants: [
        { personId: null, share: "100" },
        { personId: ARUN, share: "100" },
      ],
    });
    const newer = buildSharedExpense({
      amount: "400",
      description: "Newer",
      date: new Date("2026-08-20T00:00:00.000Z"),
      participants: [
        { personId: null, share: "200" },
        { personId: ARUN, share: "200" },
      ],
    });

    const obligations = buildPersonObligations(toSplitEntries([older, newer]), []);

    expect(obligations).toHaveLength(2);
    expect(obligations[0]?.description).toBe("Newer");
    expect(obligations[1]?.description).toBe("Older");
  });

  it("carries the settlement status of each obligation", () => {
    const expense = buildSharedExpense({
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: ARUN, share: "500" },
      ],
    });
    const arunSplit = expense.splits.find((split) => split.personId === ARUN)!;

    const obligations = buildPersonObligations(toSplitEntries([expense]), [
      buildAllocation({ expenseSplitId: arunSplit.id, amount: inr("200") }),
    ]);

    expect(obligations[0]?.status).toBe("partially_settled");
    expect(obligations[0]?.allocatedAmount.toFixedString()).toBe("200.00");
    expect(obligations[0]?.remainingAmount.toFixedString()).toBe("300.00");
  });
});

describe("unsettledObligationsFor", () => {
  it("returns only obligations with something outstanding", () => {
    const expense = buildSharedExpense({
      amount: "900",
      participants: [
        { personId: null, share: "300" },
        { personId: ARUN, share: "300" },
        { personId: VIJAY, share: "300" },
      ],
    });

    const arunSplit = expense.splits.find((split) => split.personId === ARUN)!;
    const obligations = buildPersonObligations(toSplitEntries([expense]), [
      buildAllocation({ expenseSplitId: arunSplit.id, amount: inr("300") }),
    ]);

    expect(unsettledObligationsFor(ARUN, obligations)).toHaveLength(0);
    expect(unsettledObligationsFor(VIJAY, obligations)).toHaveLength(1);
  });

  it("can filter by direction", () => {
    const userPaid = buildSharedExpense({
      amount: "200",
      participants: [
        { personId: null, share: "100" },
        { personId: ARUN, share: "100" },
      ],
    });
    const arunPaid = buildSharedExpense({
      amount: "400",
      paidByPersonId: ARUN,
      participants: [
        { personId: null, share: "200" },
        { personId: ARUN, share: "200" },
      ],
    });

    const obligations = buildPersonObligations(toSplitEntries([userPaid, arunPaid]), []);

    expect(unsettledObligationsFor(ARUN, obligations, "person_owes_user")).toHaveLength(1);
    expect(unsettledObligationsFor(ARUN, obligations, "user_owes_person")).toHaveLength(1);
  });
});

describe("calculatePersonBalances", () => {
  it("returns a balance for every person in the data", () => {
    const expense = buildSharedExpense({
      amount: "900",
      participants: [
        { personId: null, share: "300" },
        { personId: ARUN, share: "300" },
        { personId: VIJAY, share: "300" },
      ],
    });

    const balances = calculatePersonBalances(toSplitEntries([expense]), [], "INR");

    expect(balances.size).toBe(2);
    expect(balances.get(ARUN)?.net.toFixedString()).toBe("300.00");
  });

  it("includes requested people who have no history at all", () => {
    const balances = calculatePersonBalances([], [], "INR", [ARUN, VIJAY]);

    expect(balances.size).toBe(2);
    expect(balances.get(ARUN)?.isSettled).toBe(true);
  });
});

describe("calculatePeopleTotals", () => {
  it("splits receivables from payables using each person's net position", () => {
    const arunOwes = buildSharedExpense({
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: ARUN, share: "500" },
      ],
    });
    const userOwesVijay = buildSharedExpense({
      amount: "600",
      paidByPersonId: VIJAY,
      participants: [
        { personId: null, share: "300" },
        { personId: VIJAY, share: "300" },
      ],
    });

    const balances = calculatePersonBalances(toSplitEntries([arunOwes, userOwesVijay]), [], "INR");
    const totals = calculatePeopleTotals(balances.values(), "INR");

    expect(totals.peopleOweUser.toFixedString()).toBe("500.00");
    expect(totals.userOwesPeople.toFixedString()).toBe("300.00");
    expect(totals.net.toFixedString()).toBe("200.00");
  });

  it("uses one net figure per person rather than both gross figures", () => {
    // Arun owes ₹500 and the user owes Arun ₹200 -> ₹300 receivable, nothing payable.
    const userPaid = buildSharedExpense({
      amount: "1000",
      participants: [
        { personId: null, share: "500" },
        { personId: ARUN, share: "500" },
      ],
    });
    const arunPaid = buildSharedExpense({
      amount: "400",
      paidByPersonId: ARUN,
      participants: [
        { personId: null, share: "200" },
        { personId: ARUN, share: "200" },
      ],
    });

    const balances = calculatePersonBalances(toSplitEntries([userPaid, arunPaid]), [], "INR");
    const totals = calculatePeopleTotals(balances.values(), "INR");

    expect(totals.peopleOweUser.toFixedString()).toBe("300.00");
    expect(totals.userOwesPeople.toFixedString()).toBe("0.00");
  });

  it("is zero when everything is settled", () => {
    const totals = calculatePeopleTotals([], "INR");
    expect(totals.peopleOweUser.isZero()).toBe(true);
    expect(totals.userOwesPeople.isZero()).toBe(true);
  });
});
