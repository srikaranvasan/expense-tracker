import { describe, expect, it } from "vitest";
import {
  buildAccount,
  buildCategory,
  buildCreditCard,
  buildPerson,
  buildSettlement,
  buildSharedExpense,
  buildSplit,
  buildTransaction,
  inr,
} from "@tests/helpers/builders";
import { Money, sumMoney } from "@/lib/money";
import {
  fromLocalAccount,
  fromLocalCategory,
  fromLocalExpenseSplit,
  fromLocalPerson,
  fromLocalSettlement,
  fromLocalTransaction,
  fromMoneyDto,
  pendingMeta,
  toLocalAccount,
  toLocalCategory,
  toLocalExpenseSplit,
  toLocalPerson,
  toLocalSettlement,
  toLocalTransaction,
  toMoneyDto,
} from "./record-mapping";

/**
 * These tests exist for one reason: IndexedDB stores structured clones, which strip a
 * class prototype. If a `Money` ever reaches a stored record, reading it back yields a
 * plain object and every method call on it fails at runtime. So the mapping must be
 * total, and it must round-trip exactly.
 */

describe("money conversion", () => {
  it("stores an amount as a decimal string, never a number", () => {
    const dto = toMoneyDto(inr("1234.56"));

    expect(dto).toEqual({ amount: "1234.56", currency: "INR" });
    expect(typeof dto.amount).toBe("string");
  });

  it("round-trips without losing precision", () => {
    const original = inr("19999999.99");
    const restored = fromMoneyDto(toMoneyDto(original));

    expect(restored.equals(original)).toBe(true);
    expect(restored.toFixedString()).toBe("19999999.99");
  });

  it("round-trips a value that a float would corrupt", () => {
    // 0.1 + 0.2 !== 0.3 in binary floating point. Strings sidestep it entirely.
    const restored = fromMoneyDto(toMoneyDto(inr("0.10")));
    expect(restored.equals(inr("0.1"))).toBe(true);
  });
});

describe("account mapping", () => {
  it("round-trips a bank account", () => {
    const account = buildAccount({ openingBalance: inr("50000"), institutionName: "HDFC" });
    const restored = fromLocalAccount(toLocalAccount(account));

    expect(restored?.id).toBe(account.id);
    expect(restored?.name).toBe(account.name);
    expect(restored?.type).toBe("bank");
    expect(restored?.openingBalance.equals(account.openingBalance)).toBe(true);
    expect(restored?.institutionName).toBe("HDFC");
    expect(restored?.creditCard).toBeNull();
  });

  it("round-trips a credit card including its terms", () => {
    const card = buildCreditCard({ openingBalance: inr("15000") });
    const record = toLocalAccount(card);

    // Flattened for storage, because Dexie can only index top-level fields.
    expect(record.creditLimit).toEqual({ amount: "150000", currency: "INR" });
    expect(record.statementDay).toBe(5);

    const restored = fromLocalAccount(record);
    expect(restored?.creditCard?.creditLimit.equals(inr("150000"))).toBe(true);
    expect(restored?.creditCard?.statementDay).toBe(5);
    expect(restored?.creditCard?.paymentDueDay).toBe(25);
  });

  it("stores no Money instances", () => {
    const record = toLocalAccount(buildCreditCard());

    expect(record.openingBalance).not.toBeInstanceOf(Money);
    expect(record.creditLimit).not.toBeInstanceOf(Money);
  });

  it("marks a server record as synced", () => {
    const record = toLocalAccount(buildAccount());

    expect(record.syncStatus).toBe("synced");
    expect(record.serverId).not.toBeNull();
    expect(record.syncVersion).toBe(1);
  });

  it("returns null for a record the server has not accepted", () => {
    const record = { ...toLocalAccount(buildAccount()), serverId: null };
    expect(fromLocalAccount(record)).toBeNull();
  });

  it("preserves the archived timestamp", () => {
    const archivedAt = new Date("2026-01-01T00:00:00.000Z");
    const restored = fromLocalAccount(toLocalAccount(buildAccount({ archivedAt })));

    expect(restored?.archivedAt?.toISOString()).toBe(archivedAt.toISOString());
  });
});

describe("person and category mapping", () => {
  it("round-trips a person", () => {
    const person = buildPerson({ notes: "Flatmate" });
    const restored = fromLocalPerson(toLocalPerson(person));

    expect(restored?.name).toBe("Arun");
    expect(restored?.notes).toBe("Flatmate");
  });

  it("round-trips a category, including its parent link", () => {
    const category = buildCategory({ parentId: "cat-parent", icon: "food" });
    const restored = fromLocalCategory(toLocalCategory(category));

    expect(restored?.parentId).toBe("cat-parent");
    expect(restored?.icon).toBe("food");
    expect(restored?.kind).toBe("expense");
  });
});

describe("transaction mapping", () => {
  it("round-trips an expense paid by the user", () => {
    const transaction = buildTransaction({ amount: inr("450"), accountId: "acc-1" });
    const restored = fromLocalTransaction(toLocalTransaction(transaction));

    expect(restored?.amount.equals(inr("450"))).toBe(true);
    expect(restored?.paidBy).toEqual({ type: "user", personId: null });
    expect(restored?.accountId).toBe("acc-1");
  });

  it("flattens and restores a person payer", () => {
    const transaction = buildTransaction({
      paidBy: { type: "person", personId: "person-9" },
      accountId: null,
    });
    const record = toLocalTransaction(transaction);

    // Flattened so "everything involving Arun" can use an index.
    expect(record.paidByType).toBe("person");
    expect(record.paidByPersonId).toBe("person-9");

    expect(fromLocalTransaction(record)?.paidBy).toEqual({
      type: "person",
      personId: "person-9",
    });
  });

  it("round-trips a transfer's two accounts and null payer", () => {
    const transfer = buildTransaction({
      type: "transfer",
      accountId: null,
      fromAccountId: "acc-1",
      toAccountId: "acc-2",
      paidBy: null,
    });

    const restored = fromLocalTransaction(toLocalTransaction(transfer));

    expect(restored?.type).toBe("transfer");
    expect(restored?.fromAccountId).toBe("acc-1");
    expect(restored?.toAccountId).toBe("acc-2");
    expect(restored?.paidBy).toBeNull();
  });

  it("preserves a soft-delete timestamp", () => {
    const deletedAt = new Date("2026-08-20T00:00:00.000Z");
    const record = toLocalTransaction(buildTransaction({ deletedAt }));

    expect(record.deletedAt?.toISOString()).toBe(deletedAt.toISOString());
    expect(fromLocalTransaction(record)?.deletedAt?.toISOString()).toBe(deletedAt.toISOString());
  });

  it("stores the date as a Date, which structured clone preserves", () => {
    const record = toLocalTransaction(buildTransaction());
    expect(record.date).toBeInstanceOf(Date);
  });
});

describe("split mapping", () => {
  it("carries the owning transaction's clientId so the link survives before sync", () => {
    const split = buildSplit({ transactionId: "txn-server-1", shareAmount: inr("600") });
    const record = toLocalExpenseSplit(split, "txn-client-1");

    expect(record.transactionClientId).toBe("txn-client-1");
    expect(record.transactionId).toBe("txn-server-1");
    expect(record.shareAmount).toEqual({ amount: "600", currency: "INR" });
  });

  it("round-trips a person's share", () => {
    const split = buildSplit({
      participantType: "person",
      personId: "person-1",
      shareAmount: inr("333.34"),
    });

    const restored = fromLocalExpenseSplit(toLocalExpenseSplit(split, "txn-client-1"));

    expect(restored?.participantType).toBe("person");
    expect(restored?.personId).toBe("person-1");
    expect(restored?.shareAmount.equals(inr("333.34"))).toBe(true);
  });

  it("returns null when the transaction has no server id yet", () => {
    const record = {
      ...toLocalExpenseSplit(buildSplit(), "txn-client-1"),
      transactionId: null,
    };

    expect(fromLocalExpenseSplit(record)).toBeNull();
  });

  it("keeps a shared expense's shares summing to the total across a round trip", () => {
    const expense = buildSharedExpense({
      amount: "1000",
      accountId: "acc-1",
      participants: [
        { personId: null, share: "333.33" },
        { personId: "p1", share: "333.34" },
        { personId: "p2", share: "333.33" },
      ],
    });

    const restored = expense.splits
      .map((split) => toLocalExpenseSplit(split, expense.transaction.clientId))
      .map(fromLocalExpenseSplit);

    const total = sumMoney(
      restored.filter((split) => split !== null).map((split) => split.shareAmount),
      "INR",
    );

    // The invariant the whole money layer exists to protect.
    expect(total.toFixedString()).toBe("1000.00");
  });
});

describe("settlement mapping", () => {
  it("round-trips a settlement", () => {
    const settlement = buildSettlement({ amount: inr("600"), direction: "person_to_user" });
    const restored = fromLocalSettlement(toLocalSettlement(settlement));

    expect(restored?.amount.equals(inr("600"))).toBe(true);
    expect(restored?.direction).toBe("person_to_user");
    expect(restored?.personId).toBe("person1");
  });
});

describe("pendingMeta", () => {
  it("describes a record the server has never seen", () => {
    const meta = pendingMeta({ clientId: "c1", userId: "u1", now: new Date("2026-08-15") });

    expect(meta.syncStatus).toBe("pending");
    expect(meta.serverId).toBeNull();
    expect(meta.syncVersion).toBeNull();
    expect(meta.serverUpdatedAt).toBeNull();
    expect(meta.deletedAt).toBeNull();
    expect(meta.localUpdatedAt.toISOString()).toBe(new Date("2026-08-15").toISOString());
  });
});
