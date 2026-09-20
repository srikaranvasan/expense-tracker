import type { Filter } from "mongodb";
import type { ExpenseSplit } from "@/domain/transactions/entities";
import { collections } from "@/server/db/collections";
import {
  creationMeta,
  notDeleted,
  owned,
  ownedById,
  softDeleteUpdate,
} from "@/server/db/conventions";
import { toDecimal128 } from "@/server/db/decimal128";
import type { ExpenseSplitDocument } from "@/server/db/models/transaction";
import { toExpenseSplitEntity } from "@/server/db/models/transaction";
import { newObjectId, toObjectId, toOptionalObjectId } from "@/server/db/object-id";
import type { ChangeFeedQuery, RepositoryContext } from "../interfaces/common";
import type {
  CreateExpenseSplitInput,
  ExpenseSplitRepository,
} from "../interfaces/transaction-repository";

function sessionOf(context?: RepositoryContext) {
  return context?.session ? { session: context.session } : {};
}

export class MongoExpenseSplitRepository implements ExpenseSplitRepository {
  async findById(
    userId: string,
    splitId: string,
    context?: RepositoryContext,
  ): Promise<ExpenseSplit | null> {
    const splits = await collections.expenseSplits();
    const document = await splits.findOne(
      { ...ownedById(userId, splitId), ...notDeleted() },
      sessionOf(context),
    );
    return document ? toExpenseSplitEntity(document) : null;
  }

  async listByTransaction(
    userId: string,
    transactionId: string,
    context?: RepositoryContext,
  ): Promise<ExpenseSplit[]> {
    const splits = await collections.expenseSplits();
    const documents = await splits
      .find(
        { ...owned(userId), ...notDeleted(), transactionId: toObjectId(transactionId) },
        sessionOf(context),
      )
      .sort({ createdAt: 1, _id: 1 })
      .toArray();

    return documents.map(toExpenseSplitEntity);
  }

  async listByTransactions(
    userId: string,
    transactionIds: readonly string[],
  ): Promise<ExpenseSplit[]> {
    if (transactionIds.length === 0) return [];

    const splits = await collections.expenseSplits();
    const documents = await splits
      .find({
        ...owned(userId),
        ...notDeleted(),
        transactionId: { $in: transactionIds.map(toObjectId) },
      })
      .toArray();

    return documents.map(toExpenseSplitEntity);
  }

  async findManyByIds(
    userId: string,
    splitIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<ExpenseSplit[]> {
    if (splitIds.length === 0) return [];

    const splits = await collections.expenseSplits();
    const documents = await splits
      .find(
        { ...owned(userId), ...notDeleted(), _id: { $in: splitIds.map(toObjectId) } },
        sessionOf(context),
      )
      .toArray();

    return documents.map(toExpenseSplitEntity);
  }

  async listByPerson(userId: string, personId: string): Promise<ExpenseSplit[]> {
    const splits = await collections.expenseSplits();
    const documents = await splits
      .find({
        ...owned(userId),
        ...notDeleted(),
        participantType: "person",
        personId: toObjectId(personId),
      })
      .sort({ createdAt: -1 })
      .toArray();

    return documents.map(toExpenseSplitEntity);
  }

  async listAll(userId: string): Promise<ExpenseSplit[]> {
    const splits = await collections.expenseSplits();
    const documents = await splits.find({ ...owned(userId), ...notDeleted() }).toArray();
    return documents.map(toExpenseSplitEntity);
  }

  async createMany(
    userId: string,
    inputs: readonly CreateExpenseSplitInput[],
    currency: string,
    context?: RepositoryContext,
  ): Promise<ExpenseSplit[]> {
    if (inputs.length === 0) return [];

    const splits = await collections.expenseSplits();

    const documents: ExpenseSplitDocument[] = inputs.map((input) => ({
      _id: newObjectId(),
      userId: toObjectId(userId),
      clientId: input.clientId,
      transactionId: toObjectId(input.transactionId),
      participantType: input.participantType,
      // A user participant must never carry a personId.
      personId:
        input.participantType === "person" ? toOptionalObjectId(input.personId ?? null) : null,
      shareAmount: toDecimal128(input.shareAmount),
      currency,
      deletedAt: null,
      ...creationMeta(),
    }));

    await splits.insertMany(documents, { ordered: true, ...sessionOf(context) });
    return documents.map(toExpenseSplitEntity);
  }

  async softDeleteByTransaction(
    userId: string,
    transactionId: string,
    context?: RepositoryContext,
  ): Promise<void> {
    const splits = await collections.expenseSplits();
    await splits.updateMany(
      { ...owned(userId), ...notDeleted(), transactionId: toObjectId(transactionId) },
      softDeleteUpdate(),
      sessionOf(context),
    );
  }

  /**
   * Marks the given splits as changed without altering their values.
   *
   * Used by the settlement path to serialise concurrent settlements against the same
   * split: the write conflict is the point, not the field update.
   */
  async touchMany(
    userId: string,
    splitIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<void> {
    if (splitIds.length === 0) return;

    const splits = await collections.expenseSplits();
    await splits.updateMany(
      { ...owned(userId), ...notDeleted(), _id: { $in: splitIds.map(toObjectId) } },
      { $set: { updatedAt: new Date() }, $inc: { syncVersion: 1 } },
      sessionOf(context),
    );
  }

  async countByPerson(userId: string, personId: string): Promise<number> {
    const splits = await collections.expenseSplits();
    return splits.countDocuments({
      ...owned(userId),
      ...notDeleted(),
      participantType: "person",
      personId: toObjectId(personId),
    });
  }

  async changesSince(userId: string, query: ChangeFeedQuery): Promise<ExpenseSplit[]> {
    const splits = await collections.expenseSplits();
    const filter: Filter<ExpenseSplitDocument> = { ...owned(userId) };

    if (query.since) {
      filter.$or = [
        { updatedAt: { $gt: query.since } },
        ...(query.sinceId
          ? [{ updatedAt: query.since, _id: { $gt: toObjectId(query.sinceId) } }]
          : []),
      ];
    }

    const documents = await splits
      .find(filter)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(query.limit)
      .toArray();

    return documents.map(toExpenseSplitEntity);
  }
}

let instance: MongoExpenseSplitRepository | null = null;

export function expenseSplitRepository(): ExpenseSplitRepository {
  instance ??= new MongoExpenseSplitRepository();
  return instance;
}
