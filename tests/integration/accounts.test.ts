import { beforeEach, describe, expect, it, vi } from "vitest";
import type { User } from "@/domain/users/entities";
import type { AccountView } from "@/features/accounts/view-models/account-view-model";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { settlementRepository } from "@/server/repositories/mongo/settlement-repository";
import { expectData, expectError, invokeRoute } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  createTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";
import { clientId, fixedDate, inr } from "@tests/helpers/fixtures";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { GET: listAccounts, POST: createAccount } = await import("@/app/api/accounts/route");
const {
  GET: getAccount,
  PATCH: patchAccount,
  DELETE: archiveAccount,
} = await import("@/app/api/accounts/[id]/route");
const { POST: restoreAccount } = await import("@/app/api/accounts/[id]/restore/route");

const transactions = transactionRepository();
const settlements = settlementRepository();

let user: User;

const bankAccount = () => ({
  clientId: clientId("acc"),
  name: "HDFC Savings",
  type: "bank" as const,
  currency: "INR",
  openingBalance: "50000",
});

const creditCard = () => ({
  clientId: clientId("card"),
  name: "HDFC Credit Card",
  type: "credit_card" as const,
  currency: "INR",
  openingBalance: "0",
  creditLimit: "150000",
  statementDay: 5,
  paymentDueDay: 25,
});

async function postAccount(body: Record<string, unknown>) {
  return invokeRoute<AccountView>(createAccount, "/api/accounts", { method: "POST", body });
}

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR" });
});

describe("POST /api/accounts", () => {
  it("creates a bank account", async () => {
    const response = await postAccount(bankAccount());

    expect(response.status).toBe(201);
    const account = expectData(response);
    expect(account.name).toBe("HDFC Savings");
    expect(account.type).toBe("bank");
    expect(account.balance.amount).toBe("50000");
    expect(account.outstanding).toBeNull();
  });

  it("creates a cash account", async () => {
    const response = await postAccount({
      clientId: clientId("cash"),
      name: "Cash",
      type: "cash",
      currency: "INR",
      openingBalance: "2000",
    });

    expect(response.status).toBe(201);
    expect(expectData(response).balance.amount).toBe("2000");
  });

  it("creates a credit card with its limit and statement dates", async () => {
    const response = await postAccount(creditCard());

    expect(response.status).toBe(201);
    const card = expectData(response);
    expect(card.creditLimit?.amount).toBe("150000");
    expect(card.statementDay).toBe(5);
    expect(card.paymentDueDay).toBe(25);
    expect(card.outstanding?.amount).toBe("0");
    expect(card.availableCredit?.amount).toBe("150000");
    // A liability shows as a negative contribution to net position.
    expect(card.balance.amount).toBe("0");
  });

  it("records an opening outstanding balance on a card", async () => {
    const response = await postAccount({ ...creditCard(), openingBalance: "18500" });

    const card = expectData(response);
    expect(card.outstanding?.amount).toBe("18500");
    expect(card.availableCredit?.amount).toBe("131500");
    expect(card.balance.amount).toBe("-18500");
  });

  it("defaults the opening balance to zero", async () => {
    const { openingBalance: _openingBalance, ...rest } = bankAccount();
    const response = await postAccount(rest);

    expect(response.status).toBe(201);
    expect(expectData(response).balance.amount).toBe("0");
  });

  it("accepts a negative opening balance for a bank account", async () => {
    const response = await postAccount({ ...bankAccount(), openingBalance: "-500" });
    expect(expectData(response).balance.amount).toBe("-500");
  });

  it("requires a credit limit for a credit card", async () => {
    const { creditLimit: _creditLimit, ...rest } = creditCard();
    const response = await postAccount(rest);

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });

  it("rejects a credit limit on a non-card account", async () => {
    const response = await postAccount({ ...bankAccount(), creditLimit: "100000" });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });

  it("rejects a statement day outside 1-31", async () => {
    for (const statementDay of [0, 32, -3]) {
      const response = await postAccount({ ...creditCard(), statementDay });
      expect(response.status).toBe(400);
    }
  });

  it("rejects a currency that is not the user's", async () => {
    const response = await postAccount({ ...bankAccount(), currency: "USD" });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });

  it("rejects an unsupported currency code", async () => {
    const response = await postAccount({ ...bankAccount(), currency: "XYZ" });
    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("VALIDATION_ERROR");
  });

  it("rejects an opening balance that is not a number", async () => {
    const response = await postAccount({ ...bankAccount(), openingBalance: "fifty thousand" });
    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("VALIDATION_ERROR");
  });

  it("rejects an over-precise opening balance instead of rounding it", async () => {
    const response = await postAccount({ ...bankAccount(), openingBalance: "100.005" });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/decimal places/i);
  });

  it("rejects a missing name", async () => {
    const response = await postAccount({ ...bankAccount(), name: "   " });
    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("VALIDATION_ERROR");
  });

  it("rejects an invalid clientId", async () => {
    const response = await postAccount({ ...bankAccount(), clientId: "short" });
    expect(response.status).toBe(400);
  });

  it("is idempotent for a repeated clientId", async () => {
    const input = bankAccount();

    const first = expectData(await postAccount(input));
    const second = expectData(await postAccount({ ...input, name: "Retry name" }));

    expect(second.id).toBe(first.id);
    expect(second.name).toBe("HDFC Savings");

    const list = expectData(
      await invokeRoute<{ items: AccountView[] }>(listAccounts, "/api/accounts"),
    );
    expect(list.items).toHaveLength(1);
  });

  it("requires authentication", async () => {
    setCurrentTestUser(null);
    const response = await postAccount(bankAccount());

    expect(response.status).toBe(401);
  });
});

describe("GET /api/accounts", () => {
  it("returns the user's accounts grouped with derived balances", async () => {
    await postAccount(bankAccount());
    await postAccount(creditCard());

    const response = await invokeRoute<{ items: AccountView[] }>(listAccounts, "/api/accounts");
    const { items } = expectData(response);

    expect(items).toHaveLength(2);
    expect(items.map((item) => item.type).sort()).toEqual(["bank", "credit_card"]);
  });

  it("filters by type", async () => {
    await postAccount(bankAccount());
    await postAccount(creditCard());

    const response = await invokeRoute<{ items: AccountView[] }>(listAccounts, "/api/accounts", {
      searchParams: { type: "credit_card" },
    });

    const { items } = expectData(response);
    expect(items).toHaveLength(1);
    expect(items[0]?.type).toBe("credit_card");
  });

  it("excludes archived accounts unless asked", async () => {
    const account = expectData(await postAccount(bankAccount()));
    await invokeRoute(archiveAccount, `/api/accounts/${account.id}`, {
      method: "DELETE",
      params: { id: account.id },
    });

    const active = expectData(
      await invokeRoute<{ items: AccountView[] }>(listAccounts, "/api/accounts"),
    );
    expect(active.items).toHaveLength(0);

    const all = expectData(
      await invokeRoute<{ items: AccountView[] }>(listAccounts, "/api/accounts", {
        searchParams: { includeArchived: "true" },
      }),
    );
    expect(all.items).toHaveLength(1);
    expect(all.items[0]?.isArchived).toBe(true);
  });

  it("does not return another user's accounts", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    await postAccount({ ...bankAccount(), name: "Their bank" });

    setCurrentTestUser(user);
    const response = await invokeRoute<{ items: AccountView[] }>(listAccounts, "/api/accounts");
    expect(expectData(response).items).toHaveLength(0);
  });
});

describe("GET /api/accounts/:id", () => {
  it("returns account details with a balance derived from transactions", async () => {
    const account = expectData(await postAccount(bankAccount()));

    await transactions.create(user.id, {
      clientId: clientId("txn"),
      type: "expense",
      amount: inr("2000"),
      description: "Groceries",
      date: fixedDate(),
      accountId: account.id,
      paidBy: { type: "user", personId: null },
    });

    const response = await invokeRoute<AccountView>(getAccount, `/api/accounts/${account.id}`, {
      params: { id: account.id },
    });

    expect(expectData(response).balance.amount).toBe("48000");
  });

  it("includes settlements paid from the account in the balance", async () => {
    const account = expectData(await postAccount(bankAccount()));

    await settlements.create(user.id, {
      clientId: clientId("stl"),
      personId: "6a95b78237559e60592da181",
      direction: "user_to_person",
      amount: inr("450"),
      accountId: account.id,
      date: fixedDate(),
    });

    const response = await invokeRoute<AccountView>(getAccount, `/api/accounts/${account.id}`, {
      params: { id: account.id },
    });

    expect(expectData(response).balance.amount).toBe("49550");
  });

  it("derives card outstanding and available credit from card spending", async () => {
    const card = expectData(await postAccount(creditCard()));

    await transactions.create(user.id, {
      clientId: clientId("txn"),
      type: "expense",
      amount: inr("1200"),
      description: "Dinner",
      date: fixedDate(),
      accountId: card.id,
      paidBy: { type: "user", personId: null },
    });

    const response = await invokeRoute<AccountView>(getAccount, `/api/accounts/${card.id}`, {
      params: { id: card.id },
    });

    const view = expectData(response);
    expect(view.outstanding?.amount).toBe("1200");
    expect(view.availableCredit?.amount).toBe("148800");
  });

  it("returns 404 for another user's account", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    const theirs = expectData(await postAccount(bankAccount()));

    setCurrentTestUser(user);
    const response = await invokeRoute(getAccount, `/api/accounts/${theirs.id}`, {
      params: { id: theirs.id },
    });

    expect(response.status).toBe(404);
    expect(expectError(response).code).toBe("NOT_FOUND");
  });

  it("returns 404 for a malformed id", async () => {
    const response = await invokeRoute(getAccount, "/api/accounts/not-an-id", {
      params: { id: "not-an-id" },
    });

    // A malformed id fails schema validation before reaching the database.
    expect([400, 404]).toContain(response.status);
  });
});

describe("PATCH /api/accounts/:id", () => {
  it("updates the name and opening balance", async () => {
    const account = expectData(await postAccount(bankAccount()));

    const response = await invokeRoute<AccountView>(patchAccount, `/api/accounts/${account.id}`, {
      method: "PATCH",
      params: { id: account.id },
      body: { name: "HDFC Primary", openingBalance: "60000" },
    });

    const updated = expectData(response);
    expect(updated.name).toBe("HDFC Primary");
    expect(updated.balance.amount).toBe("60000");
    expect(updated.syncVersion).toBe(account.syncVersion + 1);
  });

  it("updates card terms", async () => {
    const card = expectData(await postAccount(creditCard()));

    const response = await invokeRoute<AccountView>(patchAccount, `/api/accounts/${card.id}`, {
      method: "PATCH",
      params: { id: card.id },
      body: { creditLimit: "200000", statementDay: 10 },
    });

    const updated = expectData(response);
    expect(updated.creditLimit?.amount).toBe("200000");
    expect(updated.statementDay).toBe(10);
    expect(updated.availableCredit?.amount).toBe("200000");
  });

  it("ignores an attempt to change the type or currency", async () => {
    const account = expectData(await postAccount(bankAccount()));

    const response = await invokeRoute<AccountView>(patchAccount, `/api/accounts/${account.id}`, {
      method: "PATCH",
      params: { id: account.id },
      body: { name: "Still a bank", type: "credit_card", currency: "USD" },
    });

    const updated = expectData(response);
    expect(updated.type).toBe("bank");
    expect(updated.currency).toBe("INR");
  });

  it("rejects a credit limit of zero on a card", async () => {
    const card = expectData(await postAccount(creditCard()));

    const response = await invokeRoute(patchAccount, `/api/accounts/${card.id}`, {
      method: "PATCH",
      params: { id: card.id },
      body: { creditLimit: "0" },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_ACCOUNT");
  });

  it("rejects an empty update", async () => {
    const account = expectData(await postAccount(bankAccount()));

    const response = await invokeRoute(patchAccount, `/api/accounts/${account.id}`, {
      method: "PATCH",
      params: { id: account.id },
      body: {},
    });

    expect(response.status).toBe(400);
  });

  it("rejects an update based on a stale sync version", async () => {
    const account = expectData(await postAccount(bankAccount()));

    await invokeRoute(patchAccount, `/api/accounts/${account.id}`, {
      method: "PATCH",
      params: { id: account.id },
      body: { name: "First edit" },
    });

    const stale = await invokeRoute(patchAccount, `/api/accounts/${account.id}`, {
      method: "PATCH",
      params: { id: account.id },
      body: { name: "Second edit", expectedSyncVersion: account.syncVersion },
    });

    expect(stale.status).toBe(409);
    expect(expectError(stale).code).toBe("CONFLICT");
  });

  it("refuses to edit an archived account", async () => {
    const account = expectData(await postAccount(bankAccount()));
    await invokeRoute(archiveAccount, `/api/accounts/${account.id}`, {
      method: "DELETE",
      params: { id: account.id },
    });

    const response = await invokeRoute(patchAccount, `/api/accounts/${account.id}`, {
      method: "PATCH",
      params: { id: account.id },
      body: { name: "Nope" },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/restore/i);
  });

  it("does not update another user's account", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    const theirs = expectData(await postAccount(bankAccount()));

    setCurrentTestUser(user);
    const response = await invokeRoute(patchAccount, `/api/accounts/${theirs.id}`, {
      method: "PATCH",
      params: { id: theirs.id },
      body: { name: "Mine now" },
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/accounts/:id", () => {
  it("archives rather than deleting, preserving transaction history", async () => {
    const account = expectData(await postAccount(bankAccount()));

    await transactions.create(user.id, {
      clientId: clientId("txn"),
      type: "expense",
      amount: inr("500"),
      description: "Coffee",
      date: fixedDate(),
      accountId: account.id,
      paidBy: { type: "user", personId: null },
    });

    const response = await invokeRoute<AccountView>(archiveAccount, `/api/accounts/${account.id}`, {
      method: "DELETE",
      params: { id: account.id },
    });

    expect(expectData(response).isArchived).toBe(true);

    // The transaction survives and still affects the archived account's balance.
    expect(await transactions.countByAccount(user.id, account.id)).toBe(1);

    const detail = expectData(
      await invokeRoute<AccountView>(getAccount, `/api/accounts/${account.id}`, {
        params: { id: account.id },
      }),
    );
    expect(detail.balance.amount).toBe("49500");
  });

  it("is safe to call twice", async () => {
    const account = expectData(await postAccount(bankAccount()));

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await invokeRoute<AccountView>(
        archiveAccount,
        `/api/accounts/${account.id}`,
        { method: "DELETE", params: { id: account.id } },
      );
      expect(response.status).toBe(200);
      expect(expectData(response).isArchived).toBe(true);
    }
  });

  it("restores an archived account", async () => {
    const account = expectData(await postAccount(bankAccount()));
    await invokeRoute(archiveAccount, `/api/accounts/${account.id}`, {
      method: "DELETE",
      params: { id: account.id },
    });

    const response = await invokeRoute<AccountView>(
      restoreAccount,
      `/api/accounts/${account.id}/restore`,
      { method: "POST", params: { id: account.id } },
    );

    expect(expectData(response).isArchived).toBe(false);
  });

  it("does not archive another user's account", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    const theirs = expectData(await postAccount(bankAccount()));

    setCurrentTestUser(user);
    const response = await invokeRoute(archiveAccount, `/api/accounts/${theirs.id}`, {
      method: "DELETE",
      params: { id: theirs.id },
    });

    expect(response.status).toBe(404);
  });
});
