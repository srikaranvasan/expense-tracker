import type { Account } from "@/domain/accounts/entities";
import { assertValidAccountDraft } from "@/domain/accounts/rules";
import { InvalidAccountError } from "@/domain/shared/errors";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { Money } from "@/lib/money";
import type { AccountRepository } from "@/server/repositories/interfaces/account-repository";
import type { TransactionRepository } from "@/server/repositories/interfaces/transaction-repository";
import type { SettlementRepository } from "@/server/repositories/interfaces/settlement-repository";
import { accountRepository } from "@/server/repositories/mongo/account-repository";
import { settlementRepository } from "@/server/repositories/mongo/settlement-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import type { AccountType } from "@/types/common";

/**
 * Account use cases.
 *
 * Each function is an explicit business operation rather than a generic CRUD
 * passthrough, so the validation that belongs to each one has an obvious home
 * (docs/06-CODING-PRACTICES.md section 57).
 */

export type AccountServiceDependencies = {
  accounts: AccountRepository;
  transactions: TransactionRepository;
  settlements: SettlementRepository;
};

function defaultDependencies(): AccountServiceDependencies {
  return {
    accounts: accountRepository(),
    transactions: transactionRepository(),
    settlements: settlementRepository(),
  };
}

export type CreateAccountCommand = {
  clientId: string;
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: string;
  institutionName?: string | null;
  creditLimit?: string | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
};

export async function createAccount(
  userId: string,
  userCurrency: string,
  command: CreateAccountCommand,
  dependencies: AccountServiceDependencies = defaultDependencies(),
): Promise<Account> {
  const openingBalance = Money.of(command.openingBalance, command.currency);
  const creditLimit =
    command.creditLimit != null ? Money.of(command.creditLimit, command.currency) : null;

  assertValidAccountDraft(
    {
      type: command.type,
      currency: command.currency,
      openingBalance,
      creditLimit,
      statementDay: command.statementDay ?? null,
      paymentDueDay: command.paymentDueDay ?? null,
    },
    userCurrency,
  );

  const account = await dependencies.accounts.create(userId, {
    clientId: command.clientId,
    name: command.name,
    type: command.type,
    currency: command.currency,
    openingBalance,
    institutionName: command.institutionName ?? null,
    creditLimit,
    statementDay: command.statementDay ?? null,
    paymentDueDay: command.paymentDueDay ?? null,
  });

  logger.info("account created", {
    operation: "accounts.create",
    userId,
    entityType: "account",
    entityId: account.id,
  });

  return account;
}

export type UpdateAccountCommand = {
  name?: string;
  openingBalance?: string;
  institutionName?: string | null;
  creditLimit?: string | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
  expectedSyncVersion?: number;
};

export async function updateAccount(
  userId: string,
  accountId: string,
  userCurrency: string,
  command: UpdateAccountCommand,
  dependencies: AccountServiceDependencies = defaultDependencies(),
): Promise<Account> {
  const existing = await dependencies.accounts.findById(userId, accountId);
  if (!existing) throw new NotFoundError("Account");

  if (existing.archivedAt !== null) {
    throw new InvalidAccountError("Restore this account before editing it.", { accountId });
  }

  // The draft is validated as a whole - current values merged with the changes -
  // so a partial edit cannot leave the account in an invalid state.
  const openingBalance =
    command.openingBalance !== undefined
      ? Money.of(command.openingBalance, existing.currency)
      : existing.openingBalance;

  const creditLimit =
    command.creditLimit !== undefined
      ? command.creditLimit === null
        ? null
        : Money.of(command.creditLimit, existing.currency)
      : (existing.creditCard?.creditLimit ?? null);

  const statementDay =
    command.statementDay !== undefined
      ? command.statementDay
      : (existing.creditCard?.statementDay ?? null);

  const paymentDueDay =
    command.paymentDueDay !== undefined
      ? command.paymentDueDay
      : (existing.creditCard?.paymentDueDay ?? null);

  assertValidAccountDraft(
    {
      type: existing.type,
      currency: existing.currency,
      openingBalance,
      creditLimit,
      statementDay,
      paymentDueDay,
    },
    userCurrency,
  );

  const updated = await dependencies.accounts.update(userId, accountId, {
    ...(command.name !== undefined ? { name: command.name } : {}),
    ...(command.openingBalance !== undefined ? { openingBalance } : {}),
    ...(command.institutionName !== undefined ? { institutionName: command.institutionName } : {}),
    ...(existing.type === "credit_card"
      ? {
          ...(command.creditLimit !== undefined ? { creditLimit } : {}),
          ...(command.statementDay !== undefined ? { statementDay } : {}),
          ...(command.paymentDueDay !== undefined ? { paymentDueDay } : {}),
        }
      : {}),
    ...(command.expectedSyncVersion !== undefined
      ? { expectedSyncVersion: command.expectedSyncVersion }
      : {}),
  });

  logger.info("account updated", {
    operation: "accounts.update",
    userId,
    entityType: "account",
    entityId: accountId,
  });

  return updated;
}

/**
 * Archives an account.
 *
 * Archiving rather than deleting: the account is still referenced by every
 * transaction recorded against it, and destroying it would destroy financial
 * history (docs/10-API-CONTRACT.md section 5).
 */
export async function archiveAccount(
  userId: string,
  accountId: string,
  dependencies: AccountServiceDependencies = defaultDependencies(),
): Promise<Account> {
  const existing = await dependencies.accounts.findById(userId, accountId);
  if (!existing) throw new NotFoundError("Account");

  if (existing.archivedAt !== null) return existing;

  const account = await dependencies.accounts.archive(userId, accountId);

  const [transactionCount, settlementCount] = await Promise.all([
    dependencies.transactions.countByAccount(userId, accountId),
    dependencies.settlements.countByAccount(userId, accountId),
  ]);

  logger.info("account archived", {
    operation: "accounts.archive",
    userId,
    entityType: "account",
    entityId: accountId,
    transactionCount,
    settlementCount,
  });

  return account;
}

export async function restoreAccount(
  userId: string,
  accountId: string,
  dependencies: AccountServiceDependencies = defaultDependencies(),
): Promise<Account> {
  const existing = await dependencies.accounts.findById(userId, accountId);
  if (!existing) throw new NotFoundError("Account");

  return dependencies.accounts.restore(userId, accountId);
}

export async function listAccounts(
  userId: string,
  query: { type?: AccountType; includeArchived?: boolean } = {},
  dependencies: AccountServiceDependencies = defaultDependencies(),
): Promise<Account[]> {
  return dependencies.accounts.list(userId, query);
}

export async function getAccount(
  userId: string,
  accountId: string,
  dependencies: AccountServiceDependencies = defaultDependencies(),
): Promise<Account> {
  const account = await dependencies.accounts.findById(userId, accountId);
  if (!account) throw new NotFoundError("Account");
  return account;
}

/**
 * Resolves account references for another operation.
 *
 * Every id is verified to belong to the user and to be usable before any
 * financial record is written (docs/06-CODING-PRACTICES.md section 15).
 */
export async function resolveOwnedAccounts(
  userId: string,
  accountIds: readonly string[],
  dependencies: AccountServiceDependencies = defaultDependencies(),
): Promise<Map<string, Account>> {
  const unique = [...new Set(accountIds.filter(Boolean))];
  if (unique.length === 0) return new Map();

  const accounts = await dependencies.accounts.findManyByIds(userId, unique);
  const byId = new Map(accounts.map((account) => [account.id, account] as const));

  for (const id of unique) {
    if (!byId.has(id)) {
      // Missing or belonging to someone else - both are "not found" to this user.
      throw new InvalidAccountError("One of the selected accounts could not be found.", {
        accountId: id,
      });
    }
  }

  return byId;
}
