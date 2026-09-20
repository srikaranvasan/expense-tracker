import { assertValidExpenseAmount, assertValidDescription } from "@/domain/transactions/rules";
import { Money } from "@/lib/money";
import { newClientId, newOperationId } from "@/lib/utils/client-id";
import { isOfflineStorageAvailable, localDb } from "../db/client";
import { pendingMeta } from "../db/record-mapping";
import type { LocalExpenseSplit, LocalTransaction } from "../db/schema";
import { getDeviceId } from "../repositories/sync-metadata-repository";

/**
 * Saves an expense locally and queues it for the server, atomically.
 *
 * This is the offline write path. The record and its sync operation are written in **one
 * IndexedDB transaction**, because the alternative has a failure mode that loses money:
 * save the expense, browser dies, operation never queued, and the user has an expense
 * that can never reach the server and no indication anything is wrong
 * (docs/08-OFFLINE-SYNC.md section 9).
 *
 * Validation happens before the write, using the **same domain rules the server uses**.
 * Queueing something the server will certainly reject just moves the error to a moment
 * when the user is no longer looking at the form.
 */

export type QueueExpenseInput = {
  userId: string;
  currency: string;
  clientId: string;
  splitClientId?: string;
  amount: string;
  description: string;
  /** Local date from the form, already a `Date`. */
  date: Date;
  accountId: string;
  categoryId: string | null;
  notes: string | null;
};

export type QueueExpenseResult =
  | { ok: true; clientId: string; operationId: string }
  | { ok: false; message: string; field?: string };

export async function queueExpenseOffline(input: QueueExpenseInput): Promise<QueueExpenseResult> {
  if (!isOfflineStorageAvailable()) {
    return {
      ok: false,
      message: "This device cannot save expenses offline. Reconnect and try again.",
    };
  }

  // The same rules the server would apply, so the user is told now rather than after a
  // failed sync they are not watching.
  let amount: Money;
  try {
    amount = Money.of(input.amount, input.currency);
    assertValidExpenseAmount(amount);
  } catch (error) {
    return {
      ok: false,
      field: "amount",
      message: error instanceof Error ? error.message : "Enter a valid amount.",
    };
  }

  let description: string;
  try {
    description = assertValidDescription(input.description);
  } catch (error) {
    return {
      ok: false,
      field: "description",
      message: error instanceof Error ? error.message : "Enter a description.",
    };
  }

  const now = new Date();
  const meta = pendingMeta({ clientId: input.clientId, userId: input.userId, now });

  const transaction: LocalTransaction = {
    ...meta,
    type: "expense",
    amount: amount.toJSON(),
    description,
    date: input.date,
    categoryId: input.categoryId,
    accountId: input.accountId,
    fromAccountId: null,
    toAccountId: null,
    paidByType: "user",
    paidByPersonId: null,
    notes: input.notes,
  };

  // A personal expense still gets one split for the full amount, so the invariant
  // "active splits sum to the transaction amount" holds locally exactly as it does on
  // the server.
  const split: LocalExpenseSplit = {
    ...pendingMeta({
      clientId: input.splitClientId ?? newClientId(),
      userId: input.userId,
      now,
    }),
    transactionClientId: input.clientId,
    transactionId: null,
    participantType: "user",
    personId: null,
    shareAmount: amount.toJSON(),
  };

  const operationId = newOperationId();
  const db = localDb();

  await db.transaction("rw", db.transactions, db.expenseSplits, db.syncOperations, async () => {
    await db.transactions.put(transaction);
    await db.expenseSplits.where("transactionClientId").equals(input.clientId).delete();
    await db.expenseSplits.put(split);

    await db.syncOperations.put({
      operationId,
      userId: input.userId,
      type: "CREATE_EXPENSE",
      clientId: input.clientId,
      // Built now, in the shape the API expects. Dates become ISO strings because that
      // is what crosses the wire, and amounts stay decimal strings throughout.
      payload: {
        amount: amount.amount.toFixed(),
        description,
        date: input.date.toISOString(),
        accountId: input.accountId,
        categoryId: input.categoryId,
        notes: input.notes,
        splitClientId: split.clientId,
      },
      status: "pending",
      retryCount: 0,
      nextRetryAt: null,
      lastError: null,
      lastErrorCode: null,
      lastAttemptAt: null,
      deviceId: getDeviceId(),
      createdAt: now,
      updatedAt: now,
    });
  });

  return { ok: true, clientId: input.clientId, operationId };
}
