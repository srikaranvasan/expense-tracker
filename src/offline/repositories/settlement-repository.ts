import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import { localDb } from "../db/client";
import {
  fromLocalSettlement,
  fromLocalSettlementAllocation,
  toLocalSettlement,
  toLocalSettlementAllocation,
} from "../db/record-mapping";
import type { LocalSettlement, LocalSettlementAllocation } from "../db/schema";
import type { LocalListOptions } from "./types";

/**
 * Local store for settlements and their allocations.
 *
 * Written together, always. A settlement with no allocations claims money changed
 * hands without saying which expense it paid, and balances derive from allocations
 * alone - so an unallocated settlement is invisible to every balance while still
 * looking real on screen (docs/08-OFFLINE-SYNC.md section 34).
 *
 * Note what this repository does **not** do: it never checks that an allocation fits
 * inside a split's remaining amount. That check has to run against current *server*
 * state, because another device may have settled the same split, and only the server
 * can see both (docs/08-OFFLINE-SYNC.md section 35).
 */

export type LocalSettlementWithAllocations = {
  settlement: LocalSettlement;
  allocations: LocalSettlementAllocation[];
};

export const localSettlementRepository = {
  async put(
    settlement: LocalSettlement,
    allocations: readonly LocalSettlementAllocation[],
  ): Promise<void> {
    const db = localDb();

    await db.transaction("rw", db.settlements, db.settlementAllocations, async () => {
      await db.settlements.put(settlement);
      await db.settlementAllocations
        .where("settlementClientId")
        .equals(settlement.clientId)
        .delete();
      if (allocations.length > 0) await db.settlementAllocations.bulkPut([...allocations]);
    });
  },

  async putMany(
    entries: ReadonlyArray<{
      settlement: Settlement;
      allocations: readonly SettlementAllocation[];
    }>,
  ): Promise<void> {
    const db = localDb();

    const settlements = entries.map((entry) => toLocalSettlement(entry.settlement));
    const allocations = entries.flatMap((entry) =>
      entry.allocations.map((allocation) =>
        toLocalSettlementAllocation(allocation, entry.settlement.clientId),
      ),
    );

    await db.transaction("rw", db.settlements, db.settlementAllocations, async () => {
      await db.settlements.bulkPut(settlements);
      for (const settlement of settlements) {
        await db.settlementAllocations
          .where("settlementClientId")
          .equals(settlement.clientId)
          .delete();
      }
      if (allocations.length > 0) await db.settlementAllocations.bulkPut(allocations);
    });
  },

  async findByClientId(
    userId: string,
    clientId: string,
  ): Promise<LocalSettlementWithAllocations | null> {
    const db = localDb();
    const settlement = await db.settlements.get(clientId);
    if (!settlement || settlement.userId !== userId) return null;

    const allocations = await db.settlementAllocations
      .where("settlementClientId")
      .equals(clientId)
      .toArray();

    return { settlement, allocations };
  },

  async list(
    userId: string,
    options: LocalListOptions & { personId?: string } = {},
  ): Promise<LocalSettlementWithAllocations[]> {
    const db = localDb();
    const records = await db.settlements.where("userId").equals(userId).toArray();
    const allocations = await db.settlementAllocations.where("userId").equals(userId).toArray();

    const bySettlement = new Map<string, LocalSettlementAllocation[]>();
    for (const allocation of allocations) {
      if (!options.includeDeleted && allocation.deletedAt !== null) continue;
      const bucket = bySettlement.get(allocation.settlementClientId);
      if (bucket) bucket.push(allocation);
      else bySettlement.set(allocation.settlementClientId, [allocation]);
    }

    return records
      .filter((record) => {
        if (!options.includeDeleted && record.deletedAt !== null) return false;
        if (options.personId && record.personId !== options.personId) return false;
        return true;
      })
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((settlement) => ({
        settlement,
        allocations: bySettlement.get(settlement.clientId) ?? [],
      }));
  },

  /** Domain entities for the settlements the server has accepted. */
  async listSynced(
    userId: string,
    options: LocalListOptions & { personId?: string } = {},
  ): Promise<Array<{ settlement: Settlement; allocations: SettlementAllocation[] }>> {
    const rows = await this.list(userId, options);

    return rows.flatMap((row) => {
      const settlement = fromLocalSettlement(row.settlement);
      if (!settlement) return [];

      return [
        {
          settlement,
          allocations: row.allocations
            .map(fromLocalSettlementAllocation)
            .filter((allocation): allocation is SettlementAllocation => allocation !== null),
        },
      ];
    });
  },

  async softDelete(userId: string, clientId: string, now: Date = new Date()): Promise<void> {
    const db = localDb();

    await db.transaction("rw", db.settlements, db.settlementAllocations, async () => {
      const settlement = await db.settlements.get(clientId);
      if (!settlement || settlement.userId !== userId) return;

      await db.settlements.put({
        ...settlement,
        deletedAt: now,
        localUpdatedAt: now,
        syncStatus: "pending",
      });

      const allocations = await db.settlementAllocations
        .where("settlementClientId")
        .equals(clientId)
        .toArray();

      await db.settlementAllocations.bulkPut(
        allocations.map((allocation) => ({ ...allocation, deletedAt: now, localUpdatedAt: now })),
      );
    });
  },

  async purgeUnsynced(userId: string, clientId: string): Promise<boolean> {
    const db = localDb();

    return db.transaction("rw", db.settlements, db.settlementAllocations, async () => {
      const settlement = await db.settlements.get(clientId);
      if (!settlement || settlement.userId !== userId) return false;
      if (settlement.serverId !== null) return false;

      await db.settlementAllocations.where("settlementClientId").equals(clientId).delete();
      await db.settlements.delete(clientId);
      return true;
    });
  },

  async clearForUser(userId: string): Promise<void> {
    const db = localDb();
    await db.transaction("rw", db.settlements, db.settlementAllocations, async () => {
      await db.settlements.where("userId").equals(userId).delete();
      await db.settlementAllocations.where("userId").equals(userId).delete();
    });
  },
};
