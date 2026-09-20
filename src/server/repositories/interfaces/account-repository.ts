import type { Account } from "@/domain/accounts/entities";
import type { Money } from "@/lib/money";
import type { AccountType } from "@/types/common";
import type {
  ChangeFeedQuery,
  OptimisticUpdateMeta,
  RepositoryContext,
  SyncedCreateMeta,
} from "./common";

export type CreateAccountInput = SyncedCreateMeta & {
  name: string;
  type: AccountType;
  currency: string;
  openingBalance: Money;
  institutionName?: string | null;
  creditLimit?: Money | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
};

export type UpdateAccountInput = OptimisticUpdateMeta & {
  name?: string;
  openingBalance?: Money;
  institutionName?: string | null;
  creditLimit?: Money | null;
  statementDay?: number | null;
  paymentDueDay?: number | null;
};

export type ListAccountsQuery = {
  type?: AccountType;
  includeArchived?: boolean;
};

export interface AccountRepository {
  findById(userId: string, accountId: string, context?: RepositoryContext): Promise<Account | null>;
  findByClientId(userId: string, clientId: string): Promise<Account | null>;
  /** Loads several accounts at once; missing or foreign ids are simply absent. */
  findManyByIds(userId: string, accountIds: readonly string[]): Promise<Account[]>;
  list(userId: string, query?: ListAccountsQuery): Promise<Account[]>;
  create(userId: string, input: CreateAccountInput, context?: RepositoryContext): Promise<Account>;
  update(userId: string, accountId: string, input: UpdateAccountInput): Promise<Account>;
  archive(userId: string, accountId: string): Promise<Account>;
  restore(userId: string, accountId: string): Promise<Account>;
  countAll(userId: string): Promise<number>;
  /** Records changed since a sync cursor, for the pull endpoint. */
  changesSince(userId: string, query: ChangeFeedQuery): Promise<Account[]>;
}
