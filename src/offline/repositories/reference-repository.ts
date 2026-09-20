import type { Account } from "@/domain/accounts/entities";
import type { Category } from "@/domain/categories/entities";
import type { Person } from "@/domain/people/entities";
import { localDb } from "../db/client";
import {
  fromLocalAccount,
  fromLocalCategory,
  fromLocalPerson,
  toLocalAccount,
  toLocalCategory,
  toLocalPerson,
} from "../db/record-mapping";
import type { LocalAccount, LocalCategory, LocalPerson } from "../db/schema";
import type { LocalListOptions } from "./types";

/**
 * Local store for the reference data every form needs: accounts, people, categories.
 *
 * These are cached rather than created offline. All three are managed on screens the
 * user reaches deliberately and rarely, whereas recording an expense happens in a
 * queue at a till - so the offline effort goes into transactions, and reference data
 * only has to be *readable* offline for the pickers to work
 * (docs/08-OFFLINE-SYNC.md section 31).
 *
 * Repositories hold no business rules. Deciding whether an account may be used is
 * `domain/accounts/rules.ts`, on both client and server
 * (docs/08-OFFLINE-SYNC.md section 46).
 */

function visible<T extends { deletedAt: Date | null; archivedAt?: Date | null }>(
  records: readonly T[],
  options: LocalListOptions,
): T[] {
  return records.filter((record) => {
    if (!options.includeDeleted && record.deletedAt !== null) return false;
    if (!options.includeArchived && record.archivedAt != null) return false;
    return true;
  });
}

/** Replaces the cached set for a user, in one transaction. */
async function replaceAll<T extends { clientId: string; userId: string }>(
  table: {
    where: (index: string) => { equals: (value: string) => { delete: () => Promise<number> } };
    bulkPut: (records: T[]) => Promise<unknown>;
  },
  userId: string,
  records: T[],
): Promise<void> {
  await table.where("userId").equals(userId).delete();
  await table.bulkPut(records);
}

export const localAccountRepository = {
  async replaceAll(userId: string, accounts: readonly Account[]): Promise<void> {
    const db = localDb();
    // One transaction so a partial write cannot leave the picker showing half the
    // user's accounts.
    await db.transaction("rw", db.accounts, async () => {
      await replaceAll(db.accounts, userId, accounts.map(toLocalAccount));
    });
  },

  async list(userId: string, options: LocalListOptions = {}): Promise<Account[]> {
    const records = await localDb().accounts.where("userId").equals(userId).toArray();

    return visible(records, options)
      .map(fromLocalAccount)
      .filter((account): account is Account => account !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async findByServerId(userId: string, accountId: string): Promise<Account | null> {
    const record = await localDb().accounts.where("serverId").equals(accountId).first();
    if (!record || record.userId !== userId) return null;
    return fromLocalAccount(record);
  },

  async raw(userId: string): Promise<LocalAccount[]> {
    return localDb().accounts.where("userId").equals(userId).toArray();
  },
};

export const localPersonRepository = {
  async replaceAll(userId: string, people: readonly Person[]): Promise<void> {
    const db = localDb();
    await db.transaction("rw", db.people, async () => {
      await replaceAll(db.people, userId, people.map(toLocalPerson));
    });
  },

  async list(userId: string, options: LocalListOptions = {}): Promise<Person[]> {
    const records = await localDb().people.where("userId").equals(userId).toArray();

    return visible(records, options)
      .map(fromLocalPerson)
      .filter((person): person is Person => person !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async findByServerId(userId: string, personId: string): Promise<Person | null> {
    const record = await localDb().people.where("serverId").equals(personId).first();
    if (!record || record.userId !== userId) return null;
    return fromLocalPerson(record);
  },

  async raw(userId: string): Promise<LocalPerson[]> {
    return localDb().people.where("userId").equals(userId).toArray();
  },
};

export const localCategoryRepository = {
  async replaceAll(userId: string, categories: readonly Category[]): Promise<void> {
    const db = localDb();
    await db.transaction("rw", db.categories, async () => {
      await replaceAll(db.categories, userId, categories.map(toLocalCategory));
    });
  },

  async list(userId: string, options: LocalListOptions = {}): Promise<Category[]> {
    const records = await localDb().categories.where("userId").equals(userId).toArray();

    return visible(records, options)
      .map(fromLocalCategory)
      .filter((category): category is Category => category !== null)
      .sort((a, b) => a.name.localeCompare(b.name));
  },

  async raw(userId: string): Promise<LocalCategory[]> {
    return localDb().categories.where("userId").equals(userId).toArray();
  },
};
