import type { ClientSession, Collection } from "mongodb";
import { COLLECTIONS } from "@/config/constants";
import type { User } from "@/domain/users/entities";
import { NotFoundError } from "@/lib/errors";
import { getDb } from "@/server/db/client";
import type { UserDocument } from "@/server/db/models/user";
import { toUserCredentials, toUserEntity } from "@/server/db/models/user";
import { newObjectId, toObjectId, toOptionalObjectId } from "@/server/db/object-id";
import type {
  CreateUserInput,
  UpdateUserInput,
  UserRepository,
} from "../interfaces/user-repository";

async function users(): Promise<Collection<UserDocument>> {
  const db = await getDb();
  return db.collection<UserDocument>(COLLECTIONS.users);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class MongoUserRepository implements UserRepository {
  async findById(userId: string): Promise<User | null> {
    const collection = await users();
    const document = await collection.findOne({ _id: toObjectId(userId) });
    return document ? toUserEntity(document) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const collection = await users();
    const document = await collection.findOne({ email: normalizeEmail(email) });
    return document ? toUserEntity(document) : null;
  }

  async findCredentialsByEmail(email: string) {
    const collection = await users();
    const document = await collection.findOne(
      { email: normalizeEmail(email) },
      { projection: { _id: 1, email: 1, passwordHash: 1 } },
    );
    return document ? toUserCredentials(document as UserDocument) : null;
  }

  async emailExists(email: string): Promise<boolean> {
    const collection = await users();
    const count = await collection.countDocuments({ email: normalizeEmail(email) }, { limit: 1 });
    return count > 0;
  }

  async create(input: CreateUserInput, session?: ClientSession): Promise<User> {
    const collection = await users();
    const now = new Date();

    const document: UserDocument = {
      _id: newObjectId(),
      email: normalizeEmail(input.email),
      name: input.name,
      passwordHash: input.passwordHash,
      currency: input.currency,
      timezone: input.timezone,
      settings: { defaultAccountId: null, defaultCategoryId: null },
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(document, session ? { session } : {});
    return toUserEntity(document);
  }

  async update(userId: string, input: UpdateUserInput): Promise<User> {
    const collection = await users();

    // Built field by field so an unexpected client key can never reach the query.
    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (input.name !== undefined) set.name = input.name;
    if (input.currency !== undefined) set.currency = input.currency;
    if (input.timezone !== undefined) set.timezone = input.timezone;
    if (input.settings?.defaultAccountId !== undefined) {
      set["settings.defaultAccountId"] = toOptionalObjectId(input.settings.defaultAccountId);
    }
    if (input.settings?.defaultCategoryId !== undefined) {
      set["settings.defaultCategoryId"] = toOptionalObjectId(input.settings.defaultCategoryId);
    }

    const document = await collection.findOneAndUpdate(
      { _id: toObjectId(userId) },
      { $set: set },
      { returnDocument: "after" },
    );

    if (!document) throw new NotFoundError("User");
    return toUserEntity(document);
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    const collection = await users();
    const result = await collection.updateOne(
      { _id: toObjectId(userId) },
      { $set: { passwordHash, updatedAt: new Date() } },
    );
    if (result.matchedCount === 0) throw new NotFoundError("User");
  }
}

let instance: MongoUserRepository | null = null;

export function userRepository(): UserRepository {
  instance ??= new MongoUserRepository();
  return instance;
}
