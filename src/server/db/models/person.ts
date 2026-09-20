import type { ObjectId } from "mongodb";
import type { Person } from "@/domain/people/entities";
import { fromObjectId } from "../object-id";

export type PersonDocument = {
  _id: ObjectId;
  userId: ObjectId;
  clientId: string;
  name: string;
  notes?: string | null;
  archivedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  syncVersion: number;
};

export function toPersonEntity(document: PersonDocument): Person {
  return {
    id: fromObjectId(document._id),
    userId: fromObjectId(document.userId),
    clientId: document.clientId,
    name: document.name,
    notes: document.notes ?? null,
    archivedAt: document.archivedAt ?? null,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    syncVersion: document.syncVersion,
  };
}
