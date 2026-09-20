import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { User } from "@/domain/users/entities";
import { calculateTotalSpending } from "@/domain/transactions/calculations";
import type { CardPaymentDetailView } from "@/features/transactions/view-models/card-payment-view-model";
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

const { GET: listPayments, POST: createPayment } =
  await import("@/app/api/credit-card-payments/route");
const {
  GET: getPayment,
  PATCH: patchPayment,
  DELETE: deletePayment,
} = await import("@/app/api/credit-card-payments/[id]/route");
const { GET: getAccount, DELETE: archiveAccount } = await import("@/app/api/accounts/[id]/route");
const { POST: createTransfer } = await import("@/app/api/transfers/route");
const { PATCH: patchTransfer } = await import("@/app/api/transfers/[id]/route");

const transactions = transactionRepository();
const splits = expenseSplitRepository();

let user: User;
let bank: Account;
let card: Account;

type PaymentListResponse = {
  items: TransactionListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  accountNames: Record<string, string>;
};

async function postPayment(body: Record<string, unknown> = {}) {
  return invokeRoute<TransactionListItem>(createPayment, "/api/credit-card-payments", {
    method: "POST",
    body: {
      clientId: clientId("txn"),
      amount: "10000",
      fromAccountId: bank.id,
      toAccountId: card.id,
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

async function cardPosition(accountId: string): Promise<{
  outstanding: string;
  availableCredit: string;
  overLimit: boolean;
}> {
  const view = expectData(
    await invokeRoute<{
      outstanding: { amount: string };
      availableCredit: { amount: string };
      overLimit: boolean;
    }>(getAccount, `/api/accounts/${accountId}`, { params: { id: accountId } }),
  );
  return {
    outstanding: view.outstanding.amount,
    availableCredit: view.availableCredit.amount,
    overLimit: view.overLimit,
  };
}

/** Total spending recomputed from source data, the way the dashboard will. */
async function totalSpending(userId: string): Promise<string> {
  const all = await transactions.listForProjection(userId);
  const allSplits = await splits.listAll(userId);
  return calculateTotalSpending(all, allSplits, "INR").toFixedString();
}

async function archiveAccountById(accountId: string): Promise<void> {
  await invokeRoute(archiveAccount, `/api/accounts/${accountId}`, {
    method: "DELETE",
    params: { id: accountId },
  });
}

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR" });
  bank = await seedBankAccount(user.id, { openingBalance: "50000" });
  // A card that already owes 15,000 against a 150,000 limit.
  card = await seedCreditCard(user.id, { creditLimit: "150000", openingBalance: "15000" });
});

describe("POST /api/credit-card-payments", () => {
  it("reduces the card's outstanding balance and the source balance", async () => {
    const response = await postPayment();

    expect(response.status).toBe(201);
    const payment = expectData(response);
    expect(payment.type).toBe("credit_card_payment");
    expect(payment.amount.amount).toBe("10000");

    expect(await balanceOf(bank.id)).toBe("40000");

    const position = await cardPosition(card.id);
    expect(position.outstanding).toBe("5000");
  });

  it("increases available credit by the amount paid", async () => {
    const before = await cardPosition(card.id);
    expect(before.availableCredit).toBe("135000");

    await postPayment({ amount: "10000" });

    const after = await cardPosition(card.id);
    expect(after.availableCredit).toBe("145000");
  });

  it("is not counted as spending", async () => {
    // Spending on the card, which is what created the liability.
    await seedPersonalExpense(user.id, { amount: "1200", accountId: card.id });
    expect(await totalSpending(user.id)).toBe("1200.00");

    await postPayment({ amount: "1200" });

    // Paying the card must not count the same 1,200 a second time.
    expect(await totalSpending(user.id)).toBe("1200.00");
  });

  it("creates no expense splits", async () => {
    const payment = expectData(await postPayment());
    expect(await splits.listByTransaction(user.id, payment.id)).toHaveLength(0);
  });

  it("defaults the description", async () => {
    const payment = expectData(await postPayment());
    expect(payment.description).toBe("Credit card payment");
  });

  it("keeps a description the user supplied", async () => {
    const payment = expectData(await postPayment({ description: "August statement" }));
    expect(payment.description).toBe("August statement");
  });

  it("has no category, because a payment is not spending", async () => {
    const payment = expectData(await postPayment());
    expect(payment.categoryId).toBeNull();
  });

  it("allows paying from cash", async () => {
    const cash = await seedCashAccount(user.id, { openingBalance: "20000" });

    const response = await postPayment({ fromAccountId: cash.id, amount: "5000" });

    expect(response.status).toBe(201);
    expect(await balanceOf(cash.id)).toBe("15000");
    expect((await cardPosition(card.id)).outstanding).toBe("10000");
  });

  it("supports a partial payment", async () => {
    await postPayment({ amount: "5000" });
    expect((await cardPosition(card.id)).outstanding).toBe("10000");
  });

  it("supports repeated payments that together clear the balance", async () => {
    await postPayment({ amount: "5000" });
    await postPayment({ amount: "10000" });

    expect((await cardPosition(card.id)).outstanding).toBe("0");
    expect((await cardPosition(card.id)).availableCredit).toBe("150000");
  });

  it("rejects a zero or negative amount", async () => {
    expect((await postPayment({ amount: "0" })).status).toBe(400);
    expect((await postPayment({ amount: "-100" })).status).toBe(400);
  });

  it("rejects an over-precise amount", async () => {
    expect((await postPayment({ amount: "100.001" })).status).toBe(400);
  });
});

describe("destination and source validation", () => {
  it("rejects a destination that is not a credit card", async () => {
    const other = await seedBankAccount(user.id, { name: "ICICI", openingBalance: "1000" });

    const response = await postPayment({ toAccountId: other.id });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
    // Nothing moved.
    expect(await balanceOf(bank.id)).toBe("50000");
    expect(await balanceOf(other.id)).toBe("1000");
  });

  it("rejects one card paying another", async () => {
    const otherCard = await seedCreditCard(user.id, { name: "Amex", openingBalance: "2000" });

    const response = await postPayment({ fromAccountId: otherCard.id });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
    // Neither card's liability was touched.
    expect((await cardPosition(card.id)).outstanding).toBe("15000");
    expect((await cardPosition(otherCard.id)).outstanding).toBe("2000");
  });

  it("rejects a card paying itself", async () => {
    const response = await postPayment({ fromAccountId: card.id, toAccountId: card.id });

    expect(response.status).toBe(400);
    expect((await cardPosition(card.id)).outstanding).toBe("15000");
  });

  it("rejects an archived source", async () => {
    await archiveAccountById(bank.id);

    const response = await postPayment();
    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });

  it("rejects an archived card", async () => {
    await archiveAccountById(card.id);

    const response = await postPayment();
    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });

  it("rejects a card belonging to another user", async () => {
    const other = await createTestUser({ email: "other@example.com" });
    const theirCard = await seedCreditCard(other.id, { name: "Their card" });

    const response = await postPayment({ toAccountId: theirCard.id });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });
});

describe("overpayment", () => {
  it("is allowed and leaves the card in credit", async () => {
    // 20,000 against a 15,000 balance.
    const response = await postPayment({ amount: "20000" });

    expect(response.status).toBe(201);

    const position = await cardPosition(card.id);
    // A negative outstanding balance means the card holds a credit.
    expect(position.outstanding).toBe("-5000");
    expect(position.availableCredit).toBe("155000");
    expect(position.overLimit).toBe(false);

    expect(await balanceOf(bank.id)).toBe("30000");
  });

  it("reports the credit balance on the payment detail", async () => {
    const created = expectData(await postPayment({ amount: "20000" }));

    const detail = expectData(
      await invokeRoute<CardPaymentDetailView>(
        getPayment,
        `/api/credit-card-payments/${created.id}`,
        { params: { id: created.id } },
      ),
    );

    expect(detail.cardInCredit).toBe(true);
    expect(detail.outstandingAfter?.amount).toBe("-5000");
  });
});

describe("separation from transfers", () => {
  it("a transfer cannot target a credit card", async () => {
    const response = await invokeRoute(createTransfer, "/api/transfers", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "10000",
        fromAccountId: bank.id,
        toAccountId: card.id,
        date: "2026-08-15T10:00:00.000Z",
      },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_TRANSFER");
    // The card's liability is untouched by the rejected transfer.
    expect((await cardPosition(card.id)).outstanding).toBe("15000");
  });

  it("a card payment id sent to the transfer route reports 404", async () => {
    const created = expectData(await postPayment());

    const response = await invokeRoute(patchTransfer, `/api/transfers/${created.id}`, {
      method: "PATCH",
      body: { amount: "500" },
      params: { id: created.id },
    });

    expect(response.status).toBe(404);
  });

  it("a transfer id sent to the card payment route reports 404", async () => {
    const cash = await seedCashAccount(user.id, { openingBalance: "2000" });
    const transfer = expectData(
      await invokeRoute<TransactionListItem>(createTransfer, "/api/transfers", {
        method: "POST",
        body: {
          clientId: clientId("txn"),
          amount: "1000",
          fromAccountId: bank.id,
          toAccountId: cash.id,
          date: "2026-08-15T10:00:00.000Z",
        },
      }),
    );

    const response = await invokeRoute(patchPayment, `/api/credit-card-payments/${transfer.id}`, {
      method: "PATCH",
      body: { amount: "500" },
      params: { id: transfer.id },
    });

    expect(response.status).toBe(404);
  });

  it("an expense id sent to the card payment route reports 404", async () => {
    const expense = await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id });

    const response = await invokeRoute(
      patchPayment,
      `/api/credit-card-payments/${expense.transaction.id}`,
      { method: "PATCH", body: { amount: "500" }, params: { id: expense.transaction.id } },
    );

    expect(response.status).toBe(404);
  });
});

describe("idempotency", () => {
  it("returns the same payment for a repeated clientId and pays once", async () => {
    const id = clientId("txn");

    const first = expectData(await postPayment({ clientId: id }));
    const second = expectData(await postPayment({ clientId: id }));

    expect(second.id).toBe(first.id);
    expect((await cardPosition(card.id)).outstanding).toBe("5000");
    expect(await balanceOf(bank.id)).toBe("40000");
  });
});

describe("GET /api/credit-card-payments/:id", () => {
  it("returns both account names and the balance still owed", async () => {
    const created = expectData(await postPayment({ amount: "10000" }));

    const detail = expectData(
      await invokeRoute<CardPaymentDetailView>(
        getPayment,
        `/api/credit-card-payments/${created.id}`,
        { params: { id: created.id } },
      ),
    );

    expect(detail.fromAccountName).toBe(bank.name);
    expect(detail.toAccountName).toBe(card.name);
    expect(detail.directionLabel).toBe(`${bank.name} → ${card.name}`);
    expect(detail.outstandingAfter?.amount).toBe("5000");
    expect(detail.cardInCredit).toBe(false);
  });

  it("reports 404 for another user's payment", async () => {
    const created = expectData(await postPayment());

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const response = await invokeRoute(getPayment, `/api/credit-card-payments/${created.id}`, {
      params: { id: created.id },
    });

    expect(response.status).toBe(404);
  });
});

describe("PATCH /api/credit-card-payments/:id", () => {
  it("adjusts the card and the source when the amount changes", async () => {
    const created = expectData(await postPayment({ amount: "10000" }));

    const response = await invokeRoute<TransactionListItem>(
      patchPayment,
      `/api/credit-card-payments/${created.id}`,
      { method: "PATCH", body: { amount: "3000" }, params: { id: created.id } },
    );

    expect(response.status).toBe(200);
    expect((await cardPosition(card.id)).outstanding).toBe("12000");
    expect(await balanceOf(bank.id)).toBe("47000");
  });

  it("moves the payment to a different source account", async () => {
    const cash = await seedCashAccount(user.id, { openingBalance: "20000" });
    const created = expectData(await postPayment({ amount: "10000" }));

    await invokeRoute(patchPayment, `/api/credit-card-payments/${created.id}`, {
      method: "PATCH",
      body: { fromAccountId: cash.id },
      params: { id: created.id },
    });

    expect(await balanceOf(bank.id)).toBe("50000");
    expect(await balanceOf(cash.id)).toBe("10000");
    expect((await cardPosition(card.id)).outstanding).toBe("5000");
  });

  it("rejects an edit that makes the destination a bank account", async () => {
    const other = await seedBankAccount(user.id, { name: "ICICI", openingBalance: "1000" });
    const created = expectData(await postPayment());

    const response = await invokeRoute(patchPayment, `/api/credit-card-payments/${created.id}`, {
      method: "PATCH",
      body: { toAccountId: other.id },
      params: { id: created.id },
    });

    expect(response.status).toBe(400);
    // Unchanged.
    expect((await cardPosition(card.id)).outstanding).toBe("5000");
  });

  it("rejects an edit that makes the source another card", async () => {
    const otherCard = await seedCreditCard(user.id, { name: "Amex" });
    const created = expectData(await postPayment());

    const response = await invokeRoute(patchPayment, `/api/credit-card-payments/${created.id}`, {
      method: "PATCH",
      body: { fromAccountId: otherCard.id },
      params: { id: created.id },
    });

    expect(response.status).toBe(400);
  });

  it("reports 404 for another user's payment", async () => {
    const created = expectData(await postPayment());

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const response = await invokeRoute(patchPayment, `/api/credit-card-payments/${created.id}`, {
      method: "PATCH",
      body: { amount: "1" },
      params: { id: created.id },
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/credit-card-payments/:id", () => {
  it("puts the debt back on the card and restores the source balance", async () => {
    const created = expectData(await postPayment({ amount: "10000" }));
    expect((await cardPosition(card.id)).outstanding).toBe("5000");

    const response = await invokeRoute(deletePayment, `/api/credit-card-payments/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    expect(response.status).toBe(204);
    expect((await cardPosition(card.id)).outstanding).toBe("15000");
    expect((await cardPosition(card.id)).availableCredit).toBe("135000");
    expect(await balanceOf(bank.id)).toBe("50000");
  });

  it("soft-deletes rather than removing the record", async () => {
    const created = expectData(await postPayment());

    await invokeRoute(deletePayment, `/api/credit-card-payments/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    expect(await transactions.findById(user.id, created.id)).toBeNull();

    const onDisk = await transactions.findByClientId(user.id, created.clientId);
    expect(onDisk).not.toBeNull();
    expect(onDisk?.deletedAt).not.toBeNull();
  });

  it("reports 404 for another user's payment", async () => {
    const created = expectData(await postPayment());

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const response = await invokeRoute(deletePayment, `/api/credit-card-payments/${created.id}`, {
      method: "DELETE",
      params: { id: created.id },
    });

    expect(response.status).toBe(404);
  });
});

describe("GET /api/credit-card-payments", () => {
  it("returns card payments only", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id });
    await postPayment({ amount: "1000" });

    const view = expectData(
      await invokeRoute<PaymentListResponse>(listPayments, "/api/credit-card-payments"),
    );

    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.type).toBe("credit_card_payment");
  });

  it("filters to one card's payment history", async () => {
    const otherCard = await seedCreditCard(user.id, { name: "Amex", openingBalance: "3000" });
    await postPayment({ amount: "1000" });
    await postPayment({ toAccountId: otherCard.id, amount: "500" });

    const view = expectData(
      await invokeRoute<PaymentListResponse>(listPayments, "/api/credit-card-payments", {
        searchParams: { accountId: otherCard.id },
      }),
    );

    expect(view.items).toHaveLength(1);
    expect(view.items[0]?.toAccountId).toBe(otherCard.id);
  });

  it("includes both account names on every row", async () => {
    await postPayment();

    const view = expectData(
      await invokeRoute<PaymentListResponse>(listPayments, "/api/credit-card-payments"),
    );

    expect(view.accountNames[bank.id]).toBe(bank.name);
    expect(view.accountNames[card.id]).toBe(card.name);
  });

  it("excludes another user's payments", async () => {
    await postPayment();

    const other = await createTestUser({ email: "other@example.com" });
    setCurrentTestUser(other);

    const view = expectData(
      await invokeRoute<PaymentListResponse>(listPayments, "/api/credit-card-payments"),
    );
    expect(view.items).toHaveLength(0);
  });
});

describe("card position after mixed activity", () => {
  it("tracks spending, a cash advance, and a payment together", async () => {
    // Opening outstanding 15,000.
    await seedPersonalExpense(user.id, { amount: "2000", accountId: card.id });

    const cash = await seedCashAccount(user.id, { openingBalance: "0" });
    // A cash advance off the card is a transfer, and raises the liability.
    await invokeRoute(createTransfer, "/api/transfers", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "3000",
        fromAccountId: card.id,
        toAccountId: cash.id,
        date: "2026-08-15T10:00:00.000Z",
      },
    });

    await postPayment({ amount: "5000" });

    // 15,000 + 2,000 + 3,000 - 5,000
    const position = await cardPosition(card.id);
    expect(position.outstanding).toBe("15000");
    expect(position.availableCredit).toBe("135000");

    // Only the 2,000 purchase was spending.
    expect(await totalSpending(user.id)).toBe("2000.00");
  });
});
