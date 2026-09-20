import type { ListTransactionsQuery } from "@/server/repositories/interfaces/transaction-repository";
import { accountRepository } from "@/server/repositories/mongo/account-repository";
import { getTransfer, listTransfers } from "@/server/services/transactions/transfer-service";
import type { TransferDetailView, TransferListItem } from "../view-models/transfer-view-model";
import { toTransferDetailView, toTransferListItem } from "../view-models/transfer-view-model";

/**
 * Read models for the transfer screens.
 *
 * Account names are resolved in one batch per page rather than per row, so a
 * fifty-row page does not issue a hundred lookups for its two account columns.
 */

export type TransferListView = {
  items: TransferListItem[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Account names by id, covering both sides of every row. */
  accountNames: Record<string, string>;
};

export async function getTransferListView(
  userId: string,
  timezone: string,
  query: Omit<ListTransactionsQuery, "types">,
): Promise<TransferListView> {
  const page = await listTransfers(userId, query);

  const accountIds = new Set<string>();
  for (const transfer of page.items) {
    if (transfer.fromAccountId) accountIds.add(transfer.fromAccountId);
    if (transfer.toAccountId) accountIds.add(transfer.toAccountId);
  }

  const accounts = await accountRepository().findManyByIds(userId, [...accountIds]);

  return {
    items: page.items.map((transfer) => toTransferListItem(transfer, timezone)),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    accountNames: Object.fromEntries(accounts.map((account) => [account.id, account.name])),
  };
}

export async function getTransferDetailView(
  userId: string,
  transferId: string,
  timezone: string,
): Promise<TransferDetailView> {
  const transfer = await getTransfer(userId, transferId);

  const accountIds = [transfer.fromAccountId, transfer.toAccountId].filter(
    (id): id is string => id !== null,
  );
  const accounts = await accountRepository().findManyByIds(userId, accountIds);
  const byId = new Map(accounts.map((account) => [account.id, account.name] as const));

  return toTransferDetailView(transfer, {
    timezone,
    fromAccountName: transfer.fromAccountId ? (byId.get(transfer.fromAccountId) ?? null) : null,
    toAccountName: transfer.toAccountId ? (byId.get(transfer.toAccountId) ?? null) : null,
  });
}
