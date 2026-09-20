import type { Account } from "@/domain/accounts/entities";
import type { AccountBalanceSummary, AccountMovement } from "@/domain/accounts/calculations";
import {
  calculateAccountTotals,
  deriveAccountMovements,
  summariseAccount,
  summariseAccounts,
} from "@/domain/accounts/calculations";
import type { AccountTotals } from "@/domain/accounts/calculations";
import { settlementRepository } from "@/server/repositories/mongo/settlement-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import type { SettlementRepository } from "@/server/repositories/interfaces/settlement-repository";
import type { TransactionRepository } from "@/server/repositories/interfaces/transaction-repository";

/**
 * Loads the events that account balances are derived from.
 *
 * Kept separate from the account CRUD services because several features need the
 * same projection: account list, account details and the dashboard.
 */

export type BalanceDependencies = {
  transactions: TransactionRepository;
  settlements: SettlementRepository;
};

function defaultDependencies(): BalanceDependencies {
  return { transactions: transactionRepository(), settlements: settlementRepository() };
}

/**
 * Reads every non-deleted transaction and settlement for the user and converts
 * them to account movements.
 *
 * A full scan is acceptable at MVP scale (docs/07-MVP-IMPLEMENTATION-PLAN.md
 * section 31 targets thousands of records). If it stops being acceptable, the fix
 * is a cached projection rebuilt from these same events, not a mutable balance
 * field.
 */
export async function loadAccountMovements(
  userId: string,
  dependencies: BalanceDependencies = defaultDependencies(),
): Promise<AccountMovement[]> {
  const [transactions, settlements] = await Promise.all([
    dependencies.transactions.listForProjection(userId),
    dependencies.settlements.listAll(userId),
  ]);

  return deriveAccountMovements(transactions, settlements);
}

export async function getAccountSummary(
  userId: string,
  account: Account,
  dependencies?: BalanceDependencies,
): Promise<AccountBalanceSummary> {
  const movements = await loadAccountMovements(userId, dependencies);
  return summariseAccount(account, movements);
}

export async function getAccountSummaries(
  userId: string,
  accounts: readonly Account[],
  dependencies?: BalanceDependencies,
): Promise<Map<string, AccountBalanceSummary>> {
  const movements = await loadAccountMovements(userId, dependencies);
  return summariseAccounts(accounts, movements);
}

export async function getAccountTotals(
  userId: string,
  accounts: readonly Account[],
  currency: string,
  dependencies?: BalanceDependencies,
): Promise<AccountTotals> {
  const movements = await loadAccountMovements(userId, dependencies);
  return calculateAccountTotals(accounts, movements, currency);
}
