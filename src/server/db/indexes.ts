import type { Db, IndexDescription } from "mongodb";
import { COLLECTIONS } from "@/config/constants";
import { logger } from "@/lib/logging/logger";
import { getDb } from "./client";

/**
 * Index definitions, derived from the query patterns in
 * docs/09-DATABASE-SCHEMA.md section 28.
 *
 * Unique indexes on `(userId, clientId)` are load-bearing: they are the last line
 * of defence against a retried offline operation creating a duplicate financial
 * record.
 */
const INDEXES: Record<string, IndexDescription[]> = {
  [COLLECTIONS.users]: [{ key: { email: 1 }, name: "email_unique", unique: true }],

  [COLLECTIONS.accounts]: [
    { key: { userId: 1, archivedAt: 1 }, name: "userId_archivedAt" },
    { key: { userId: 1, type: 1 }, name: "userId_type" },
    { key: { userId: 1, clientId: 1 }, name: "userId_clientId_unique", unique: true },
    { key: { userId: 1, updatedAt: 1, _id: 1 }, name: "userId_updatedAt_id" },
  ],

  [COLLECTIONS.people]: [
    { key: { userId: 1, archivedAt: 1 }, name: "userId_archivedAt" },
    { key: { userId: 1, clientId: 1 }, name: "userId_clientId_unique", unique: true },
    { key: { userId: 1, updatedAt: 1, _id: 1 }, name: "userId_updatedAt_id" },
  ],

  [COLLECTIONS.categories]: [
    { key: { userId: 1, archivedAt: 1 }, name: "userId_archivedAt" },
    { key: { userId: 1, clientId: 1 }, name: "userId_clientId_unique", unique: true },
    { key: { userId: 1, updatedAt: 1, _id: 1 }, name: "userId_updatedAt_id" },
  ],

  [COLLECTIONS.transactions]: [
    { key: { userId: 1, date: -1, _id: -1 }, name: "userId_date_id" },
    { key: { userId: 1, accountId: 1, date: -1 }, name: "userId_accountId_date" },
    { key: { userId: 1, fromAccountId: 1, date: -1 }, name: "userId_fromAccountId_date" },
    { key: { userId: 1, toAccountId: 1, date: -1 }, name: "userId_toAccountId_date" },
    { key: { userId: 1, categoryId: 1, date: -1 }, name: "userId_categoryId_date" },
    { key: { userId: 1, type: 1, date: -1 }, name: "userId_type_date" },
    { key: { userId: 1, deletedAt: 1 }, name: "userId_deletedAt" },
    { key: { userId: 1, clientId: 1 }, name: "userId_clientId_unique", unique: true },
    { key: { userId: 1, updatedAt: 1, _id: 1 }, name: "userId_updatedAt_id" },
    // Description search for the transaction list.
    { key: { userId: 1, description: "text" }, name: "userId_description_text" },
  ],

  [COLLECTIONS.expenseSplits]: [
    { key: { userId: 1, transactionId: 1 }, name: "userId_transactionId" },
    { key: { userId: 1, personId: 1, deletedAt: 1 }, name: "userId_personId_deletedAt" },
    { key: { userId: 1, clientId: 1 }, name: "userId_clientId_unique", unique: true },
    { key: { userId: 1, updatedAt: 1, _id: 1 }, name: "userId_updatedAt_id" },
  ],

  [COLLECTIONS.settlements]: [
    { key: { userId: 1, personId: 1, date: -1 }, name: "userId_personId_date" },
    { key: { userId: 1, date: -1, _id: -1 }, name: "userId_date_id" },
    { key: { userId: 1, deletedAt: 1 }, name: "userId_deletedAt" },
    { key: { userId: 1, clientId: 1 }, name: "userId_clientId_unique", unique: true },
    { key: { userId: 1, updatedAt: 1, _id: 1 }, name: "userId_updatedAt_id" },
  ],

  [COLLECTIONS.settlementAllocations]: [
    { key: { userId: 1, settlementId: 1 }, name: "userId_settlementId" },
    {
      key: { userId: 1, expenseSplitId: 1, deletedAt: 1 },
      name: "userId_expenseSplitId_deletedAt",
    },
    { key: { userId: 1, clientId: 1 }, name: "userId_clientId_unique", unique: true },
    { key: { userId: 1, updatedAt: 1, _id: 1 }, name: "userId_updatedAt_id" },
  ],

  [COLLECTIONS.syncOperations]: [
    { key: { userId: 1, operationId: 1 }, name: "userId_operationId_unique", unique: true },
    { key: { userId: 1, status: 1, createdAt: -1 }, name: "userId_status_createdAt" },
    // Processed operations are only needed for idempotency replay windows.
    { key: { completedAt: 1 }, name: "completedAt_ttl", expireAfterSeconds: 60 * 60 * 24 * 30 },
  ],
};

export async function createIndexes(db?: Db): Promise<void> {
  const database = db ?? (await getDb());

  for (const [collectionName, indexes] of Object.entries(INDEXES)) {
    await database.createCollection(collectionName).catch((error: unknown) => {
      // Already existing collections are fine; anything else is a real failure.
      const code = (error as { codeName?: string }).codeName;
      if (code !== "NamespaceExists") throw error;
    });

    await database.collection(collectionName).createIndexes(indexes);
  }

  logger.info("database indexes ensured", {
    collections: Object.keys(INDEXES).length,
  });
}

export { INDEXES };
