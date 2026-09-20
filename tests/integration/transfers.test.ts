import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { User } from "@/domain/users/entities";
import { calculateTotalSpending } from "@/domain/transactions/calculations";
import type { TransferDetailView } from "@/features/transactions/view-models/transfer-view-model";
import type { TransactionListItem } from "@/features/transactions/view-models/expense-view-model";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { expectData, expectError, invokeRoute } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  createTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";
import { clientId } from "@tests/helpers/fixtures";
import {
  seedBankAccount,
  seedCashAccount,
  seedCreditCard,
  seedPersonalExpense,
} from "@tests/helpers/seed";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { GET: listTransfers, POST: createTransfer } = await import("@/app/api/transfers/route");
const {
  GET: getTransfer,
  PATCH: patchTransfer,
  DELETE: deleteTransfer,
} = await import("@/app/api/transfers/[id]/route");
const { GET: getAccount, DELETE: archiveAccount } = await import("@/app/api/accounts/[id]/route");
const { PATCH: patchExpense } = await import("@/app/api/expenses/[id]/route");

/** Archiving is a DELETE on the account route; the record itself survives. */
async function archiveAccountById(accountId: string): Promise<void> {
  await invokeRoute(archiveAccount, `/api/accounts/${accountId}`, {
    method: "DELETE",
    params: { id: accountId },
  });
}

const transactions = transactionRepository();
const splits = expenseSplitRepository();

let user: User;
let bank: Account;
let cash: Account;

type TransferListResponse = {
  items: TransactionListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  accountNames: Record<string, string>;
};

async function postTransfer(body: Record<string, unknown> = {}) {
  return invokeRoute<TransactionListItem>(createTransfer, "/api/transfers", {
    method: "POST",
    body: {
      clientId: clientId("txn"),
      amount: "10000",
      fromAccountId: bank.id,
      toAccountId: cash.id,
      date: "2026-08-15T10:00:00.000Z",
      ...body,
    },
  });
}

async function balanceOf(accountId: string): Promise<string> {
  const view = expectData(
    await invokeRoute<{ balance: { amount: string } }>(getAccount, `/api/accounts/${accountId}`, {
      params: { id: accountId },
    }),
  );
  return view.balance.amount;
}

async function cardOutstanding(accountId: string): Promise<{
  outstanding: string;
  availableCredit: string;
}> {
  const view = expectData(
    await invokeRoute<{
      outstanding: { amount: string };
      availableCredit: { amount: string };
    }>(getAccount, `/api/accounts/${accountId}`, { params: { id: accountId } }),
  );
  return {
    outstanding: view.outstanding.amount,
    availableCredit: view.availableCredit.amount,
  };
}

/** Total spending recomputed from source data, the way the dashboard will. */
async function totalSpending(userId: string): Promise<string> {
  const all = await transactions.listForProjection(userId);
  const allSplits = await splits.listAll(userId);
  return calculateTotalSpending(all, allSplits, "INR").toFixedString();
}

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR" });
  bank = await seedBankAccount(user.id, { openingBalance: "50000" });
  cash = await seedCashAccount(user.id, { openingBalance: "2000" });
});

describe("POST /api/transfers", () => {
  it("moves money out of the source and into the destination", async () => {
    const response = await postTransfer();

    expect(response.status).toBe(201);
    const transfer = expectData(response);
    expect(transfer.type).toBe("transfer");
    expect(transfer.amount.amount).toBe("10000");
    expect(transfer.fromAccountId).toBe(bank.id);
    expect(transfer.toAccountId).toBe(cash.id);

    expect(await balanceOf(bank.id)).toBe("40000");
    expect(await balanceOf(cash.id)).toBe("12000");
  });

  it("leaves the combined balance unchanged, because nothing was consumed", async () => {
    const before = Number(await balanceOf(bank.id)) + Number(await balanceOf(cash.id));

    await postTransfer({ amount: "7500" });

    const after = Number(await balanceOf(bank.id)) + Number(await balanceOf(cash.id));
    expect(after).toBe(before);
  });

  it("is not counted as spending", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id });
    expect(await totalSpending(user.id)).toBe("450.00");

    await postTransfer({ amount: "10000" });

    // The expense still accounts for every rupee of spending.
    expect(await totalSpending(user.id)).toBe("450.00");
  });

  it("reports a zero user share, so no list row claims it was spent", async () => {
    const transfer = expectData(await postTransfer());

    expect(transfer.userShare.amount).toBe("0");
    // Not flagged as "split": a transfer has no share to compare against.
    expect(transfer.isSplit).toBe(false);
    expect(transfer.isShared).toBe(false);
  });

  it("creates no expense splits", async () => {
    const transfer = expectData(await postTransfer());

    expect(await splits.listByTransaction(user.id, transfer.id)).toHaveLength(0);
  });

  it("defaults the description to 'Transfer'", async () => {
    const transfer = expectData(await postTransfer());
    expect(transfer.description).toBe("Transfer");
  });

  it("keeps a description the user supplied", async () => {
    const transfer = expectData(await postTransfer({ description: "  Rent   float  " }));
    expect(transfer.description).toBe("Rent float");
  });

  it("stores optional notes", async () => {
    const transfer = expectData(await postTransfer({ notes: "For the deposit" }));
    expect(transfer.notes).toBe("For the deposit");
  });

  it("has no category, because a transfer is not spending", async () => {
    const transfer = expectData(await postTransfer());
    expect(transfer.categoryId).toBeNull();
  });

  it("rejects a transfer to the same account", async () => {
    const response = await postTransfer({ toAccountId: bank.id });

    expect(response.status).toBe(400);
    expectError(response);
    // Nothing moved.
    expect(await balanceOf(bank.id)).toBe("50000");
  });

  it("rejects a zero amount", async () => {
    expect((await postTransfer({ amount: "0" })).status).toBe(400);
  });

  it("rejects a negative amount", async () => {
    expect((await postTransfer({ amount: "-500" })).status).toBe(400);
  });

  it("rejects an amount with more precision than the currency supports", async () => {
    expect((await postTransfer({ amount: "100.001" })).status).toBe(400);
  });

  it("rejects an account belonging to another user", async () => {
    const other = await createTestUser({ email: "other@example.com" });
    const theirAccount = await seedBankAccount(other.id, { openingBalance: "9000" });

    const response = await postTransfer({ toAccountId: theirAccount.id });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });
});

describe("credit cards", () => {
  it("rejects a credit card as the destination, because that is a card payment", async () => {
    const card = await seedCreditCard(user.id, { name: "Amex" });

    const response = await postTransfer({ toAccountId: card.id });

    expect(response.status).toBe(400);
    const error = expectError(response);
    expect(error.code).toBe("INVALID_TRANSFER");
    expect(error.message).toContain("card payment");

    // The card is untouched: no outstanding balance was reduced by the wrong record.
    expect((await cardOutstanding(card.id)).outstanding).toBe("0");
  });

  it("allows a credit card as the source, which is a cash advance", async () => {
    const card = await seedCreditCard(user.id, { creditLimit: "150000" });

    const response = await postTransfer({
      fromAccountId: card.id,
      toAccountId: cash.id,
      amount: "5000",
    });

    expect(response.status).toBe(201);

    // Drawing cash off a card increases what is owed and reduces available credit.
    const card_ = await cardOutstanding(card.id);
    expect(card_.outstanding).toBe("5000");
    expect(card_.availableCredit).toBe("145000");
    expect(await balanceOf(cash.id)).toBe("7000");
  });
});

describe("archived accounts", () => {
  it("rejects an archived source", async () => {
    await archiveAccountById(bank.id);

    const response = await postTransfer();
    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });

  it("rejects an archived destination", async () => {
    await archiveAccountById(cash.id);

    const response = await postTransfer();
    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });
});

describe("idempotency", () => {
  it("returns the same transfer for a repeated clientId and moves money once", async () => {
    const id = clientId("txn");

    const first = expectData(await postTransfer({ clientId: id }));
    const second = expectData(await postTransfer({ clientId: id }));

    expect(second.id).toBe(first.id);
    // One transfer, not two: the balance moved a single time.
    expect(await balanceOf(bank.id)).toBe("40000");
    expect(await balanceOf(cash.id)).toBe("12000");
  });

  it("does not re-validate a retry, so a retried create still succeeds", async () => {
    const id = clientId("txn");
    const first = expectData(await postTransfer({ clientId: id }));

    // Archiving the source would normally block a new transfer. The retry must still
    // return the record it already created rather than failing offline data.
    await archiveAccountById(bank.id);

    const retry = await postTransfer({ clientId: id });
    expect(retry.status).toBe(201);
    expect(expectData(retry).id).toBe(first.id);
  });
});

describe("GET /api/transfers/:id", () => {
  it("returns both account names and a direction label", async () => {
    const created = expectData(await postTransfer());

    const detail = expectData(
      await invokeRoute<TransferDetailView>(getTransfer, `/api/transfers/${created.id}`, {
        params: { id: created.id },
      }),
    );

    expect(detail.fromAccountName).toBe(bank.name);
    expect(detail.toAccountName).toBe(cash.name);
    expect(detail.directionLabel).toBe(`${bank.name} → ${cash.name}`);
    expect(detail.dateInputValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("reports 404 for an expense id", async () => {
    const expense = await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id });

    const response = await invokeRoute(getTransfer, `/api/transfers/${expense.transaction.id}`, {
      params: { id: expense.transaction.id },
    });

    expect(response.status).toBe(404);
  });

  it("reports 404 for another user's transfer", async () => {
    const created = expectData(await postTransfer());

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const response = await invokeRoute(getTransfer, `/api/transfers/${created.id}`, {
      params: { id: created.id },
    });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/transfers/:id", () => {
  it("adjusts both balances when the amount changes", async () => {
    const created = expectData(await postTransfer({ amount: "10000" }));

    const response = await invokeRoute<TransactionListItem>(
      patchTransfer,
      `/api/transfers/${created.id}`,
      { method: "PATCH", body: { amount: "4000" }, params: { id: created.id } },
    );

    expect(response.status).toBe(200);
    expect(expectData(response).amount.amount).toBe("4000");

    expect(await balanceOf(bank.id)).toBe("46000");
    expect(await balanceOf(cash.id)).toBe("6000");
  });

  it("moves the money to a different destination", async () => {
    const other = await seedBankAccount(user.id, { name: "ICICI", openingBalance: "1000" });
    const created = expectData(await postTransfer({ amount: "10000" }));

    await invokeRoute(patchTransfer, `/api/transfers/${created.id}`, {
      method: "PATCH",
      body: { toAccountId: other.id },
      params: { id: created.id },
    });

    // The original destination no longer received anything.
    expect(await balanceOf(cash.id)).toBe("2000");
    expect(await balanceOf(other.id)).toBe("11000");
    expect(await balanceOf(bank.id)).toBe("40000");
  });

  it("rejects an edit that points both sides at one account", async () => {
    const created = expectData(await postTransfer());

    const response = await invokeRoute(patchTransfer, `/api/transfers/${created.id}`, {
      method: "PATCH",
      body: { toAccountId: bank.id },
      params: { id: created.id },
    });

    expect(response.status).toBe(400);
    // Unchanged.
    expect(await balanceOf(cash.id)).toBe("12000");
  });

  it("rejects an edit that makes a credit card the destination", async () => {
    const card = await seedCreditCard(user.id);
    const created = expectData(await postTransfer());

    const response = await invokeRoute(patchTransfer, `/api/transfers/${created.id}`, {
      method: "PATCH",
      body: { toAccountId: card.id },
      params: { id: created.id },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_TRANSFER");
  });

  it("reports 404 for an expense id, so an expense cannot become a transfer", async () => {
    const expense = await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id });

    const response = await invokeRoute(patchTransfer, `/api/transfers/${expense.transaction.id}`, {
      method: "PATCH",
      body: { amount: "500" },
      params: { id: expense.transaction.id },
    });

    expect(response.status).toBe(404);
  });

  it("reports 404 when the transfer id is sent to the expense route", async () => {
    const created = expectData(await postTransfer());

    const response = await invokeRoute(patchExpense, `/api/expenses/${created.id}`, {
      method: "PATCH",
      body: { amount: "500" },
      params: { id: created.id },
    });

    expect(response.status).toBe(404);
  });

  it("reports 404 for another user's transfer", async () => {
    const created = expectData(await postTransfer());

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const response = await invokeRoute(patchTransfer, `/api/transfers/${created.id}`, {
      method: "PATCH",
      body: { amount: "1" },
      params: { id: created.id },
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/transfers/:id", () => {
  it("restores both balances", async () => {
    const created = expectData(await postTransfer());
    expect(await balanceOf(bank.id)).toBe("40000");

    const response = await invokeRoute(deleteTransfer, `/api/transfers/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    expect(response.status).toBe(204);
    expect(await balanceOf(bank.id)).toBe("50000");
    expect(await balanceOf(cash.id)).toBe("2000");
  });

  it("soft-deletes rather than removing the record", async () => {
    const created = expectData(await postTransfer());

    await invokeRoute(deleteTransfer, `/api/transfers/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    // Absent from normal reads...
    expect(await transactions.findById(user.id, created.id)).toBeNull();

    // ...but still on disk, which is what stops an offline device recreating it: a
    // replayed create finds the clientId and returns the deleted row instead of
    // inserting a second one (docs/08-OFFLINE-SYNC.md section 18).
    const onDisk = await transactions.findByClientId(user.id, created.clientId);
    expect(onDisk).not.toBeNull();
    expect(onDisk?.deletedAt).not.toBeNull();
  });

  it("reports 404 for another user's transfer", async () => {
    const created = expectData(await postTransfer());

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const response = await invokeRoute(deleteTransfer, `/api/transfers/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    expect(response.status).toBe(404);
    // Still there for its owner.
    setCurrentTestUser(user);
    expect(await balanceOf(bank.id)).toBe("40000");
  });
});

describe("GET /api/transfers", () => {
  it("returns transfers only", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id });
    await postTransfer({ amount: "1000" });

    const view = expectData(
      await invokeRoute<TransferListResponse>(listTransfers, "/api/transfers"),
    );

    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.type).toBe("transfer");
  });

  it("includes the names of both accounts on every row", async () => {
    await postTransfer();

    const view = expectData(
      await invokeRoute<TransferListResponse>(listTransfers, "/api/transfers"),
    );

    expect(view.accountNames[bank.id]).toBe(bank.name);
    expect(view.accountNames[cash.id]).toBe(cash.name);
  });

  it("matches either side when filtering by account", async () => {
    const other = await seedBankAccount(user.id, { name: "ICICI", openingBalance: "1000" });
    await postTransfer({ amount: "1000" });
    await postTransfer({ fromAccountId: other.id, toAccountId: cash.id, amount: "500" });

    // The destination is shared by both transfers.
    const byDestination = expectData(
      await invokeRoute<TransferListResponse>(listTransfers, "/api/transfers", {
        searchParams: { accountId: cash.id },
      }),
    );
    expect(byDestination.items).toHaveLength(2);

    // The source belongs to only one of them.
    const bySource = expectData(
      await invokeRoute<TransferListResponse>(listTransfers, "/api/transfers", {
        searchParams: { accountId: other.id },
      }),
    );
    expect(bySource.items).toHaveLength(1);
  });

  it("excludes another user's transfers", async () => {
    await postTransfer();

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const view = expectData(
      await invokeRoute<TransferListResponse>(listTransfers, "/api/transfers"),
    );
    expect(view.items).toHaveLength(0);
  });
});
