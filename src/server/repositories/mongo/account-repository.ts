import type { Filter } from "mongodb";
import type { Account } from "@/domain/accounts/entities";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { collections } from "@/server/db/collections";
import {
  archiveUpdate,
  creationMeta,
  notArchived,
  owned,
  ownedById,
  restoreUpdate,
  updateMeta,
} from "@/server/db/conventions";
import { optionalToDecimal128, toDecimal128 } from "@/server/db/decimal128";
import type { AccountDocument } from "@/server/db/models/account";
import { toAccountEntity } from "@/server/db/models/account";
import { newObjectId, toObjectId } from "@/server/db/object-id";
import { isDuplicateKeyError } from "@/server/errors/api-error";
import type {
  AccountRepository,
  CreateAccountInput,
  ListAccountsQuery,
  UpdateAccountInput,
} from "../interfaces/account-repository";
import type { ChangeFeedQuery, RepositoryContext } from "../interfaces/common";

function sessionOf(context?: RepositoryContext) {
  return context?.session ? { session: context.session } : {};
}

export class MongoAccountRepository implements AccountRepository {
  async findById(
    userId: string,
    accountId: string,
    context?: RepositoryContext,
  ): Promise<Account | null> {
    const accounts = await collections.accounts();
    const document = await accounts.findOne(ownedById(userId, accountId), sessionOf(context));
    return document ? toAccountEntity(document) : null;
  }

  async findByClientId(userId: string, clientId: string): Promise<Account | null> {
    const accounts = await collections.accounts();
    const document = await accounts.findOne({ ...owned(userId), clientId });
    return document ? toAccountEntity(document) : null;
  }

  async findManyByIds(userId: string, accountIds: readonly string[]): Promise<Account[]> {
    if (accountIds.length === 0) return [];

    const accounts = await collections.accounts();
    const documents = await accounts
      .find({ ...owned(userId), _id: { $in: accountIds.map(toObjectId) } })
      .toArray();

    return documents.map(toAccountEntity);
  }

  async list(userId: string, query: ListAccountsQuery = {}): Promise<Account[]> {
    const accounts = await collections.accounts();

    const filter: Filter<AccountDocument> = {
      ...owned(userId),
      ...(query.includeArchived ? {} : notArchived()),
      ...(query.type ? { type: query.type } : {}),
    };

    const documents = await accounts.find(filter).sort({ type: 1, name: 1 }).toArray();
    return documents.map(toAccountEntity);
  }

  async create(
    userId: string,
    input: CreateAccountInput,
    context?: RepositoryContext,
  ): Promise<Account> {
    const accounts = await collections.accounts();
    const isCard = input.type === "credit_card";

    const document: AccountDocument = {
      _id: newObjectId(),
      userId: toObjectId(userId),
      clientId: input.clientId,
      name: input.name,
      type: input.type,
      currency: input.currency,
      openingBalance: toDecimal128(input.openingBalance),
      institutionName: input.institutionName ?? null,
      // Card terms are stored only for cards, so a converted record cannot carry
      // a stale credit limit.
      creditLimit: isCard ? optionalToDecimal128(input.creditLimit ?? null) : null,
      statementDay: isCard ? (input.statementDay ?? null) : null,
      paymentDueDay: isCard ? (input.paymentDueDay ?? null) : null,
      archivedAt: null,
      ...creationMeta(),
    };

    try {
      await accounts.insertOne(document, sessionOf(context));
    } catch (error) {
      // The unique (userId, clientId) index is what actually prevents a retried
      // offline create from inserting twice.
      if (isDuplicateKeyError(error)) {
        const existing = await this.findByClientId(userId, input.clientId);
        if (existing) return existing;
        throw new ConflictError("This account has already been saved.");
      }
      throw error;
    }

    return toAccountEntity(document);
  }

  async update(userId: string, accountId: string, input: UpdateAccountInput): Promise<Account> {
    const accounts = await collections.accounts();
    const existing = await accounts.findOne(ownedById(userId, accountId));
    if (!existing) throw new NotFoundError("Account");

    if (
      input.expectedSyncVersion !== undefined &&
      input.expectedSyncVersion !== existing.syncVersion
    ) {
      throw new ConflictError("This account was changed on another device.", {
        serverSyncVersion: existing.syncVersion,
      });
    }

    const isCard = existing.type === "credit_card";
    const set: Partial<AccountDocument> = { ...updateMeta() };

    if (input.name !== undefined) set.name = input.name;
    if (input.openingBalance !== undefined) {
      set.openingBalance = toDecimal128(input.openingBalance);
    }
    if (input.institutionName !== undefined) set.institutionName = input.institutionName;

    if (isCard) {
      if (input.creditLimit !== undefined) {
        set.creditLimit = optionalToDecimal128(input.creditLimit);
      }
      if (input.statementDay !== undefined) set.statementDay = input.statementDay;
      if (input.paymentDueDay !== undefined) set.paymentDueDay = input.paymentDueDay;
    }

    const document = await accounts.findOneAndUpdate(
      ownedById(userId, accountId),
      { $set: set, $inc: { syncVersion: 1 } },
      { returnDocument: "after" },
    );

    if (!document) throw new NotFoundError("Account");
    return toAccountEntity(document);
  }

  async archive(userId: string, accountId: string): Promise<Account> {
    const accounts = await collections.accounts();
    const document = await accounts.findOneAndUpdate(
      ownedById(userId, accountId),
      archiveUpdate(),
      { returnDocument: "after" },
    );
    if (!document) throw new NotFoundError("Account");
    return toAccountEntity(document);
  }

  async restore(userId: string, accountId: string): Promise<Account> {
    const accounts = await collections.accounts();
    const document = await accounts.findOneAndUpdate(
      ownedById(userId, accountId),
      restoreUpdate(),
      { returnDocument: "after" },
    );
    if (!document) throw new NotFoundError("Account");
    return toAccountEntity(document);
  }

  async countAll(userId: string): Promise<number> {
    const accounts = await collections.accounts();
    return accounts.countDocuments(owned(userId));
  }

  /**
   * Records changed since a sync cursor, for the pull endpoint.
   *
   * Ordered by `(updatedAt, _id)` and filtered by the same pair. Several accounts
   * written in one transaction share a timestamp to the millisecond, so a
   * timestamp-only cursor would replay or skip them (docs/08-OFFLINE-SYNC.md
   * section 23). Archived accounts are included: the client needs to know they were
   * archived.
   */
  async changesSince(userId: string, query: ChangeFeedQuery): Promise<Account[]> {
    const accounts = await collections.accounts();

    const filter: Filter<AccountDocument> = { ...owned(userId) };

    if (query.since) {
      filter.$or = [
        { updatedAt: { $gt: query.since } },
        ...(query.sinceId
          ? [{ updatedAt: query.since, _id: { $gt: toObjectId(query.sinceId) } }]
          : []),
      ];
    }

    const documents = await accounts
      .find(filter)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(query.limit)
      .toArray();

    return documents.map(toAccountEntity);
  }
}

let instance: MongoAccountRepository | null = null;

export function accountRepository(): AccountRepository {
  instance ??= new MongoAccountRepository();
  return instance;
}
