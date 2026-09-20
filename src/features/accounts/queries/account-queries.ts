import { summariseAccount } from "@/domain/accounts/calculations";
import { NotFoundError } from "@/lib/errors";
import {
  getAccountSummaries,
  loadAccountMovements,
} from "@/server/services/accounts/account-balances";
import { getAccount, listAccounts } from "@/server/services/accounts/account-service";
import type { AccountOption, AccountView } from "../view-models/account-view-model";
import { toAccountOption, toAccountView } from "../view-models/account-view-model";

/**
 * Read models for the account server components.
 *
 * Pages call these instead of touching repositories, which keeps the balance
 * projection in one place.
 */

export async function getAccountListView(
  userId: string,
  options: { includeArchived?: boolean } = {},
): Promise<AccountView[]> {
  const accounts = await listAccounts(userId, {
    includeArchived: options.includeArchived ?? false,
  });

  const summaries = await getAccountSummaries(userId, accounts);

  return accounts.map((account) => toAccountView(account, summaries.get(account.id)!));
}

export async function getAccountDetailView(
  userId: string,
  accountId: string,
): Promise<AccountView> {
  const account = await getAccount(userId, accountId);
  if (!account) throw new NotFoundError("Account");

  const movements = await loadAccountMovements(userId);
  return toAccountView(account, summariseAccount(account, movements));
}

/** Active accounts only: an archived account must not be selectable. */
export async function getAccountOptions(userId: string): Promise<AccountOption[]> {
  const accounts = await listAccounts(userId, { includeArchived: false });
  const summaries = await getAccountSummaries(userId, accounts);

  return accounts.map((account) => toAccountOption(account, summaries.get(account.id)!));
}
