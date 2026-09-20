import type { Filter } from "mongodb";
import type { Person } from "@/domain/people/entities";
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
import type { PersonDocument } from "@/server/db/models/person";
import { toPersonEntity } from "@/server/db/models/person";
import { newObjectId, toObjectId } from "@/server/db/object-id";
import { isDuplicateKeyError } from "@/server/errors/api-error";
import { escapeRegExp } from "@/lib/utils/text";
import type { ChangeFeedQuery, RepositoryContext } from "../interfaces/common";
import type {
  CreatePersonInput,
  ListPeopleQuery,
  PersonRepository,
  UpdatePersonInput,
} from "../interfaces/person-repository";

function sessionOf(context?: RepositoryContext) {
  return context?.session ? { session: context.session } : {};
}

export class MongoPersonRepository implements PersonRepository {
  async findById(
    userId: string,
    personId: string,
    context?: RepositoryContext,
  ): Promise<Person | null> {
    const people = await collections.people();
    const document = await people.findOne(ownedById(userId, personId), sessionOf(context));
    return document ? toPersonEntity(document) : null;
  }

  async findByClientId(userId: string, clientId: string): Promise<Person | null> {
    const people = await collections.people();
    const document = await people.findOne({ ...owned(userId), clientId });
    return document ? toPersonEntity(document) : null;
  }

  async findManyByIds(userId: string, personIds: readonly string[]): Promise<Person[]> {
    if (personIds.length === 0) return [];

    const people = await collections.people();
    const documents = await people
      .find({ ...owned(userId), _id: { $in: personIds.map(toObjectId) } })
      .toArray();

    return documents.map(toPersonEntity);
  }

  async list(userId: string, query: ListPeopleQuery = {}): Promise<Person[]> {
    const people = await collections.people();

    const filter: Filter<PersonDocument> = {
      ...owned(userId),
      ...(query.includeArchived ? {} : notArchived()),
      // Escaped: an unescaped search term would be interpreted as a pattern.
      ...(query.search ? { name: { $regex: escapeRegExp(query.search), $options: "i" } } : {}),
    };

    const documents = await people.find(filter).sort({ name: 1 }).toArray();
    return documents.map(toPersonEntity);
  }

  async create(
    userId: string,
    input: CreatePersonInput,
    context?: RepositoryContext,
  ): Promise<Person> {
    const people = await collections.people();

    const document: PersonDocument = {
      _id: newObjectId(),
      userId: toObjectId(userId),
      clientId: input.clientId,
      name: input.name,
      notes: input.notes ?? null,
      archivedAt: null,
      ...creationMeta(),
    };

    try {
      await people.insertOne(document, sessionOf(context));
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        const existing = await this.findByClientId(userId, input.clientId);
        if (existing) return existing;
        throw new ConflictError("This person has already been saved.");
      }
      throw error;
    }

    return toPersonEntity(document);
  }

  async update(userId: string, personId: string, input: UpdatePersonInput): Promise<Person> {
    const people = await collections.people();
    const existing = await people.findOne(ownedById(userId, personId));
    if (!existing) throw new NotFoundError("Person");

    if (
      input.expectedSyncVersion !== undefined &&
      input.expectedSyncVersion !== existing.syncVersion
    ) {
      throw new ConflictError("This person was changed on another device.", {
        serverSyncVersion: existing.syncVersion,
      });
    }

    const set: Partial<PersonDocument> = { ...updateMeta() };
    if (input.name !== undefined) set.name = input.name;
    if (input.notes !== undefined) set.notes = input.notes;

    const document = await people.findOneAndUpdate(
      ownedById(userId, personId),
      { $set: set, $inc: { syncVersion: 1 } },
      { returnDocument: "after" },
    );

    if (!document) throw new NotFoundError("Person");
    return toPersonEntity(document);
  }

  async archive(userId: string, personId: string): Promise<Person> {
    const people = await collections.people();
    const document = await people.findOneAndUpdate(ownedById(userId, personId), archiveUpdate(), {
      returnDocument: "after",
    });
    if (!document) throw new NotFoundError("Person");
    return toPersonEntity(document);
  }

  async restore(userId: string, personId: string): Promise<Person> {
    const people = await collections.people();
    const document = await people.findOneAndUpdate(ownedById(userId, personId), restoreUpdate(), {
      returnDocument: "after",
    });
    if (!document) throw new NotFoundError("Person");
    return toPersonEntity(document);
  }

  /** Records changed since a sync cursor. See the account repository for the ordering. */
  async changesSince(userId: string, query: ChangeFeedQuery): Promise<Person[]> {
    const people = await collections.people();

    const filter: Filter<PersonDocument> = { ...owned(userId) };

    if (query.since) {
      filter.$or = [
        { updatedAt: { $gt: query.since } },
        ...(query.sinceId
          ? [{ updatedAt: query.since, _id: { $gt: toObjectId(query.sinceId) } }]
          : []),
      ];
    }

    const documents = await people
      .find(filter)
      .sort({ updatedAt: 1, _id: 1 })
      .limit(query.limit)
      .toArray();

    return documents.map(toPersonEntity);
  }
}

let instance: MongoPersonRepository | null = null;

export function personRepository(): PersonRepository {
  instance ??= new MongoPersonRepository();
  return instance;
}
