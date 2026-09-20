import type { User } from "@/domain/users/entities";
import { createCardPaymentSchema } from "@/features/transactions/schemas/card-payment-schemas";
import {
  createPersonalExpenseSchema,
  updatePersonalExpenseSchema,
} from "@/features/transactions/schemas/expense-schemas";
import { createSharedExpenseSchema } from "@/features/transactions/schemas/shared-expense-schemas";
import {
  createTransferSchema,
  updateTransferSchema,
} from "@/features/transactions/schemas/transfer-schemas";
import { createSettlementSchema } from "@/features/settlements/schemas/settlement-schemas";
import { ValidationError, fromZodError } from "@/lib/errors";
import { rejectClientUserId } from "@/server/auth/authorization";
import type { ZodType } from "zod";
import {
  createCardPayment,
  deleteCardPayment,
} from "@/server/services/transactions/card-payment-service";
import {
  createPersonalExpense,
  deleteExpense,
  updatePersonalExpense,
} from "@/server/services/transactions/expense-service";
import { createSharedExpense } from "@/server/services/transactions/shared-expense-service";
import {
  createTransfer,
  deleteTransfer,
  updateTransfer,
} from "@/server/services/transactions/transfer-service";
import {
  createSettlement,
  deleteSettlement,
} from "@/server/services/settlements/settlement-service";
import type { SyncEntityType, SyncPushOperation } from "@/types/sync";

/**
 * Maps a queued command onto the service that already implements it.
 *
 * This file contains **no business logic**, and that is the point. Every rule the sync
 * path enforces is a rule the REST path already enforced, because both call the same
 * service. A second implementation of "create a shared expense" for offline clients
 * would be a second set of financial rules to keep in step, and the one that drifted
 * would be the one nobody was testing (docs/08-OFFLINE-SYNC.md section 44).
 *
 * Payloads are validated with the same Zod schemas the REST routes use, for the same
 * reason.
 */

export type DispatchOutcome = {
  entityId: string;
  entityType: SyncEntityType;
};

/** Parses a payload with a route schema, reporting failures as validation errors. */
function parse<T>(schema: ZodType<T>, payload: unknown): T {
  const result = schema.safeParse(payload);
  if (!result.success) throw fromZodError(result.error);
  return result.data;
}

/**
 * A delete command carries the server id of the record to remove.
 *
 * Not the `clientId`: by the time a delete is queued the record exists on the server,
 * so its id is known. A delete for something never synced is discarded client-side
 * instead of being sent (docs/08-OFFLINE-SYNC.md section 33).
 */
function serverIdOf(payload: Record<string, unknown>): string {
  const id = payload.id;
  if (typeof id !== "string" || !/^[a-f\d]{24}$/i.test(id)) {
    throw new ValidationError("A delete operation must carry the record's server id.", {
      fieldErrors: { id: ["Must be a valid id."] },
    });
  }
  return id;
}

export async function dispatchSyncOperation(
  user: User,
  operation: SyncPushOperation,
): Promise<DispatchOutcome> {
  const payload = (operation.payload ?? {}) as Record<string, unknown>;

  /*
   * The one place a client-supplied `userId` could travel into the application.
   *
   * Sync payloads are validated as `z.record(z.string(), z.unknown())` at the envelope
   * level, so unlike a REST body they arrive here unfiltered. The command schemas below
   * strip unknown keys, which means a stray `userId` would be dropped silently — safe
   * today, and quietly unsafe the moment a service starts spreading a payload into a
   * write.
   *
   * Rejecting instead of stripping is what section 4 asks for: a request that names its own
   * user is either a bug or an attack, and both deserve to be visible.
   */
  rejectClientUserId(payload);

  switch (operation.type) {
    case "CREATE_EXPENSE": {
      const input = parse(createPersonalExpenseSchema, {
        ...payload,
        clientId: operation.clientId,
      });
      const { transaction } = await createPersonalExpense(user.id, user.currency, {
        clientId: input.clientId,
        ...(input.splitClientId ? { splitClientId: input.splitClientId } : {}),
        amount: input.amount,
        description: input.description,
        date: input.date,
        accountId: input.accountId,
        categoryId: input.categoryId ?? null,
        notes: input.notes ?? null,
      });
      return { entityId: transaction.id, entityType: "transaction" };
    }

    case "CREATE_SHARED_EXPENSE": {
      const input = parse(createSharedExpenseSchema, { ...payload, clientId: operation.clientId });
      const { transaction } = await createSharedExpense(user.id, user.currency, {
        clientId: input.clientId,
        amount: input.amount,
        description: input.description,
        date: input.date,
        accountId: input.accountId ?? null,
        categoryId: input.categoryId ?? null,
        notes: input.notes ?? null,
        paidByPersonId: input.paidByPersonId ?? null,
        splitMethod: input.splitMethod,
        participants: input.participants,
        ...(input.splitClientIds ? { splitClientIds: input.splitClientIds } : {}),
      });
      return { entityId: transaction.id, entityType: "transaction" };
    }

    case "UPDATE_EXPENSE": {
      const id = serverIdOf(payload);
      const input = parse(updatePersonalExpenseSchema, omitId(payload));
      const { transaction } = await updatePersonalExpense(user.id, id, user.currency, {
        ...input,
        // The version the client based its edit on. Absent means "no check", which is
        // only correct for a record the client just created.
        ...(operation.baseSyncVersion !== undefined
          ? { expectedSyncVersion: operation.baseSyncVersion }
          : {}),
      });
      return { entityId: transaction.id, entityType: "transaction" };
    }

    case "DELETE_EXPENSE": {
      const id = serverIdOf(payload);
      await deleteExpense(user.id, id);
      return { entityId: id, entityType: "transaction" };
    }

    case "CREATE_TRANSFER": {
      const input = parse(createTransferSchema, { ...payload, clientId: operation.clientId });
      const transfer = await createTransfer(user.id, user.currency, {
        clientId: input.clientId,
        amount: input.amount,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        date: input.date,
        description: input.description ?? null,
        notes: input.notes ?? null,
      });
      return { entityId: transfer.id, entityType: "transaction" };
    }

    case "UPDATE_TRANSFER": {
      const id = serverIdOf(payload);
      const input = parse(updateTransferSchema, omitId(payload));
      const transfer = await updateTransfer(user.id, id, user.currency, {
        ...input,
        ...(operation.baseSyncVersion !== undefined
          ? { expectedSyncVersion: operation.baseSyncVersion }
          : {}),
      });
      return { entityId: transfer.id, entityType: "transaction" };
    }

    case "DELETE_TRANSFER": {
      const id = serverIdOf(payload);
      await deleteTransfer(user.id, id);
      return { entityId: id, entityType: "transaction" };
    }

    case "CREATE_CREDIT_CARD_PAYMENT": {
      const input = parse(createCardPaymentSchema, { ...payload, clientId: operation.clientId });
      const payment = await createCardPayment(user.id, user.currency, {
        clientId: input.clientId,
        amount: input.amount,
        fromAccountId: input.fromAccountId,
        toAccountId: input.toAccountId,
        date: input.date,
        description: input.description ?? null,
        notes: input.notes ?? null,
      });
      return { entityId: payment.id, entityType: "transaction" };
    }

    case "DELETE_CREDIT_CARD_PAYMENT": {
      const id = serverIdOf(payload);
      await deleteCardPayment(user.id, id);
      return { entityId: id, entityType: "transaction" };
    }

    case "CREATE_SETTLEMENT": {
      const input = parse(createSettlementSchema, { ...payload, clientId: operation.clientId });
      const { settlement } = await createSettlement(user.id, user.currency, {
        clientId: input.clientId,
        personId: input.personId,
        direction: input.direction,
        amount: input.amount,
        accountId: input.accountId ?? null,
        date: input.date,
        notes: input.notes ?? null,
        allocations: input.allocations,
        ...(input.allocationClientIds ? { allocationClientIds: input.allocationClientIds } : {}),
      });
      return { entityId: settlement.id, entityType: "settlement" };
    }

    case "DELETE_SETTLEMENT": {
      const id = serverIdOf(payload);
      await deleteSettlement(user.id, id);
      return { entityId: id, entityType: "settlement" };
    }

    default:
      // Reference data (accounts, people, categories) is created online in the MVP, so
      // those command types are reserved but not yet routed. A clear rejection beats a
      // silent success that never wrote anything.
      throw new ValidationError(
        `Sync operation "${operation.type}" is not supported yet. Create this record while online.`,
        { fieldErrors: { type: ["Unsupported operation."] } },
      );
  }
}

/** Removes the routing id so the rest of the payload can be schema-checked. */
function omitId(payload: Record<string, unknown>): Record<string, unknown> {
  const { id: _id, ...rest } = payload;
  return rest;
}
