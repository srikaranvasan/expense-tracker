import type { ListTransactionsQuery } from "@/server/repositories/interfaces/transaction-repository";
import { accountRepository } from "@/server/repositories/mongo/account-repository";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
import { personRepository } from "@/server/repositories/mongo/person-repository";
import { getExpense, listExpenses } from "@/server/services/transactions/expense-service";
import type {
  ExpenseDetailView,
  TransactionDayGroup,
  TransactionListItem,
} from "../view-models/expense-view-model";
import {
  groupByDay,
  toExpenseDetailView,
  toTransactionListItem,
} from "../view-models/expense-view-model";
import { getSettlementStatusForTransactions } from "./settlement-status";

/**
 * Read models for the transaction screens.
 *
 * Names for accounts, categories and people are resolved here in one batch per list
 * page rather than per row, so a fifty-row page does not issue fifty lookups.
 */

export type TransactionListView = {
  items: TransactionListItem[];
  groups: TransactionDayGroup[];
  nextCursor: string | null;
  hasMore: boolean;
  /** Lookup maps so a row can show a name without another query. */
  accountNames: Record<string, string>;
  categoryNames: Record<string, string>;
  personNames: Record<string, string>;
  /**
   * `Category.icon` by id, for the activity row's type swatch.
   *
   * A lookup map beside the names rather than a field on the item, for the same reason: the icon
   * belongs to the category, and duplicating it onto every row that shares one would be a second
   * copy to keep honest. Carried unresolved — `features/categories/icon-map.ts` is the only place
   * that decides what an icon string means.
   */
  categoryIcons: Record<string, string | null>;
};

export async function getTransactionListView(
  userId: string,
  timezone: string,
  query: ListTransactionsQuery,
): Promise<TransactionListView> {
  const page = await listExpenses(userId, query);

  // One batched lookup for the whole page rather than one per row.
  const settlements = await getSettlementStatusForTransactions(userId, page.items, page.splits);

  const items = page.items.map((transaction) =>
    toTransactionListItem(transaction, page.splits, timezone, settlements.get(transaction.id)),
  );

  const accountIds = new Set<string>();
  const categoryIds = new Set<string>();
  const personIds = new Set<string>();

  for (const transaction of page.items) {
    for (const id of [transaction.accountId, transaction.fromAccountId, transaction.toAccountId]) {
      if (id) accountIds.add(id);
    }
    if (transaction.categoryId) categoryIds.add(transaction.categoryId);
    if (transaction.paidBy?.type === "person") personIds.add(transaction.paidBy.personId);
  }

  for (const split of page.splits) {
    if (split.personId) personIds.add(split.personId);
  }

  const [accounts, categories, people] = await Promise.all([
    accountRepository().findManyByIds(userId, [...accountIds]),
    categoryRepository().findManyByIds(userId, [...categoryIds]),
    personRepository().findManyByIds(userId, [...personIds]),
  ]);

  return {
    items,
    groups: groupByDay(items),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    accountNames: Object.fromEntries(accounts.map((account) => [account.id, account.name])),
    categoryNames: Object.fromEntries(categories.map((category) => [category.id, category.name])),
    personNames: Object.fromEntries(people.map((person) => [person.id, person.name])),
    // From the same records as the names, so the swatch costs no extra query.
    categoryIcons: Object.fromEntries(categories.map((category) => [category.id, category.icon])),
  };
}

export async function getExpenseDetailView(
  userId: string,
  expenseId: string,
  timezone: string,
): Promise<ExpenseDetailView> {
  const { transaction, splits } = await getExpense(userId, expenseId);

  const settlements = await getSettlementStatusForTransactions(userId, [transaction], splits);

  const personIds = new Set<string>();
  if (transaction.paidBy?.type === "person") personIds.add(transaction.paidBy.personId);
  for (const split of splits) {
    if (split.personId) personIds.add(split.personId);
  }

  const [account, category, people] = await Promise.all([
    transaction.accountId
      ? accountRepository().findById(userId, transaction.accountId)
      : Promise.resolve(null),
    transaction.categoryId
      ? categoryRepository().findById(userId, transaction.categoryId)
      : Promise.resolve(null),
    personRepository().findManyByIds(userId, [...personIds]),
  ]);

  return toExpenseDetailView(transaction, splits, {
    timezone,
    accountName: account?.name ?? null,
    categoryName: category?.name ?? null,
    personNames: new Map(people.map((person) => [person.id, person.name] as const)),
    ...(settlements.get(transaction.id) ? { settlement: settlements.get(transaction.id)! } : {}),
  });
}
