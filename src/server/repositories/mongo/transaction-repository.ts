import type { Filter } from "mongodb";
import type { Transaction } from "@/domain/transactions/entities";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { escapeRegExp } from "@/lib/utils/text";
import { collections } from "@/server/db/collections";
import {
  creationMeta,
  notDeleted,
  owned,
  ownedById,
  softDeleteUpdate,
  updateMeta,
} from "@/server/db/conventions";
import { toDecimal128 } from "@/server/db/decimal128";
import type {
  ExpenseSplitDocument,
  PaidByEmbedded,
  TransactionDocument,
} from "@/server/db/models/transaction";
import { toTransactionEntity } from "@/server/db/models/transaction";
import { newObjectId, toObjectId, toOptionalObjectId } from "@/server/db/object-id";
import { isDuplicateKeyError } from "@/server/errors/api-error";
import type { PaidBy } from "@/domain/transactions/entities";
import type { ChangeFeedQuery, CursorResult, RepositoryContext } from "../interfaces/common";
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  TransactionRepository,
  UpdateTransactionInput,
} from "../interfaces/transaction-repository";
import { afterDateCursor, buildPage, decodeDateCursor } from "./cursor";

function sessionOf(context?: RepositoryContext) {
  return context?.session ? { session: context.session } : {};
}

function toPaidByEmbedded(paidBy: PaidBy | null | undefined): PaidByEmbedded | null {
  if (!paidBy) return null;
  return paidBy.type === "person"
    ? { type: "person", personId: toObjectId(paidBy.personId) }
    : { type: "user", personId: null };
}

export class MongoTransactionRepository implements TransactionRepository {
  async findById(
    userId: string,
    transactionId: string,
    context?: RepositoryContext,
  ): Promise<Transaction | null> {
    const transactions = await collections.transactions();
    const document = await transactions.findOne(
      { ...ownedById(userId, transactionId), ...notDeleted() },
      sessionOf(context),
    );
    return document ? toTransactionEntity(document) : null;
  }

  async findByClientId(
    userId: string,
    clientId: string,
    context?: RepositoryContext,
  ): Promise<Transaction | null> {
    const transactions = await collections.transactions();
    const document = await transactions.findOne({ ...owned(userId), clientId }, sessionOf(context));
    return document ? toTransactionEntity(document) : null;
  }

  async findManyByIds(
    userId: string,
    transactionIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<Transaction[]> {
    if (transactionIds.length === 0) return [];

    const transactions = await collections.transactions();
    const documents = await transactions
      .find(
        {
          ...owned(userId),
          ...notDeleted(),
          _id: { $in: transactionIds.map(toObjectId) },
        },
        sessionOf(context),
      )
      .toArray();

    return documents.map(toTransactionEntity);
  }

  async list(userId: string, query: ListTransactionsQuery): Promise<CursorResult<Transaction>> {
    const transactions = await collections.transactions();
    const filter = await this.buildListFilter(userId, query);

    // One extra row reveals whether a further page exists.
    const documents = await transactions
      .find(filter)
      .sort({ date: -1, _id: -1 })
      .limit(query.limit + 1)
      .toArray();

    return buildPage(documents, query.limit, toTransactionEntity);
  }

  private async buildListFilter(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<Filter<TransactionDocument>> {
    const conditions: Filter<TransactionDocument>[] = [
      { ...owned(userId), ...notDeleted() } as Filter<TransactionDocument>,
    ];

    if (query.cursor) {
      conditions.push(afterDateCursor<TransactionDocument>(decodeDateCursor(query.cursor)));
    }

    if (query.types?.length) {
      conditions.push({ type: { $in: query.types } });
    }

    if (query.from || query.to) {
      conditions.push({
        date: {
          ...(query.from ? { $gte: query.from } : {}),
          ...(query.to ? { $lte: query.to } : {}),
        },
      });
    }

    if (query.accountId) {
      const accountId = toObjectId(query.accountId);
      // An account can appear as the plain account, the source, or the destination.
      conditions.push({
        $or: [{ accountId }, { fromAccountId: accountId }, { toAccountId: accountId }],
      });
    }

    if (query.categoryId) {
      conditions.push({ categoryId: toObjectId(query.categoryId) });
    }

    if (query.search) {
      conditions.push({
        description: { $regex: escapeRegExp(query.search), $options: "i" },
      });
    }

    // "Involves this person" and "is/isn't shared" are properties of the splits,
    // so those ids are resolved first and applied as an _id filter.
    if (query.personId !== undefined || query.shared !== undefined) {
      const ids = await this.transactionIdsMatchingSplitCriteria(userId, query);
      if (ids === null) {
        // No transaction can match; force an empty result.
        conditions.push({ _id: { $in: [] } });
      } else {
        conditions.push({ _id: { $in: ids.map(toObjectId) } });
      }
    }

    return conditions.length === 1 ? conditions[0]! : { $and: conditions };
  }

  /** Returns matching transaction ids, or null when nothing can match. */
  private async transactionIdsMatchingSplitCriteria(
    userId: string,
    query: ListTransactionsQuery,
  ): Promise<string[] | null> {
    const splits = await collections.expenseSplits();

    const splitFilter: Filter<ExpenseSplitDocument> = {
      ...owned(userId),
      ...notDeleted(),
      // A shared expense is one where somebody other than the user has a share.
      ...(query.personId
        ? { participantType: "person" as const, personId: toObjectId(query.personId) }
        : query.shared !== undefined
          ? { participantType: "person" as const }
          : {}),
    };

    const ids = await splits.distinct("transactionId", splitFilter);
    const asStrings = ids.map((id) => id.toHexString());

    if (query.personId) return asStrings.length > 0 ? asStrings : null;

    if (query.shared === true) return asStrings.length > 0 ? asStrings : null;

    if (query.shared === false) {
      // "Personal" is a property of an *expense*, so the complement is taken over
      // expenses only. Without the type constraint a transfer would qualify as a
      // personal expense simply by having no person splits, and the shared/personal
      // toggle would quietly change which record types are listed.
      const transactions = await collections.transactions();
      const all = await transactions.distinct("_id", {
        ...owned(userId),
        ...notDeleted(),
        type: "expense",
      });
      const sharedSet = new Set(asStrings);
      const personal = all.map((id) => id.toHexString()).filter((id) => !sharedSet.has(id));
      return personal.length > 0 ? personal : null;
    }

    return asStrings;
  }

  async listForProjection(
    userId: string,
    filter: {
      from?: Date;
      to?: Date;
      types?: Transaction["type"][];
      accountIds?: string[];
    } = {},
  ): Promise<Transaction[]> {
    const transactions = await collections.transactions();

    const conditions: Filter<TransactionDocument> = {
      ...owned(userId),
      ...notDeleted(),
      ...(filter.types?.length ? { type: { $in: filter.types } } : {}),
      ...(filter.from || filter.to
        ? {
            date: {
              ...(filter.from ? { $gte: filter.from } : {}),
              ...(filter.to ? { $lte: filter.to } : {}),
            },
          }
        : {}),
    };

    if (filter.accountIds?.length) {
      const ids = filter.accountIds.map(toObjectId);
      Object.assign(conditions, {
        $or: [
          { accountId: { $in: ids } },
          { fromAccountId: { $in: ids } },
          { toAccountId: { $in: ids } },
        ],
      });
    }

    const documents = await transactions.find(conditions).sort({ date: 1, _id: 1 }).toArray();
    return documents.map(toTransactionEntity);
  }

  async create(
    userId: string,
    input: CreateTransactionInput,
    context?: RepositoryContext,
  ): Promise<Transaction> {
    const transactions = await collections.transactions();

    const document: TransactionDocument = {
      _id: newObjectId(),
      userId: toObjectId(userId),
      clientId: input.clientId,
      type: input.type,
      amount: toDecimal128(input.amount),
      currency: input.amount.currency,
      description: input.description,
      date: input.date,
      categoryId: toOptionalObjectId(input.categoryId),
      accountId: toOptionalObjectId(input.accountId),
      fromAccountId: toOptionalObjectId(input.fromAccountId),
      toAccountId: toOptionalObjectId(input.toAccountId),
      paidBy: toPaidByEmbedded(input.paidBy),
      notes: input.notes ?? null,
      deletedAt: null,
      ...creationMeta(),
    };

    try {
      await transactions.insertOne(document, sessionOf(context));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.findByClientId(userId, input.clientId, context);
        if (existing) return existing;
        throw new ConflictError("This transaction has already been saved.");
      }
      throw error;
    }

    return toTransactionEntity(document);
  }

  async update(
    userId: string,
    transactionId: string,
    input: UpdateTransactionInput,
    context?: RepositoryContext,
  ): Promise<Transaction> {
    const transactions = await collections.transactions();
    const existing = await transactions.findOne(
      { ...ownedById(userId, transactionId), ...notDeleted() },
      sessionOf(context),
    );
    if (!existing) throw new NotFoundError("Transaction");

    if (
      input.expectedSyncVersion !== undefined &&
      input.expectedSyncVersion !== existing.syncVersion
    ) {
      throw new ConflictError("This transaction was changed on another device.", {
        serverSyncVersion: existing.syncVersion,
      });
    }

    const set: Partial<TransactionDocument> = { ...updateMeta() };

    if (input.amount !== undefined) {
      set.amount = toDecimal128(input.amount);
      set.currency = input.amount.currency;
    }
    if (input.description !== undefined) set.description = input.description;
    if (input.date !== undefined) set.date = input.date;
    if (input.categoryId !== undefined) set.categoryId = toOptionalObjectId(input.categoryId);
    if (input.accountId !== undefined) set.accountId = toOptionalObjectId(input.accountId);
    if (input.fromAccountId !== undefined) {
      set.fromAccountId = toOptionalObjectId(input.fromAccountId);
    }
    if (input.toAccountId !== undefined) set.toAccountId = toOptionalObjectId(input.toAccountId);
    if (input.paidBy !== undefined) set.paidBy = toPaidByEmbedded(input.paidBy);
    if (input.notes !== undefined) set.notes = input.notes;

    const document = await transactions.findOneAndUpdate(
      { ...ownedById(userId, transactionId), ...notDeleted() },
      { $set: set, $inc: { syncVersion: 1 } },
      { returnDocument: "after", ...sessionOf(context) },
    );

    if (!document) throw new NotFoundError("Transaction");
    return toTransactionEntity(document);
  }

  async softDelete(
    userId: string,
    transactionId: string,
    context?: RepositoryContext,
  ): Promise<void> {
    const transactions = await collections.transactions();
    const result = await transactions.updateOne(
      { ...ownedById(userId, transactionId), ...notDeleted() },
      softDeleteUpdate(),
      sessionOf(context),
    );
    if (result.matchedCount === 0) throw new NotFoundError("Transaction");
  }

  async countByAccount(userId: string, accountId: string): Promise<number> {
    const transactions = await collections.transactions();
    const id = toObjectId(accountId);
    return transactions.countDocuments({
      ...owned(userId),
      ...notDeleted(),
      $or: [{ accountId: id }, { fromAccountId: id }, { toAccountId: id }],
    });
  }

  async countByCategory(userId: string, categoryId: string): Promise<number> {
    const transactions = await collections.transactions();
    return transactions.countDocuments({
      ...owned(userId),
      ...notDeleted(),
      categoryId: toObjectId(categoryId),
    });
  }

  /**
   * Change feed for pull sync.
   *
   * Ordered by `(updatedAt, _id)` and inclusive of soft-deleted rows, because a
   * deletion is itself a change the client must apply.
   */
  async changesSince(userId: string, query: ChangeFeedQuery): Promise<Transaction[]> {
    const transactions = await collections.transactions();

    const filter: Filter<TransactionDocument> = { ...owned(userId) };

    if (query.since) {
      filter.$or = [
        { updatedAt: { $gt: query.since } },
        ...(query.sinceId
          ? [{ updatedAt: query.since, _id: { $gt: toObjectId(query.sinceId) } }]
          : []),
      ];
    }

    const documents = await transactions
      .find(filter)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(query.limit)
      .toArray();

    return documents.map(toTransactionEntity);
  }
}

let instance: MongoTransactionRepository | null = null;

export function transactionRepository(): TransactionRepository {
  instance ??= new MongoTransactionRepository();
  return instance;
}
