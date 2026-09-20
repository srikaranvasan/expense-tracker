import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import type { Money } from "@/lib/money";
import type { SettlementDirection } from "@/types/common";
import type { ChangeFeedQuery, CursorResult, RepositoryContext, SyncedCreateMeta } from "./common";

export type CreateSettlementInput = SyncedCreateMeta & {
  personId: string;
  direction: SettlementDirection;
  amount: Money;
  accountId?: string | null;
  date: Date;
  notes?: string | null;
};

export type CreateSettlementAllocationInput = SyncedCreateMeta & {
  settlementId: string;
  expenseSplitId: string;
  amount: Money;
};

export type ListSettlementsQuery = {
  cursor?: string;
  limit: number;
  personId?: string;
  from?: Date;
  to?: Date;
};

export interface SettlementRepository {
  findById(
    userId: string,
    settlementId: string,
    context?: RepositoryContext,
  ): Promise<Settlement | null>;
  findByClientId(
    userId: string,
    clientId: string,
    context?: RepositoryContext,
  ): Promise<Settlement | null>;
  list(userId: string, query: ListSettlementsQuery): Promise<CursorResult<Settlement>>;
  listByPerson(userId: string, personId: string): Promise<Settlement[]>;
  listAll(userId: string): Promise<Settlement[]>;
  create(
    userId: string,
    input: CreateSettlementInput,
    context?: RepositoryContext,
  ): Promise<Settlement>;
  softDelete(userId: string, settlementId: string, context?: RepositoryContext): Promise<void>;
  countByPerson(userId: string, personId: string): Promise<number>;
  countByAccount(userId: string, accountId: string): Promise<number>;
  changesSince(userId: string, query: ChangeFeedQuery): Promise<Settlement[]>;
}

export interface SettlementAllocationRepository {
  listBySettlement(
    userId: string,
    settlementId: string,
    context?: RepositoryContext,
  ): Promise<SettlementAllocation[]>;

  /**
   * Allocations against the given splits.
   *
   * Read inside the settlement transaction to compute the remaining amount from
   * current server state (docs/08-OFFLINE-SYNC.md section 34).
   */
  listBySplitIds(
    userId: string,
    splitIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<SettlementAllocation[]>;
  listAll(userId: string): Promise<SettlementAllocation[]>;
  createMany(
    userId: string,
    inputs: readonly CreateSettlementAllocationInput[],
    currency: string,
    context?: RepositoryContext,
  ): Promise<SettlementAllocation[]>;
  softDeleteBySettlement(
    userId: string,
    settlementId: string,
    context?: RepositoryContext,
  ): Promise<void>;
  countBySplitIds(
    userId: string,
    splitIds: readonly string[],
    context?: RepositoryContext,
  ): Promise<number>;
  changesSince(userId: string, query: ChangeFeedQuery): Promise<SettlementAllocation[]>;
}
