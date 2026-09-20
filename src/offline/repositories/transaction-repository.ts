import type { ExpenseSplit, Transaction } from "@/domain/transactions/entities";
import { localDb } from "../db/client";
import {
  fromLocalExpenseSplit,
  fromLocalTransaction,
  toLocalExpenseSplit,
  toLocalTransaction,
} from "../db/record-mapping";
import type { LocalExpenseSplit, LocalTransaction } from "../db/schema";
import type { LocalTransactionQuery } from "./types";

/**
 * Local store for transactions and their splits.
 *
 * The two are always written together. A transaction whose splits are missing looks
 * like an expense with no participants, which would corrupt every spending total that
 * reads it - the same invariant the server protects with a MongoDB transaction, held
 * here with an IndexedDB one (docs/08-OFFLINE-SYNC.md section 9).
 *
 * Splits are linked by the transaction's **`clientId`**, not its server id. A record
 * created offline has no server id yet, so a server-id link would break exactly when
 * offline support matters.
 */

export type LocalTransactionWithSplits = {
  transaction: LocalTransaction;
  splits: LocalExpenseSplit[];
};

export const localTransactionRepository = {
  /**
   * Writes a transaction and its splits atomically.
   *
   * Used both when caching server data and when saving an offline create - the caller
   * supplies records that already carry the right `syncStatus`.
   */
  async put(transaction: LocalTransaction, splits: readonly LocalExpenseSplit[]): Promise<void> {
    const db = localDb();

    await db.transaction("rw", db.transactions, db.expenseSplits, async () => {
      await db.transactions.put(transaction);
      // Replaced wholesale, matching how the server rewrites splits on an amount
      // change. Diffing them would be a second way to express the same intent.
      await db.expenseSplits.where("transactionClientId").equals(transaction.clientId).delete();
      if (splits.length > 0) await db.expenseSplits.bulkPut([...splits]);
    });
  },

  /** Caches a page of server data. */
  async putMany(
    entries: ReadonlyArray<{ transaction: Transaction; splits: readonly ExpenseSplit[] }>,
  ): Promise<void> {
    const db = localDb();

    const transactions = entries.map((entry) => toLocalTransaction(entry.transaction));
    const splits = entries.flatMap((entry) =>
      entry.splits.map((split) => toLocalExpenseSplit(split, entry.transaction.clientId)),
    );

    await db.transaction("rw", db.transactions, db.expenseSplits, async () => {
      await db.transactions.bulkPut(transactions);
      for (const transaction of transactions) {
        await db.expenseSplits.where("transactionClientId").equals(transaction.clientId).delete();
      }
      if (splits.length > 0) await db.expenseSplits.bulkPut(splits);
    });
  },

  async findByClientId(
    userId: string,
    clientId: string,
  ): Promise<LocalTransactionWithSplits | null> {
    const db = localDb();
    const transaction = await db.transactions.get(clientId);
    if (!transaction || transaction.userId !== userId) return null;

    const splits = await db.expenseSplits.where("transactionClientId").equals(clientId).toArray();
    return { transaction, splits };
  },

  async findByServerId(
    userId: string,
    serverId: string,
  ): Promise<LocalTransactionWithSplits | null> {
    const db = localDb();
    const transaction = await db.transactions.where("serverId").equals(serverId).first();
    if (!transaction || transaction.userId !== userId) return null;

    const splits = await db.expenseSplits
      .where("transactionClientId")
      .equals(transaction.clientId)
      .toArray();
    return { transaction, splits };
  },

  /**
   * Filtered, newest-first list.
   *
   * Filtering happens in memory after an indexed read on `[userId+date]`. At MVP scale
   * that is far simpler than composing IndexedDB cursors, and the alternative -
   * replicating the server's filter logic in a second query language - is how the two
   * would drift apart.
   */
  async list(
    userId: string,
    query: LocalTransactionQuery = {},
  ): Promise<LocalTransactionWithSplits[]> {
    const db = localDb();
    const records = await db.transactions.where("userId").equals(userId).toArray();

    const splits = await db.expenseSplits.where("userId").equals(userId).toArray();
    const splitsByTransaction = new Map<string, LocalExpenseSplit[]>();
    for (const split of splits) {
      if (!query.includeDeleted && split.deletedAt !== null) continue;
      const bucket = splitsByTransaction.get(split.transactionClientId);
      if (bucket) bucket.push(split);
      else splitsByTransaction.set(split.transactionClientId, [split]);
    }

    const search = query.search?.trim().toLowerCase();

    const filtered = records.filter((record) => {
      if (!query.includeDeleted && record.deletedAt !== null) return false;
      if (query.types && !query.types.includes(record.type)) return false;
      if (query.categoryId && record.categoryId !== query.categoryId) return false;
      if (query.from && record.date < query.from) return false;
      if (query.to && record.date > query.to) return false;
      if (search && !record.description.toLowerCase().includes(search)) return false;

      if (query.accountId) {
        // An account can appear as the plain account, the source, or the destination -
        // matching the server's filter so a transfer is found from either side.
        const matches =
          record.accountId === query.accountId ||
          record.fromAccountId === query.accountId ||
          record.toAccountId === query.accountId;
        if (!matches) return false;
      }

      if (query.personId) {
        const involved =
          record.paidByPersonId === query.personId ||
          (splitsByTransaction.get(record.clientId) ?? []).some(
            (split) => split.personId === query.personId,
          );
        if (!involved) return false;
      }

      return true;
    });

    filtered.sort((a, b) => b.date.getTime() - a.date.getTime());
    const limited = query.limit ? filtered.slice(0, query.limit) : filtered;

    return limited.map((transaction) => ({
      transaction,
      splits: splitsByTransaction.get(transaction.clientId) ?? [],
    }));
  },

  /**
   * Soft-deletes locally.
   *
   * The row stays so the deletion itself can be synced; removing it immediately would
   * leave nothing to tell the server about (docs/08-OFFLINE-SYNC.md section 30).
   */
  async softDelete(userId: string, clientId: string, now: Date = new Date()): Promise<void> {
    const db = localDb();

    await db.transaction("rw", db.transactions, db.expenseSplits, async () => {
      const transaction = await db.transactions.get(clientId);
      if (!transaction || transaction.userId !== userId) return;

      await db.transactions.put({
        ...transaction,
        deletedAt: now,
        localUpdatedAt: now,
        syncStatus: "pending",
      });

      const splits = await db.expenseSplits.where("transactionClientId").equals(clientId).toArray();
      await db.expenseSplits.bulkPut(
        splits.map((split) => ({ ...split, deletedAt: now, localUpdatedAt: now })),
      );
    });
  },

  /**
   * Physically removes a record and its splits.
   *
   * Only for a create that was never sent: an offline create followed by an offline
   * delete has nothing to tell the server, so both the record and its queued operation
   * are discarded (docs/08-OFFLINE-SYNC.md section 33).
   */
  async purgeUnsynced(userId: string, clientId: string): Promise<boolean> {
    const db = localDb();

    return db.transaction("rw", db.transactions, db.expenseSplits, async () => {
      const transaction = await db.transactions.get(clientId);
      if (!transaction || transaction.userId !== userId) return false;
      // Anything the server has seen must be soft-deleted instead, or it would come
      // back on the next pull.
      if (transaction.serverId !== null) return false;

      await db.expenseSplits.where("transactionClientId").equals(clientId).delete();
      await db.transactions.delete(clientId);
      return true;
    });
  },

  /** Domain entities for the transactions the server has accepted. */
  async listSynced(
    userId: string,
    query: LocalTransactionQuery = {},
  ): Promise<Array<{ transaction: Transaction; splits: ExpenseSplit[] }>> {
    const rows = await this.list(userId, query);

    return rows.flatMap((row) => {
      const transaction = fromLocalTransaction(row.transaction);
      if (!transaction) return [];

      return [
        {
          transaction,
          splits: row.splits
            .map(fromLocalExpenseSplit)
            .filter((split): split is ExpenseSplit => split !== null),
        },
      ];
    });
  },

  async clearForUser(userId: string): Promise<void> {
    const db = localDb();
    await db.transaction("rw", db.transactions, db.expenseSplits, async () => {
      await db.transactions.where("userId").equals(userId).delete();
      await db.expenseSplits.where("userId").equals(userId).delete();
    });
  },
};
