import { Decimal128 } from "mongodb";
import { beforeEach, describe, expect, it } from "vitest";
import { COLLECTIONS } from "@/config/constants";
import type { User } from "@/domain/users/entities";
import { getDb } from "@/server/db/client";
import { collections } from "@/server/db/collections";
import { INITIAL_SYNC_VERSION } from "@/server/db/conventions";
import { fromDecimal128, toDecimal128 } from "@/server/db/decimal128";
import { accountRepository } from "@/server/repositories/mongo/account-repository";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
import { personRepository } from "@/server/repositories/mongo/person-repository";
import { syncOperationRepository } from "@/server/repositories/mongo/sync-operation-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { clientId, fixedDate, inr, operationId } from "@tests/helpers/fixtures";
import { createTestUser } from "@tests/helpers/auth";

const accounts = accountRepository();
const people = personRepository();
const categories = categoryRepository();
const transactions = transactionRepository();
const syncOperations = syncOperationRepository();

let user: User;
let otherUser: User;

beforeEach(async () => {
  user = await createTestUser();
  otherUser = await createTestUser();
});

describe("Decimal128 handling", () => {
  it("round-trips monetary values exactly", async () => {
    for (const amount of ["0.01", "1234.56", "999999.99", "0.05", "100000000.01"]) {
      const stored = toDecimal128(inr(amount));
      expect(fromDecimal128(stored, "INR").toString()).toBe(inr(amount).toString());
    }
  });

  it("persists amounts as Decimal128 rather than a double", async () => {
    const account = await accounts.create(user.id, {
      clientId: clientId("acc"),
      name: "HDFC Savings",
      type: "bank",
      currency: "INR",
      openingBalance: inr("50000.55"),
    });

    const db = await getDb();
    const raw = await db
      .collection(COLLECTIONS.accounts)
      .findOne<{ openingBalance: unknown }>({ clientId: account.clientId });

    expect(raw?.openingBalance).toBeInstanceOf(Decimal128);
    expect(String(raw?.openingBalance)).toBe("50000.55");
  });

  it("refuses to read a monetary field that was stored as a double", async () => {
    expect(() => fromDecimal128(1234.56, "INR")).toThrow(/Decimal128/);
  });

  it("keeps precision that a float would lose", async () => {
    const account = await accounts.create(user.id, {
      clientId: clientId("acc"),
      name: "Cash",
      type: "cash",
      currency: "INR",
      openingBalance: inr("0.1"),
    });

    const reloaded = await accounts.findById(user.id, account.id);
    expect(reloaded?.openingBalance.toString()).toBe("0.1");
  });
});

describe("timestamp and sync-version conventions", () => {
  it("stamps createdAt, updatedAt and an initial sync version on create", async () => {
    const before = Date.now();
    const person = await people.create(user.id, { clientId: clientId("p"), name: "Arun" });
    const after = Date.now();

    expect(person.syncVersion).toBe(INITIAL_SYNC_VERSION);
    expect(person.createdAt.getTime()).toBeGreaterThanOrEqual(before);
    expect(person.createdAt.getTime()).toBeLessThanOrEqual(after);
    expect(person.updatedAt.getTime()).toBe(person.createdAt.getTime());
  });

  it("increments the sync version and moves updatedAt on every write", async () => {
    const person = await people.create(user.id, { clientId: clientId("p"), name: "Arun" });

    const updated = await people.update(user.id, person.id, { name: "Arun K" });
    expect(updated.syncVersion).toBe(person.syncVersion + 1);
    expect(updated.updatedAt.getTime()).toBeGreaterThanOrEqual(person.updatedAt.getTime());
    expect(updated.createdAt.getTime()).toBe(person.createdAt.getTime());

    const archived = await people.archive(user.id, person.id);
    expect(archived.syncVersion).toBe(person.syncVersion + 2);
  });

  it("rejects an update based on a stale sync version", async () => {
    const person = await people.create(user.id, { clientId: clientId("p"), name: "Arun" });
    await people.update(user.id, person.id, { name: "Arun K" });

    await expect(
      people.update(user.id, person.id, { name: "Arun M", expectedSyncVersion: 1 }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("soft deletion and archiving", () => {
  it("hides soft-deleted transactions from reads but keeps the row", async () => {
    const account = await accounts.create(user.id, {
      clientId: clientId("acc"),
      name: "Cash",
      type: "cash",
      currency: "INR",
      openingBalance: inr("0"),
    });

    const transaction = await transactions.create(user.id, {
      clientId: clientId("txn"),
      type: "expense",
      amount: inr("450"),
      description: "Dinner",
      date: fixedDate(),
      accountId: account.id,
      paidBy: { type: "user", personId: null },
    });

    await transactions.softDelete(user.id, transaction.id);

    expect(await transactions.findById(user.id, transaction.id)).toBeNull();

    const collection = await collections.transactions();
    const raw = await collection.findOne({ clientId: transaction.clientId });
    expect(raw).not.toBeNull();
    expect(raw?.deletedAt).toBeInstanceOf(Date);
  });

  it("excludes archived reference data from the default listing", async () => {
    const person = await people.create(user.id, { clientId: clientId("p"), name: "Vijay" });
    await people.archive(user.id, person.id);

    expect(await people.list(user.id)).toHaveLength(0);
    expect(await people.list(user.id, { includeArchived: true })).toHaveLength(1);
  });

  it("can restore archived reference data", async () => {
    const person = await people.create(user.id, { clientId: clientId("p"), name: "Vijay" });
    await people.archive(user.id, person.id);

    const restored = await people.restore(user.id, person.id);
    expect(restored.archivedAt).toBeNull();
    expect(await people.list(user.id)).toHaveLength(1);
  });

  it("refuses to soft-delete the same transaction twice", async () => {
    const transaction = await transactions.create(user.id, {
      clientId: clientId("txn"),
      type: "expense",
      amount: inr("100"),
      description: "Tea",
      date: fixedDate(),
      paidBy: { type: "user", personId: null },
    });

    await transactions.softDelete(user.id, transaction.id);
    await expect(transactions.softDelete(user.id, transaction.id)).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });
});

describe("ownership scoping", () => {
  it("does not return another user's account by id", async () => {
    const account = await accounts.create(otherUser.id, {
      clientId: clientId("acc"),
      name: "Their bank",
      type: "bank",
      currency: "INR",
      openingBalance: inr("1000"),
    });

    expect(await accounts.findById(user.id, account.id)).toBeNull();
    expect(await accounts.list(user.id)).toHaveLength(0);
  });

  it("does not return another user's transaction by id", async () => {
    const transaction = await transactions.create(otherUser.id, {
      clientId: clientId("txn"),
      type: "expense",
      amount: inr("100"),
      description: "Theirs",
      date: fixedDate(),
      paidBy: { type: "user", personId: null },
    });

    expect(await transactions.findById(user.id, transaction.id)).toBeNull();
  });

  it("refuses to update another user's record", async () => {
    const person = await people.create(otherUser.id, { clientId: clientId("p"), name: "Theirs" });

    await expect(people.update(user.id, person.id, { name: "Mine now" })).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  it("treats a malformed id as not found rather than failing", async () => {
    expect(await accounts.findById(user.id, "not-an-object-id").catch(() => null)).toBeNull();
  });

  it("allows two users to reuse the same clientId independently", async () => {
    const shared = clientId("acc");

    const mine = await accounts.create(user.id, {
      clientId: shared,
      name: "Mine",
      type: "bank",
      currency: "INR",
      openingBalance: inr("1"),
    });
    const theirs = await accounts.create(otherUser.id, {
      clientId: shared,
      name: "Theirs",
      type: "bank",
      currency: "INR",
      openingBalance: inr("2"),
    });

    expect(mine.id).not.toBe(theirs.id);
  });
});

describe("clientId idempotency", () => {
  it("returns the existing record when the same clientId is created twice", async () => {
    const id = clientId("acc");

    const first = await accounts.create(user.id, {
      clientId: id,
      name: "HDFC Savings",
      type: "bank",
      currency: "INR",
      openingBalance: inr("50000"),
    });
    const second = await accounts.create(user.id, {
      clientId: id,
      name: "Different name on retry",
      type: "bank",
      currency: "INR",
      openingBalance: inr("50000"),
    });

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("HDFC Savings");
    expect(await accounts.countAll(user.id)).toBe(1);
  });

  it("does not create a duplicate transaction on retry", async () => {
    const id = clientId("txn");
    const input = {
      clientId: id,
      type: "expense" as const,
      amount: inr("450"),
      description: "Dinner",
      date: fixedDate(),
      paidBy: { type: "user" as const, personId: null },
    };

    const first = await transactions.create(user.id, input);
    const second = await transactions.create(user.id, input);

    expect(second.id).toBe(first.id);

    const collection = await collections.transactions();
    expect(await collection.countDocuments({ clientId: id })).toBe(1);
  });
});

describe("credit-card fields", () => {
  it("stores card terms only for credit-card accounts", async () => {
    const card = await accounts.create(user.id, {
      clientId: clientId("card"),
      name: "HDFC Credit Card",
      type: "credit_card",
      currency: "INR",
      openingBalance: inr("0"),
      creditLimit: inr("150000"),
      statementDay: 5,
      paymentDueDay: 25,
    });

    expect(card.creditCard?.creditLimit.toString()).toBe("150000");
    expect(card.creditCard?.statementDay).toBe(5);
    expect(card.creditCard?.paymentDueDay).toBe(25);

    const bank = await accounts.create(user.id, {
      clientId: clientId("bank"),
      name: "HDFC Savings",
      type: "bank",
      currency: "INR",
      openingBalance: inr("1000"),
      // A client sending card terms for a bank account must not have them stored.
      creditLimit: inr("999999"),
      statementDay: 9,
    });

    expect(bank.creditCard).toBeNull();
  });
});

describe("category hierarchy", () => {
  // Registration seeds the default categories, so these assert relative to that
  // baseline rather than assuming an empty collection.
  it("stores a parent reference and reports children", async () => {
    const before = await categories.countAll(user.id);

    const parent = await categories.create(user.id, {
      clientId: clientId("cat"),
      name: "Hobbies",
    });
    await categories.create(user.id, {
      clientId: clientId("cat"),
      name: "Cycling",
      parentId: parent.id,
    });

    expect(await categories.hasChildren(user.id, parent.id)).toBe(true);

    const list = await categories.list(user.id);
    expect(list).toHaveLength(before + 2);
    expect(list.find((c) => c.name === "Cycling")?.parentId).toBe(parent.id);
  });

  it("bulk-creates categories", async () => {
    const before = await categories.countAll(user.id);

    const created = await categories.createMany(user.id, [
      { clientId: clientId("cat"), name: "Gadgets" },
      { clientId: clientId("cat"), name: "Gifts" },
    ]);

    expect(created).toHaveLength(2);
    expect(await categories.countAll(user.id)).toBe(before + 2);
  });

  it("seeds the default categories on registration", async () => {
    const { DEFAULT_CATEGORIES } = await import("@/config/constants");
    expect(await categories.countAll(user.id)).toBe(DEFAULT_CATEGORIES.length);
  });
});

describe("sync operation ledger", () => {
  it("claims an operation once and reports later attempts as duplicates", async () => {
    const id = operationId();
    const input = {
      operationId: id,
      operationType: "CREATE_EXPENSE" as const,
      clientId: clientId("txn"),
    };

    expect(await syncOperations.claim(user.id, input)).toEqual({ status: "claimed" });

    await syncOperations.complete(user.id, id, {
      entityId: "6a95b78237559e60592da181",
      entityType: "transaction",
    });

    const second = await syncOperations.claim(user.id, input);
    expect(second.status).toBe("duplicate");
    if (second.status === "duplicate") {
      expect(second.record.status).toBe("completed");
      expect(second.record.result?.entityId).toBe("6a95b78237559e60592da181");
    }
  });

  it("scopes operation ids per user", async () => {
    const id = operationId();
    const input = {
      operationId: id,
      operationType: "CREATE_EXPENSE" as const,
      clientId: clientId("txn"),
    };

    expect((await syncOperations.claim(user.id, input)).status).toBe("claimed");
    expect((await syncOperations.claim(otherUser.id, input)).status).toBe("claimed");
  });

  it("releases a claim so a transient failure can be retried", async () => {
    const id = operationId();
    const input = {
      operationId: id,
      operationType: "CREATE_EXPENSE" as const,
      clientId: clientId("txn"),
    };

    await syncOperations.claim(user.id, input);
    await syncOperations.release(user.id, id);

    expect((await syncOperations.claim(user.id, input)).status).toBe("claimed");
  });

  it("records a permanent failure without releasing the claim", async () => {
    const id = operationId();
    const input = {
      operationId: id,
      operationType: "CREATE_EXPENSE" as const,
      clientId: clientId("txn"),
    };

    await syncOperations.claim(user.id, input);
    await syncOperations.fail(user.id, id, "INVALID_SPLIT_TOTAL");

    const record = await syncOperations.find(user.id, id);
    expect(record?.status).toBe("failed");
    expect(record?.errorCode).toBe("INVALID_SPLIT_TOTAL");

    const retry = await syncOperations.claim(user.id, input);
    expect(retry.status).toBe("duplicate");
  });
});

describe("indexes", () => {
  it("creates the unique clientId index on every synced collection", async () => {
    const db = await getDb();

    for (const name of [
      COLLECTIONS.accounts,
      COLLECTIONS.people,
      COLLECTIONS.categories,
      COLLECTIONS.transactions,
      COLLECTIONS.expenseSplits,
      COLLECTIONS.settlements,
      COLLECTIONS.settlementAllocations,
    ]) {
      const indexes = await db.collection(name).indexes();
      const unique = indexes.find((index) => index.name === "userId_clientId_unique");
      expect(unique, `${name} is missing userId_clientId_unique`).toBeDefined();
      expect(unique?.unique).toBe(true);
    }
  });

  it("creates the unique email index on users", async () => {
    const db = await getDb();
    const indexes = await db.collection(COLLECTIONS.users).indexes();
    const unique = indexes.find((index) => index.name === "email_unique");
    expect(unique?.unique).toBe(true);
  });

  it("creates the unique operationId index for idempotency", async () => {
    const db = await getDb();
    const indexes = await db.collection(COLLECTIONS.syncOperations).indexes();
    const unique = indexes.find((index) => index.name === "userId_operationId_unique");
    expect(unique?.unique).toBe(true);
  });
});
