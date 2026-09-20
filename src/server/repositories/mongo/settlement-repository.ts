import type { Filter } from "mongodb";
import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import { ConflictError, NotFoundError } from "@/lib/errors";
import { collections } from "@/server/db/collections";
import {
  creationMeta,
  notDeleted,
  owned,
  ownedById,
  softDeleteUpdate,
} from "@/server/db/conventions";
import { toDecimal128 } from "@/server/db/decimal128";
import type {
  SettlementAllocationDocument,
  SettlementDocument,
} from "@/server/db/models/settlement";
import { toSettlementAllocationEntity, toSettlementEntity } from "@/server/db/models/settlement";
import { newObjectId, toObjectId, toOptionalObjectId } from "@/server/db/object-id";
import { isDuplicateKeyError } from "@/server/errors/api-error";
import type { ChangeFeedQuery, CursorResult, RepositoryContext } from "../interfaces/common";
import type {
  CreateSettlementAllocationInput,
  CreateSettlementInput,
  ListSettlementsQuery,
  SettlementAllocationRepository,
  SettlementRepository,
} from "../interfaces/settlement-repository";
import { afterDateCursor, buildPage, decodeDateCursor } from "./cursor";

function sessionOf(context?: RepositoryContext) {
  return context?.session ? { session: context.session } : {};
}

export class MongoSettlementRepository implements SettlementRepository {
  async findById(
    userId: string,
    settlementId: string,
    context?: RepositoryContext,
  ): Promise<Settlement | null> {
    const settlements = await collections.settlements();
    const document = await settlements.findOne(
      { ...ownedById(userId, settlementId), ...notDeleted() },
      sessionOf(context),
    );
    return document ? toSettlementEntity(document) : null;
  }

  async findByClientId(
    userId: string,
    clientId: string,
    context?: RepositoryContext,
  ): Promise<Settlement | null> {
    const settlements = await collections.settlements();
    const document = await settlements.findOne({ ...owned(userId), clientId }, sessionOf(context));
    return document ? toSettlementEntity(document) : null;
  }

  async list(userId: string, query: ListSettlementsQuery): Promise<CursorResult<Settlement>> {
    const settlements = await collections.settlements();

    const conditions: Filter<SettlementDocument>[] = [
      { ...owned(userId), ...notDeleted() } as Filter<SettlementDocument>,
    ];

    if (query.cursor) {
      conditions.push(afterDateCursor<SettlementDocument>(decodeDateCursor(query.cursor)));
    }
    if (query.personId) {
      conditions.push({ personId: toObjectId(query.personId) });
    }
    if (query.from || query.to) {
      conditions.push({
        date: {
          ...(query.from ? { $gte: query.from } : {}),
          ...(query.to ? { $lte: query.to } : {}),
        },
      });
    }

    const filter = conditions.length === 1 ? conditions[0]! : { $and: conditions };

    const documents = await settlements
      .find(filter)
      .sort({ date: -1, _id: -1 })
      .limit(query.limit + 1)
      .toArray();

    return buildPage(documents, query.limit, toSettlementEntity);
  }

  async listByPerson(userId: string, personId: string): Promise<Settlement[]> {
    const settlements = await collections.settlements();
    const documents = await settlements
      .find({ ...owned(userId), ...notDeleted(), personId: toObjectId(personId) })
      .sort({ date: -1, _id: -1 })
      .toArray();

    return documents.map(toSettlementEntity);
  }

  async listAll(userId: string): Promise<Settlement[]> {
    const settlements = await collections.settlements();
    const documents = await settlements.find({ ...owned(userId), ...notDeleted() }).toArray();
    return documents.map(toSettlementEntity);
  }

  async create(
    userId: string,
    input: CreateSettlementInput,
    context?: RepositoryContext,
  ): Promise<Settlement> {
    const settlements = await collections.settlements();

    const document: SettlementDocument = {
      _id: newObjectId(),
      userId: toObjectId(userId),
      clientId: input.clientId,
      personId: toObjectId(input.personId),
      direction: input.direction,
      amount: toDecimal128(input.amount),
      currency: input.amount.currency,
      accountId: toOptionalObjectId(input.accountId),
      date: input.date,
      notes: input.notes ?? null,
      deletedAt: null,
      ...creationMeta(),
    };

    try {
      await settlements.insertOne(document, sessionOf(context));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.findByClientId(userId, input.clientId, context);
        if (existing) return existing;
        throw new ConflictError("This settlement has already been saved.");
      }
      throw error;
    }

    return toSettlementEntity(document);
  }

  async softDelete(
    userId: string,
    settlementId: string,
    context?: RepositoryContext,
  ): Promise<void> {
    const settlements = await collections.settlements();
    const result = await settlements.updateOne(
      { ...ownedById(userId, settlementId), ...notDeleted() },
      softDeleteUpdate(),
      sessionOf(context),
    );
    if (result.matchedCount === 0) throw new NotFoundError("Settlement");
  }

  async countByPerson(userId: string, personId: string): Promise<number> {
    const settlements = await collections.settlements();
    return settlements.countDocuments({
      ...owned(userId),
      ...notDeleted(),
      personId: toObjectId(personId),
    });
  }

  async countByAccount(userId: string, accountId: string): Promise<number> {
    const settlements = await collections.settlements();
    return settlements.countDocuments({
      ...owned(userId),
      ...notDeleted(),
      accountId: toObjectId(accountId),
    });
  }

  async changesSince(userId: string, query: ChangeFeedQuery): Promise<Settlement[]> {
    const settlements = await collections.settlements();
    const filter: Filter<SettlementDocument> = { ...owned(userId) };

    if (query.since) {
      filter.$or = [
        { updatedAt: { $gt: query.since } },
        ...(query.sinceId
          ? [{ updatedAt: query.since, _id: { $gt: toObjectId(query.sinceId) } }]
          : []),
      ];
    }

    const documents = await settlements
      .find(filter)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(query.limit)
      .toArray();

    return documents.map(toSettlementEntity);
  }
}

export class MongoSettlementAllocationRepository implements SettlementAllocationRepository {
  async listBySettlement(
    userId: string,
    settlementId: string,
    context?: RepositoryContext,
  ): Promise<SettlementAllocation[]> {
    const allocations = await collections.settlementAllocations();
    const documents = await allocations
      .find(
        { ...owned(userId), ...notDeleted(), settlementId: toObjectId(settlementId) },
        sessionOf(context),
      )
      .toArray();

    return documents.map(toSettlementAllocationEntity);
  }

  async listBySplitIds(
    userId: string,
    splitIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<SettlementAllocation[]> {
    if (splitIds.length === 0) return [];

    const allocations = await collections.settlementAllocations();
    const documents = await allocations
      .find(
        {
          ...owned(userId),
          ...notDeleted(),
          expenseSplitId: { $in: splitIds.map(toObjectId) },
        },
        sessionOf(context),
      )
      .toArray();

    return documents.map(toSettlementAllocationEntity);
  }

  async listAll(userId: string): Promise<SettlementAllocation[]> {
    const allocations = await collections.settlementAllocations();
    const documents = await allocations.find({ ...owned(userId), ...notDeleted() }).toArray();
    return documents.map(toSettlementAllocationEntity);
  }

  async createMany(
    userId: string,
    inputs: readonly CreateSettlementAllocationInput[],
    currency: string,
    context?: RepositoryContext,
  ): Promise<SettlementAllocation[]> {
    if (inputs.length === 0) return [];

    const allocations = await collections.settlementAllocations();

    const documents: SettlementAllocationDocument[] = inputs.map((input) => ({
      _id: newObjectId(),
      userId: toObjectId(userId),
      clientId: input.clientId,
      settlementId: toObjectId(input.settlementId),
      expenseSplitId: toObjectId(input.expenseSplitId),
      amount: toDecimal128(input.amount),
      currency,
      deletedAt: null,
      ...creationMeta(),
    }));

    await allocations.insertMany(documents, { ordered: true, ...sessionOf(context) });
    return documents.map(toSettlementAllocationEntity);
  }

  async softDeleteBySettlement(
    userId: string,
    settlementId: string,
    context?: RepositoryContext,
  ): Promise<void> {
    const allocations = await collections.settlementAllocations();
    await allocations.updateMany(
      { ...owned(userId), ...notDeleted(), settlementId: toObjectId(settlementId) },
      softDeleteUpdate(),
      sessionOf(context),
    );
  }

  async countBySplitIds(
    userId: string,
    splitIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<number> {
    if (splitIds.length === 0) return 0;

    const allocations = await collections.settlementAllocations();
    return allocations.countDocuments(
      {
        ...owned(userId),
        ...notDeleted(),
        expenseSplitId: { $in: splitIds.map(toObjectId) },
      },
      sessionOf(context),
    );
  }

  async changesSince(userId: string, query: ChangeFeedQuery): Promise<SettlementAllocation[]> {
    const allocations = await collections.settlementAllocations();
    const filter: Filter<SettlementAllocationDocument> = { ...owned(userId) };

    if (query.since) {
      filter.$or = [
        { updatedAt: { $gt: query.since } },
        ...(query.sinceId
          ? [{ updatedAt: query.since, _id: { $gt: toObjectId(query.sinceId) } }]
          : []),
      ];
    }

    const documents = await allocations
      .find(filter)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(query.limit)
      .toArray();

    return documents.map(toSettlementAllocationEntity);
  }
}

let settlementInstance: MongoSettlementRepository | null = null;
let allocationInstance: MongoSettlementAllocationRepository | null = null;

export function settlementRepository(): SettlementRepository {
  settlementInstance ??= new MongoSettlementRepository();
  return settlementInstance;
}

export function settlementAllocationRepository(): SettlementAllocationRepository {
  allocationInstance ??= new MongoSettlementAllocationRepository();
  return allocationInstance;
}
