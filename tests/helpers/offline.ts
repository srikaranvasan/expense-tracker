import { LocalDatabase, setLocalDbForTesting } from "@/offline/db/client";
import { pendingMeta } from "@/offline/db/record-mapping";
import type {
  LocalExpenseSplit,
  LocalSettlement,
  LocalSettlementAllocation,
  LocalTransaction,
} from "@/offline/db/schema";
import { newClientId } from "@/lib/utils/client-id";
import type { MoneyDto } from "@/types/common";

/**
 * Helpers for the offline test project.
 *
 * Each test gets a uniquely named database so cases cannot see one another's rows -
 * cheaper and more reliable than clearing tables between tests, and it also proves the
 * schema can be created from scratch every time.
 */

let counter = 0;

export async function freshLocalDb(): Promise<LocalDatabase> {
  counter += 1;
  const db = new LocalDatabase(`expense-tracker-test-${counter}`);
  setLocalDbForTesting(db);
  await db.open();
  return db;
}

export async function destroyLocalDb(db: LocalDatabase): Promise<void> {
  const name = db.name;
  db.close();
  setLocalDbForTesting(null);
  await deleteDatabase(name);
}

/** Wraps the callback-based `deleteDatabase` so teardown can await it. */
function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(name);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error ?? new Error(`Could not delete ${name}`));
    // A live connection elsewhere blocks deletion. Names are unique per test, so this
    // means teardown raced a still-open handle; resolving keeps the suite moving.
    request.onblocked = () => resolve();
  });
}

export const inrDto = (amount: string): MoneyDto => ({ amount, currency: "INR" });

export const TEST_USER_ID = "user-1";
export const TEST_DEVICE_ID = "device_test";

export function buildLocalTransaction(overrides: Partial<LocalTransaction> = {}): LocalTransaction {
  return {
    ...pendingMeta({ clientId: newClientId(), userId: TEST_USER_ID }),
    type: "expense",
    amount: inrDto("450"),
    description: "Groceries",
    date: new Date("2026-08-15T10:00:00.000Z"),
    categoryId: null,
    accountId: "account-1",
    fromAccountId: null,
    toAccountId: null,
    paidByType: "user",
    paidByPersonId: null,
    notes: null,
    ...overrides,
  };
}

export function buildLocalSplit(
  transactionClientId: string,
  overrides: Partial<LocalExpenseSplit> = {},
): LocalExpenseSplit {
  return {
    ...pendingMeta({ clientId: newClientId(), userId: TEST_USER_ID }),
    transactionClientId,
    transactionId: null,
    participantType: "user",
    personId: null,
    shareAmount: inrDto("450"),
    ...overrides,
  };
}

export function buildLocalSettlement(overrides: Partial<LocalSettlement> = {}): LocalSettlement {
  return {
    ...pendingMeta({ clientId: newClientId(), userId: TEST_USER_ID }),
    personId: "person-1",
    direction: "person_to_user",
    amount: inrDto("600"),
    accountId: "account-1",
    date: new Date("2026-08-16T10:00:00.000Z"),
    notes: null,
    ...overrides,
  };
}

export function buildLocalAllocation(
  settlementClientId: string,
  overrides: Partial<LocalSettlementAllocation> = {},
): LocalSettlementAllocation {
  return {
    ...pendingMeta({ clientId: newClientId(), userId: TEST_USER_ID }),
    settlementClientId,
    settlementId: null,
    expenseSplitId: "split-1",
    amount: inrDto("600"),
    ...overrides,
  };
}
