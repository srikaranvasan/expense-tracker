import type { ObjectId } from "mongodb";
import type { User, UserCredentials } from "@/domain/users/entities";
import { fromObjectId, optionalFromObjectId } from "../object-id";

/**
 * MongoDB document shape for the `users` collection.
 *
 * Document types stay in server/db/models and are mapped to domain entities
 * before crossing a layer boundary (docs/05-FOLDER-STRUCTURE.md section 21).
 */
export type UserDocument = {
  _id: ObjectId;
  /** Stored lower-cased; a unique index enforces one account per address. */
  email: string;
  name: string;
  /**
   * bcrypt hash. The Credentials provider requires verifiable password material,
   * which is the documented exception to "do not store passwords"
   * (docs/09-DATABASE-SCHEMA.md section 3).
   */
  passwordHash: string;
  currency: string;
  timezone: string;
  settings: {
    defaultAccountId?: ObjectId | null;
    defaultCategoryId?: ObjectId | null;
  };
  createdAt: Date;
  updatedAt: Date;
};

export function toUserEntity(document: UserDocument): User {
  return {
    id: fromObjectId(document._id),
    email: document.email,
    name: document.name,
    currency: document.currency,
    timezone: document.timezone,
    settings: {
      defaultAccountId: optionalFromObjectId(document.settings?.defaultAccountId),
      defaultCategoryId: optionalFromObjectId(document.settings?.defaultCategoryId),
    },
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
  };
}

export function toUserCredentials(document: UserDocument): UserCredentials {
  return {
    userId: fromObjectId(document._id),
    email: document.email,
    passwordHash: document.passwordHash,
  };
}
