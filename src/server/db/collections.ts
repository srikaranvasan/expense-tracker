import type { Collection, Document } from "mongodb";
import { COLLECTIONS } from "@/config/constants";
import { getDb } from "./client";
import type { AccountDocument } from "./models/account";
import type { CategoryDocument } from "./models/category";
import type { PersonDocument } from "./models/person";
import type { SettlementAllocationDocument, SettlementDocument } from "./models/settlement";
import type { SyncOperationDocument } from "./models/sync-operation";
import type { ExpenseSplitDocument, TransactionDocument } from "./models/transaction";
import type { UserDocument } from "./models/user";

/**
 * Typed collection accessors.
 *
 * Repositories go through these so a collection is never opened with the wrong
 * document type or a mistyped name.
 */

async function collection<T extends Document>(name: string): Promise<Collection<T>> {
  const db = await getDb();
  return db.collection<T>(name);
}

export const collections = {
  users: () => collection<UserDocument>(COLLECTIONS.users),
  accounts: () => collection<AccountDocument>(COLLECTIONS.accounts),
  people: () => collection<PersonDocument>(COLLECTIONS.people),
  categories: () => collection<CategoryDocument>(COLLECTIONS.categories),
  transactions: () => collection<TransactionDocument>(COLLECTIONS.transactions),
  expenseSplits: () => collection<ExpenseSplitDocument>(COLLECTIONS.expenseSplits),
  settlements: () => collection<SettlementDocument>(COLLECTIONS.settlements),
  settlementAllocations: () =>
    collection<SettlementAllocationDocument>(COLLECTIONS.settlementAllocations),
  syncOperations: () => collection<SyncOperationDocument>(COLLECTIONS.syncOperations),
} as const;
