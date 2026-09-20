import type { ExpenseSplit, PaidBy, Transaction } from "@/domain/transactions/entities";
import type { Money } from "@/lib/money";
import type { ParticipantType, TransactionType } from "@/types/common";
import type {
  ChangeFeedQuery,
  CursorResult,
  OptimisticUpdateMeta,
  RepositoryContext,
  SyncedCreateMeta,
} from "./common";

export type CreateTransactionInput = SyncedCreateMeta & {
  type: TransactionType;
  amount: Money;
  description: string;
  date: Date;
  categoryId?: string | null;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  paidBy?: PaidBy | null;
  notes?: string | null;
};

export type UpdateTransactionInput = OptimisticUpdateMeta & {
  amount?: Money;
  description?: string;
  date?: Date;
  categoryId?: string | null;
  accountId?: string | null;
  fromAccountId?: string | null;
  toAccountId?: string | null;
  paidBy?: PaidBy | null;
  notes?: string | null;
};

export type CreateExpenseSplitInput = SyncedCreateMeta & {
  transactionId: string;
  participantType: ParticipantType;
  personId?: string | null;
  shareAmount: Money;
};

/**
 * Filters for the transaction list.
 *
 * `personId` matches transactions where that person has a split, which is how
 * "show me everything involving Arun" is answered.
 */
export type ListTransactionsQuery = {
  cursor?: string;
  limit: number;
  types?: TransactionType[];
  accountId?: string;
  categoryId?: string;
  personId?: string;
  from?: Date;
  to?: Date;
  search?: string;
  /** true = only shared expenses, false = only personal expenses. */
  shared?: boolean;
};

export interface TransactionRepository {
  findById(
    userId: string,
    transactionId: string,
    context?: RepositoryContext,
  ): Promise<Transaction | null>;
  findByClientId(
    userId: string,
    clientId: string,
    context?: RepositoryContext,
  ): Promise<Transaction | null>;
  /** Loads several transactions at once; missing or foreign ids are simply absent. */
  findManyByIds(
    userId: string,
    transactionIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<Transaction[]>;
  list(userId: string, query: ListTransactionsQuery): Promise<CursorResult<Transaction>>;
  /** All non-deleted transactions, used by the balance and spending projections. */
  listForProjection(
    userId: string,
    filter?: { from?: Date; to?: Date; types?: TransactionType[]; accountIds?: string[] },
  ): Promise<Transaction[]>;
  create(
    userId: string,
    input: CreateTransactionInput,
    context?: RepositoryContext,
  ): Promise<Transaction>;
  update(
    userId: string,
    transactionId: string,
    input: UpdateTransactionInput,
    context?: RepositoryContext,
  ): Promise<Transaction>;
  softDelete(userId: string, transactionId: string, context?: RepositoryContext): Promise<void>;
  countByAccount(userId: string, accountId: string): Promise<number>;
  countByCategory(userId: string, categoryId: string): Promise<number>;
  changesSince(userId: string, query: ChangeFeedQuery): Promise<Transaction[]>;
}

export interface ExpenseSplitRepository {
  findById(
    userId: string,
    splitId: string,
    context?: RepositoryContext,
  ): Promise<ExpenseSplit | null>;
  listByTransaction(
    userId: string,
    transactionId: string,
    context?: RepositoryContext,
  ): Promise<ExpenseSplit[]>;
  listByTransactions(userId: string, transactionIds: readonly string[]): Promise<ExpenseSplit[]>;
  findManyByIds(
    userId: string,
    splitIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<ExpenseSplit[]>;
  /** Splits belonging to a person, i.e. the amounts that person is responsible for. */
  listByPerson(userId: string, personId: string): Promise<ExpenseSplit[]>;
  /** Every split for the user, used by the balance projection. */
  listAll(userId: string): Promise<ExpenseSplit[]>;
  createMany(
    userId: string,
    inputs: readonly CreateExpenseSplitInput[],
    currency: string,
    context?: RepositoryContext,
  ): Promise<ExpenseSplit[]>;
  softDeleteByTransaction(
    userId: string,
    transactionId: string,
    context?: RepositoryContext,
  ): Promise<void>;
  /**
   * Bumps `updatedAt` and `syncVersion` on the given splits without changing them.
   *
   * Two purposes. It tells offline clients the split's settlement state changed, and -
   * critically - it makes concurrent settlements against the same split collide.
   * MongoDB's snapshot isolation does not prevent write skew: two transactions that
   * each read "nothing allocated yet" and then insert *different* allocation documents
   * do not conflict, and both would commit. Writing to the contended split row forces a
   * write conflict so one aborts and retries (docs/08-OFFLINE-SYNC.md section 34).
   */
  touchMany(
    userId: string,
    splitIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<void>;
  countByPerson(userId: string, personId: string): Promise<number>;
  changesSince(userId: string, query: ChangeFeedQuery): Promise<ExpenseSplit[]>;
}
