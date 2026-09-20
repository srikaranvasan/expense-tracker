import { collections } from "@/server/db/collections";
import { owned } from "@/server/db/conventions";
import type { SyncOperationDocument } from "@/server/db/models/sync-operation";
import { toSyncOperationRecord } from "@/server/db/models/sync-operation";
import { newObjectId, toObjectId } from "@/server/db/object-id";
import { isDuplicateKeyError } from "@/server/errors/api-error";
import type { RepositoryContext } from "../interfaces/common";
import type {
  ClaimOperationInput,
  ClaimOperationResult,
  SyncOperationRepository,
} from "../interfaces/sync-operation-repository";

function sessionOf(context?: RepositoryContext) {
  return context?.session ? { session: context.session } : {};
}

export class MongoSyncOperationRepository implements SyncOperationRepository {
  /**
   * Attempts to take ownership of an operation.
   *
   * The insert is the lock: if the unique `(userId, operationId)` index rejects it,
   * this operation has already been seen and the stored result is replayed. Doing
   * a read-then-write instead would leave a window where two concurrent pushes
   * both believe they are first.
   */
  async claim(
    userId: string,
    input: ClaimOperationInput,
    context?: RepositoryContext,
  ): Promise<ClaimOperationResult> {
    const operations = await collections.syncOperations();

    const document: SyncOperationDocument = {
      _id: newObjectId(),
      userId: toObjectId(userId),
      operationId: input.operationId,
      operationType: input.operationType,
      clientId: input.clientId,
      status: "processing",
      result: null,
      errorCode: null,
      createdAt: new Date(),
      completedAt: null,
    };

    try {
      await operations.insertOne(document, sessionOf(context));
      return { status: "claimed" };
    } catch (error) {
      if (!isDuplicateKeyError(error)) throw error;

      const existing = await operations.findOne({
        ...owned(userId),
        operationId: input.operationId,
      });
      if (!existing) {
        // Vanished between the failed insert and this read; treat as claimable.
        return { status: "claimed" };
      }

      return { status: "duplicate", record: toSyncOperationRecord(existing) };
    }
  }

  async complete(
    userId: string,
    operationId: string,
    result: { entityId: string; entityType: string },
    context?: RepositoryContext,
  ): Promise<void> {
    const operations = await collections.syncOperations();
    await operations.updateOne(
      { ...owned(userId), operationId },
      { $set: { status: "completed", result, completedAt: new Date(), errorCode: null } },
      sessionOf(context),
    );
  }

  async fail(userId: string, operationId: string, errorCode: string): Promise<void> {
    const operations = await collections.syncOperations();
    await operations.updateOne(
      { ...owned(userId), operationId },
      { $set: { status: "failed", errorCode, completedAt: new Date() } },
    );
  }

  /**
   * Deletes the claim.
   *
   * Used when the failure was transient, so the client's next retry is treated as
   * a fresh attempt rather than a duplicate of a permanently failed one.
   */
  async release(userId: string, operationId: string): Promise<void> {
    const operations = await collections.syncOperations();
    await operations.deleteOne({ ...owned(userId), operationId, status: "processing" });
  }

  async find(userId: string, operationId: string) {
    const operations = await collections.syncOperations();
    const document = await operations.findOne({ ...owned(userId), operationId });
    return document ? toSyncOperationRecord(document) : null;
  }
}

let instance: MongoSyncOperationRepository | null = null;

export function syncOperationRepository(): SyncOperationRepository {
  instance ??= new MongoSyncOperationRepository();
  return instance;
}
