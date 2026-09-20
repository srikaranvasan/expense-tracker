import type { Filter } from "mongodb";
import type { Category } from "@/domain/categories/entities";
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
import type { CategoryDocument } from "@/server/db/models/category";
import { toCategoryEntity } from "@/server/db/models/category";
import { newObjectId, toObjectId, toOptionalObjectId } from "@/server/db/object-id";
import { isDuplicateKeyError } from "@/server/errors/api-error";
import type {
  CategoryRepository,
  CreateCategoryInput,
  ListCategoriesQuery,
  UpdateCategoryInput,
} from "../interfaces/category-repository";
import type { ChangeFeedQuery, RepositoryContext } from "../interfaces/common";

function sessionOf(context?: RepositoryContext) {
  return context?.session ? { session: context.session } : {};
}

function buildDocument(userId: string, input: CreateCategoryInput): CategoryDocument {
  return {
    _id: newObjectId(),
    userId: toObjectId(userId),
    clientId: input.clientId,
    name: input.name,
    icon: input.icon ?? null,
    parentId: toOptionalObjectId(input.parentId),
    kind: input.kind ?? "expense",
    archivedAt: null,
    ...creationMeta(),
  };
}

export class MongoCategoryRepository implements CategoryRepository {
  async findById(
    userId: string,
    categoryId: string,
    context?: RepositoryContext,
  ): Promise<Category | null> {
    const categories = await collections.categories();
    const document = await categories.findOne(ownedById(userId, categoryId), sessionOf(context));
    return document ? toCategoryEntity(document) : null;
  }

  async findByClientId(userId: string, clientId: string): Promise<Category | null> {
    const categories = await collections.categories();
    const document = await categories.findOne({ ...owned(userId), clientId });
    return document ? toCategoryEntity(document) : null;
  }

  async findManyByIds(userId: string, categoryIds: readonly string[]): Promise<Category[]> {
    if (categoryIds.length === 0) return [];

    const categories = await collections.categories();
    const documents = await categories
      .find({ ...owned(userId), _id: { $in: categoryIds.map(toObjectId) } })
      .toArray();

    return documents.map(toCategoryEntity);
  }

  async list(userId: string, query: ListCategoriesQuery = {}): Promise<Category[]> {
    const categories = await collections.categories();

    const filter: Filter<CategoryDocument> = {
      ...owned(userId),
      ...(query.includeArchived ? {} : notArchived()),
      ...(query.kind ? { kind: query.kind } : {}),
    };

    const documents = await categories.find(filter).sort({ name: 1 }).toArray();
    return documents.map(toCategoryEntity);
  }

  async create(
    userId: string,
    input: CreateCategoryInput,
    context?: RepositoryContext,
  ): Promise<Category> {
    const categories = await collections.categories();
    const document = buildDocument(userId, input);

    try {
      await categories.insertOne(document, sessionOf(context));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.findByClientId(userId, input.clientId);
        if (existing) return existing;
        throw new ConflictError("This category has already been saved.");
      }
      throw error;
    }

    return toCategoryEntity(document);
  }

  async createMany(
    userId: string,
    inputs: readonly CreateCategoryInput[],
    context?: RepositoryContext,
  ): Promise<Category[]> {
    if (inputs.length === 0) return [];

    const categories = await collections.categories();
    const documents = inputs.map((input) => buildDocument(userId, input));

    await categories.insertMany(documents, { ordered: true, ...sessionOf(context) });
    return documents.map(toCategoryEntity);
  }

  async update(userId: string, categoryId: string, input: UpdateCategoryInput): Promise<Category> {
    const categories = await collections.categories();
    const existing = await categories.findOne(ownedById(userId, categoryId));
    if (!existing) throw new NotFoundError("Category");

    if (
      input.expectedSyncVersion !== undefined &&
      input.expectedSyncVersion !== existing.syncVersion
    ) {
      throw new ConflictError("This category was changed on another device.", {
        serverSyncVersion: existing.syncVersion,
      });
    }

    const set: Partial<CategoryDocument> = { ...updateMeta() };
    if (input.name !== undefined) set.name = input.name;
    if (input.icon !== undefined) set.icon = input.icon;
    if (input.parentId !== undefined) set.parentId = toOptionalObjectId(input.parentId);

    const document = await categories.findOneAndUpdate(
      ownedById(userId, categoryId),
      { $set: set, $inc: { syncVersion: 1 } },
      { returnDocument: "after" },
    );

    if (!document) throw new NotFoundError("Category");
    return toCategoryEntity(document);
  }

  async archive(userId: string, categoryId: string): Promise<Category> {
    const categories = await collections.categories();
    const document = await categories.findOneAndUpdate(
      ownedById(userId, categoryId),
      archiveUpdate(),
      { returnDocument: "after" },
    );
    if (!document) throw new NotFoundError("Category");
    return toCategoryEntity(document);
  }

  async restore(userId: string, categoryId: string): Promise<Category> {
    const categories = await collections.categories();
    const document = await categories.findOneAndUpdate(
      ownedById(userId, categoryId),
      restoreUpdate(),
      { returnDocument: "after" },
    );
    if (!document) throw new NotFoundError("Category");
    return toCategoryEntity(document);
  }

  async hasChildren(userId: string, categoryId: string): Promise<boolean> {
    const categories = await collections.categories();
    const count = await categories.countDocuments(
      { ...owned(userId), ...notArchived(), parentId: toObjectId(categoryId) },
      { limit: 1 },
    );
    return count > 0;
  }

  async countAll(userId: string): Promise<number> {
    const categories = await collections.categories();
    return categories.countDocuments(owned(userId));
  }

  /** Records changed since a sync cursor. See the account repository for the ordering. */
  async changesSince(userId: string, query: ChangeFeedQuery): Promise<Category[]> {
    const categories = await collections.categories();

    const filter: Filter<CategoryDocument> = { ...owned(userId) };

    if (query.since) {
      filter.$or = [
        { updatedAt: { $gt: query.since } },
        ...(query.sinceId
          ? [{ updatedAt: query.since, _id: { $gt: toObjectId(query.sinceId) } }]
          : []),
      ];
    }

    const documents = await categories
      .find(filter)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(query.limit)
      .toArray();

    return documents.map(toCategoryEntity);
  }
}

let instance: MongoCategoryRepository | null = null;

export function categoryRepository(): CategoryRepository {
  instance ??= new MongoCategoryRepository();
  return instance;
}
