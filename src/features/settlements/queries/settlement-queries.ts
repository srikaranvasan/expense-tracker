import { unsettledObligationsFor } from "@/domain/people/calculations";
import { sumMoney } from "@/lib/money";
import { accountRepository } from "@/server/repositories/mongo/account-repository";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { personRepository } from "@/server/repositories/mongo/person-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { loadObligations } from "@/server/services/people/person-balances";
import { getPerson } from "@/server/services/people/person-service";
import { getSettlement, listSettlements } from "@/server/services/settlements/settlement-service";
import type { ListSettlementsQuery } from "@/server/repositories/interfaces/settlement-repository";
import type {
  SettlementDetailView,
  SettlementView,
  SettleUpView,
} from "../view-models/settlement-view-model";
import {
  toSettleableObligationView,
  toSettlementDetailView,
  toSettlementView,
} from "../view-models/settlement-view-model";

/** Read models for the settlement screens. */

/**
 * Builds the settle-up view for one person.
 *
 * A person can owe the user and be owed at the same time, so both directions are
 * returned. The primary direction is whichever has more outstanding, because that is
 * almost always the settlement the user came to record.
 */
export async function getSettleUpView(
  userId: string,
  personId: string,
  currency: string,
  timezone: string,
): Promise<SettleUpView> {
  const person = await getPerson(userId, personId);
  const { obligations } = await loadObligations(userId);

  const owedToUser = unsettledObligationsFor(personId, obligations, "person_owes_user");
  const owedByUser = unsettledObligationsFor(personId, obligations, "user_owes_person");

  const owedToUserTotal = sumMoney(
    owedToUser.map((obligation) => obligation.remainingAmount),
    currency,
  );
  const owedByUserTotal = sumMoney(
    owedByUser.map((obligation) => obligation.remainingAmount),
    currency,
  );

  // Oldest first, matching how a payment is spread across obligations.
  const byOldest = <T extends { date: Date }>(list: readonly T[]) =>
    [...list].sort((a, b) => a.date.getTime() - b.date.getTime());

  const userIsOwedMore = owedToUserTotal.amount.greaterThanOrEqualTo(owedByUserTotal.amount);

  const primary = userIsOwedMore ? owedToUser : owedByUser;
  const secondary = userIsOwedMore ? owedByUser : owedToUser;
  const primaryTotal = userIsOwedMore ? owedToUserTotal : owedByUserTotal;
  const secondaryTotal = userIsOwedMore ? owedByUserTotal : owedToUserTotal;

  const primaryDirection = userIsOwedMore ? "person_to_user" : "user_to_person";
  const secondaryDirection = userIsOwedMore ? "user_to_person" : "person_to_user";

  return {
    personId,
    personName: person.name,
    currency,
    direction: primaryTotal.isPositive() ? primaryDirection : null,
    directionLabel:
      primaryDirection === "person_to_user" ? `${person.name} pays you` : `You pay ${person.name}`,
    outstanding: primaryTotal.toJSON(),
    formattedOutstanding: primaryTotal.toFixedString(),
    obligations: byOldest(primary).map((obligation) =>
      toSettleableObligationView(obligation, timezone),
    ),
    reverseDirection: secondaryTotal.isPositive() ? secondaryDirection : null,
    reverseOutstanding: secondaryTotal.isPositive() ? secondaryTotal.toJSON() : null,
    reverseObligations: byOldest(secondary).map((obligation) =>
      toSettleableObligationView(obligation, timezone),
    ),
  };
}

export async function getSettlementListView(
  userId: string,
  timezone: string,
  query: ListSettlementsQuery,
): Promise<{ items: SettlementView[]; nextCursor: string | null; hasMore: boolean }> {
  const page = await listSettlements(userId, query);

  const personIds = [...new Set(page.items.map((settlement) => settlement.personId))];
  const accountIds = [
    ...new Set(page.items.map((settlement) => settlement.accountId).filter(Boolean)),
  ] as string[];

  const [people, accounts] = await Promise.all([
    personRepository().findManyByIds(userId, personIds),
    accountRepository().findManyByIds(userId, accountIds),
  ]);

  const personNames = new Map(people.map((person) => [person.id, person.name] as const));
  const accountNames = new Map(accounts.map((account) => [account.id, account.name] as const));

  return {
    items: page.items.map((settlement) =>
      toSettlementView(settlement, {
        timezone,
        personName: personNames.get(settlement.personId) ?? "Someone",
        accountName: settlement.accountId ? (accountNames.get(settlement.accountId) ?? null) : null,
      }),
    ),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function getSettlementDetailView(
  userId: string,
  settlementId: string,
  timezone: string,
): Promise<SettlementDetailView> {
  const { settlement, allocations } = await getSettlement(userId, settlementId);

  // Each allocation points at a split; the expense description lives on the split's
  // transaction, so both are resolved to make the detail view readable.
  const splits = await expenseSplitRepository().findManyByIds(
    userId,
    allocations.map((allocation) => allocation.expenseSplitId),
  );

  const transactions = await transactionRepository().findManyByIds(userId, [
    ...new Set(splits.map((split) => split.transactionId)),
  ]);
  const transactionsById = new Map(
    transactions.map((transaction) => [transaction.id, transaction] as const),
  );

  const expensesBySplitId = new Map(
    splits.flatMap((split) => {
      const transaction = transactionsById.get(split.transactionId);
      if (!transaction) return [];
      return [
        [
          split.id,
          {
            transactionId: transaction.id,
            description: transaction.description,
            date: transaction.date,
          },
        ] as const,
      ];
    }),
  );

  const [person, account] = await Promise.all([
    getPerson(userId, settlement.personId),
    settlement.accountId
      ? accountRepository().findById(userId, settlement.accountId)
      : Promise.resolve(null),
  ]);

  return toSettlementDetailView(settlement, allocations, {
    timezone,
    personName: person.name,
    accountName: account?.name ?? null,
    expensesBySplitId,
  });
}
