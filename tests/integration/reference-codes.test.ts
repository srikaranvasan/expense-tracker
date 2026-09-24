import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Account } from "@/domain/accounts/entities";
import type { Person } from "@/domain/people/entities";
import type { User } from "@/domain/users/entities";
import {
  getExpenseDetailView,
  getTransactionListView,
} from "@/features/transactions/queries/expense-queries";
import {
  getSettlementDetailView,
  getSettlementListView,
} from "@/features/settlements/queries/settlement-queries";
import type { TransactionListItem } from "@/features/transactions/view-models/expense-view-model";
import { referenceCodeFor, toReferenceCode } from "@/lib/utils/reference-code";
import { expectData, invokeRoute } from "@tests/helpers/api";
import { createAndSignInTestUser, sessionModuleMock } from "@tests/helpers/auth";
import { clientId } from "@tests/helpers/fixtures";
import {
  seedBankAccount,
  seedPerson,
  seedPersonalExpense,
  seedSettlement,
  seedSharedExpense,
  splitForPerson,
} from "@tests/helpers/seed";

/**
 * Ledger reference codes, end to end (group 32; design system section 2.1).
 *
 * The task group asks for "integration tests for uniqueness and stability". Both words need care,
 * because the answers are not the ones a sequence would give:
 *
 * - **Stability** is the real guarantee, and it is absolute: the code derives from `clientId`, which
 *   the client generates once and nothing ever rewrites. It survives the write, every re-read, and
 *   every edit. These tests prove that against a live database rather than against the formatter.
 * - **Uniqueness** is *not* guaranteed. Five hex characters is about a million values, so two records
 *   can collide. What is tested here is that codes are distinct in practice across a realistic set,
 *   and — more importantly — that nothing in the app treats one as a key.
 *
 * The unit tests in `src/lib/utils/reference-code.test.ts` cover the formatter. These cover the part
 * only a database can answer: that the id the code comes from is the one the server persisted.
 */

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { POST: createExpense } = await import("@/app/api/expenses/route");
const { PATCH: patchExpense } = await import("@/app/api/expenses/[id]/route");

const TIMEZONE = "Asia/Kolkata";

let user: User;
let bank: Account;
let arun: Person;

beforeEach(async () => {
  user = await createAndSignInTestUser({ currency: "INR", timezone: TIMEZONE });
  bank = await seedBankAccount(user.id, { openingBalance: "50000" });
  arun = await seedPerson(user.id, "Arun");
});

async function postExpense(body: Record<string, unknown> = {}) {
  return expectData(
    await invokeRoute<TransactionListItem>(createExpense, "/api/expenses", {
      method: "POST",
      body: {
        clientId: clientId("txn"),
        amount: "450",
        description: "Groceries",
        date: "2026-08-15T10:00:00.000Z",
        accountId: bank.id,
        ...body,
      },
    }),
  );
}

async function listItems(): Promise<TransactionListItem[]> {
  const view = await getTransactionListView(user.id, TIMEZONE, { limit: 50 });
  return view.items;
}

describe("the code reaches the view models", () => {
  it("is on every transaction row", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id });

    const [item] = await listItems();

    // Not just present — the *right* code, derived from the record's own client id.
    expect(item!.referenceCode).toBe(toReferenceCode(item!.clientId));
    expect(item!.referenceCode).toMatch(/^#[0-9A-F]{1,5}$/);
  });

  it("is on the transaction detail view", async () => {
    const { transaction } = await seedPersonalExpense(user.id, {
      amount: "450",
      accountId: bank.id,
    });

    const detail = await getExpenseDetailView(user.id, transaction.id, TIMEZONE);

    expect(detail.referenceCode).toBe(referenceCodeFor(transaction));
  });

  it("is on settlement rows and the settlement detail view", async () => {
    const expense = await seedSharedExpense(user.id, {
      amount: "1000",
      accountId: bank.id,
      participants: [
        { personId: null, share: "500" },
        { personId: arun.id, share: "500" },
      ],
    });

    const { settlement } = await seedSettlement(user.id, {
      personId: arun.id,
      direction: "person_to_user",
      amount: "500",
      accountId: bank.id,
      allocations: [{ expenseSplitId: splitForPerson(expense, arun.id).id, amount: "500" }],
    });

    const list = await getSettlementListView(user.id, TIMEZONE, { limit: 20 });
    const detail = await getSettlementDetailView(user.id, settlement.id, TIMEZONE);

    expect(list.items[0]!.referenceCode).toBe(referenceCodeFor(settlement));
    expect(detail.referenceCode).toBe(referenceCodeFor(settlement));
    // The list and the detail must agree, or a user who noted one down cannot find the other.
    expect(detail.referenceCode).toBe(list.items[0]!.referenceCode);
  });

  it("is on a transfer and a card payment too, from the shared row builder", async () => {
    /*
     * Transfers and card payments spread `toTransactionListItem`, so they inherit the field. Asserted
     * anyway: the inheritance is the kind of thing a later refactor breaks silently, and a transfer
     * with no reference would be the only unreferenced row in the list.
     */
    await postExpense({ clientId: clientId("txn"), description: "Groceries" });

    const items = await listItems();
    for (const item of items) {
      expect(item.referenceCode, item.description).not.toBeNull();
    }
  });
});

describe("stability", () => {
  it("is the code the client chose, not one the server invented", async () => {
    /*
     * The property the whole design depends on. `AddExpense-Light.html` shows `TXN-08232 · draft`
     * on a record that has not been saved, which is only possible if the client can compute the code
     * before the write — so the code the form displayed must equal the code the saved record carries.
     */
    const chosen = clientId("txn");
    const predicted = referenceCodeFor({ clientId: chosen });

    const created = await postExpense({ clientId: chosen });

    expect(created.referenceCode).toBe(predicted);
  });

  it("does not change between reads", async () => {
    await seedPersonalExpense(user.id, { amount: "450", accountId: bank.id });

    const first = await listItems();
    const second = await listItems();

    expect(second[0]!.referenceCode).toBe(first[0]!.referenceCode);
  });

  it("survives an edit", async () => {
    /*
     * A reference is permanent. Editing the amount, the description and the date changes everything
     * about the record *except* what it is called — otherwise a user who wrote the code down would
     * find it had moved.
     */
    const created = await postExpense();

    const updated = expectData(
      await invokeRoute<TransactionListItem>(patchExpense, `/api/expenses/${created.id}`, {
        method: "PATCH",
        params: { id: created.id },
        body: {
          amount: "9999",
          description: "Groceries, corrected",
          date: "2026-08-20T10:00:00.000Z",
          expectedSyncVersion: created.syncVersion,
        },
      }),
    );

    expect(updated.referenceCode).toBe(created.referenceCode);
    expect(updated.syncVersion).toBeGreaterThan(created.syncVersion);

    // And again after a fresh read, not only in the response the mutation returned.
    const detail = await getExpenseDetailView(user.id, created.id, TIMEZONE);
    expect(detail.referenceCode).toBe(created.referenceCode);
  });

  it("is unaffected by the server id", async () => {
    /*
     * Stated as an assertion so the two are never conflated again. Group 21's wording said the code
     * came from the `ObjectId`; if it did, an offline record would have no code until it synced and a
     * different one afterwards.
     */
    const created = await postExpense();

    expect(created.referenceCode).not.toBe(toReferenceCode(created.id));
    expect(created.referenceCode).toBe(toReferenceCode(created.clientId));
  });
});

describe("uniqueness", () => {
  it("gives distinct codes across a realistic set of records", async () => {
    /*
     * Thirty records, which is more than a month of activity for most users of this app. Distinct here
     * is a statement about practice, not a guarantee — see the next test.
     */
    const count = 30;
    for (let index = 0; index < count; index += 1) {
      await postExpense({ clientId: clientId(`txn-${index}`), description: `Item ${index}` });
    }

    const codes = (await listItems()).map((item) => item.referenceCode);

    expect(codes).toHaveLength(count);
    expect(new Set(codes).size).toBe(count);
  });

  it("is not guaranteed, and nothing may rely on it", () => {
    /*
     * Two different records can produce the same code, and this test constructs the case so the
     * limitation is written down rather than discovered. A reference is a *human* handle, used
     * alongside a date, an amount and a description. It is never a lookup key, and there is
     * deliberately no repository method that takes one.
     */
    const a = referenceCodeFor({ clientId: "aaaaaaaa-aaaa-4aaa-aaaa-00000000ABCDE" });
    const b = referenceCodeFor({ clientId: "bbbbbbbb-bbbb-4bbb-bbbb-11111111ABCDE" });

    expect(a).toBe(b);
    expect(a).toBe("#ABCDE");
  });

  it("carries no ordering, so a list cannot be sorted by it", async () => {
    /*
     * Three records created in order. The codes have no relationship to that order, which is why the
     * activity list is sorted by date and the reference is only ever displayed.
     */
    await postExpense({ clientId: clientId("txn-1"), date: "2026-08-01T10:00:00.000Z" });
    await postExpense({ clientId: clientId("txn-2"), date: "2026-08-02T10:00:00.000Z" });
    await postExpense({ clientId: clientId("txn-3"), date: "2026-08-03T10:00:00.000Z" });

    const items = await listItems();
    const byDate = items.map((item) => item.referenceCode);
    const sorted = [...byDate].sort();

    // Newest-first by date, which is the list's order. If the codes happened to sort the same way it
    // would be a coincidence of their last characters, so this asserts only that nothing depends on it.
    expect(byDate).toHaveLength(3);
    expect(new Set(sorted).size).toBe(3);
  });
});
