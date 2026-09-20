import { z } from "zod";
import { PAGINATION } from "@/config/constants";
import { clientIdString, isoDate, operationIdString } from "@/lib/validation/helpers";

/**
 * Sync protocol schemas.
 *
 * The **envelope** is validated here: operation id, type, client id, and the fact that
 * a payload is an object. The payload itself is validated by the schema belonging to
 * the operation being performed — `createPersonalExpenseSchema`, `createTransferSchema`
 * and so on — inside the push dispatcher.
 *
 * That split is deliberate. Re-declaring every payload shape here would create a second
 * definition of every command, and the two would drift; the first symptom would be an
 * operation the sync path accepts and the REST path rejects, or the reverse.
 */

const SYNC_OPERATION_TYPES = [
  "CREATE_ACCOUNT",
  "UPDATE_ACCOUNT",
  "ARCHIVE_ACCOUNT",
  "CREATE_PERSON",
  "UPDATE_PERSON",
  "ARCHIVE_PERSON",
  "CREATE_CATEGORY",
  "UPDATE_CATEGORY",
  "ARCHIVE_CATEGORY",
  "CREATE_EXPENSE",
  "CREATE_SHARED_EXPENSE",
  "UPDATE_EXPENSE",
  "DELETE_EXPENSE",
  "CREATE_TRANSFER",
  "UPDATE_TRANSFER",
  "DELETE_TRANSFER",
  "CREATE_CREDIT_CARD_PAYMENT",
  "DELETE_CREDIT_CARD_PAYMENT",
  "CREATE_SETTLEMENT",
  "DELETE_SETTLEMENT",
] as const;

export const syncOperationTypeSchema = z.enum(SYNC_OPERATION_TYPES);

export const syncPushOperationSchema = z.object({
  operationId: operationIdString,
  type: syncOperationTypeSchema,
  clientId: clientIdString,
  payload: z.record(z.string(), z.unknown()),
  /** Version the client based an update on, for conflict detection. */
  baseSyncVersion: z.coerce.number().int().min(1).optional(),
});

/**
 * A push carries a batch.
 *
 * Capped so a client that queued a month of offline activity cannot submit one request
 * the server must hold in memory all at once. The engine sends further batches until the
 * queue drains, and because every operation is idempotent, a batch that partly succeeds
 * is safe to re-send.
 */
export const syncPushRequestSchema = z.object({
  operations: z.array(syncPushOperationSchema).min(1).max(50),
});

export type SyncPushRequestInput = z.infer<typeof syncPushRequestSchema>;

export const syncPullQuerySchema = z.object({
  /** Opaque cursor from a previous pull. Absent means "from the beginning". */
  cursor: z.string().trim().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(PAGINATION.maxLimit).default(PAGINATION.defaultLimit),
  /** Escape hatch for a client rebuilding its local database. */
  since: isoDate.optional(),
});

export type SyncPullQueryInput = z.infer<typeof syncPullQuerySchema>;
