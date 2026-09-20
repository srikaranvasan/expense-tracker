import type { ObjectId } from "mongodb";
import type { Category, CategoryKind } from "@/domain/categories/entities";
import { fromObjectId, optionalFromObjectId } from "../object-id";

export type CategoryDocument = {
  _id: ObjectId;
  userId: ObjectId;
  clientId: string;
  name: string;
  icon?: string | null;
  /** One level of nesting: a child category points at its parent. */
  parentId?: ObjectId | null;
  kind: CategoryKind;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
};

export function toCategoryEntity(document: CategoryDocument): Category {
  return {
    id: fromObjectId(document._id),
    userId: fromObjectId(document.userId),
    clientId: document.clientId,
    name: document.name,
    icon: document.icon ?? null,
    parentId: optionalFromObjectId(document.parentId),
    kind: document.kind,
    archivedAt: document.archivedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    syncVersion: document.syncVersion,
  };
}
