import { calculateAccountTotals, summariseAccounts } from "@/domain/accounts/calculations";
import {
  calculatePeopleTotals,
  calculatePersonBalanceFromObligations,
} from "@/domain/people/calculations";
import {
  calculateSpendingByCategory,
  calculateSpendingForMonth,
} from "@/domain/transactions/calculations";
import { formatMonthKey, formatMonthLabel, startOfMonthInTimezone } from "@/lib/dates";
import { addMonthsInTimezone } from "@/lib/dates";
import { subtractMoney } from "@/lib/money";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
import { expenseSplitRepository } from "@/server/repositories/mongo/expense-split-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { loadAccountMovements } from "@/server/services/accounts/account-balances";
import { listAccounts } from "@/server/services/accounts/account-service";
import { loadObligations } from "@/server/services/people/person-balances";
import { listPeople } from "@/server/services/people/person-service";
import { toAccountView } from "@/features/accounts/view-models/account-view-model";
import { toPersonView } from "@/features/people/view-models/person-view-model";
import { getSettlementListView } from "@/features/settlements/queries/settlement-queries";
import { getTransactionListView } from "@/features/transactions/queries/expense-queries";
import type {
  DashboardCategorySpending,
  DashboardSpending,
  DashboardView,
} from "../view-models/dashboard-view-model";
import {
  toDashboardPeopleTotals,
  toDashboardTotals,
  toMoneyFigure,
} from "../view-models/dashboard-view-model";

/**
 * Read model for the dashboard.
 *
 * Everything is recomputed from the source records on every request. There is no
 * cached total anywhere: a stored aggregate is the one number that can disagree with
 * the list it summarises, and the whole app is built to make that impossible
 * (docs/01-MVP-SCOPE.md section 4, docs/02-DATA-MODEL.md sections 20-21).
 *
 * The cost is a handful of full-collection reads per load, which is acceptable at MVP
 * scale (thousands of records - docs/07-MVP-IMPLEMENTATION-PLAN.md section 31). If it
 * stops being acceptable, the fix is a projection rebuilt from these same events, not
 * a mutable balance column.
 */

/** How many people to list per direction before the "see all" link takes over. */
const PEOPLE_LIMIT = 4;
const RECENT_TRANSACTION_LIMIT = 6;
const RECENT_SETTLEMENT_LIMIT = 4;
const TOP_CATEGORY_LIMIT = 4;

export async function getDashboardView(
  userId: string,
  currency: string,
  timezone: string,
  /** Injectable so tests are not tied to the clock. */
  now: Date = new Date(),
): Promise<DashboardView> {
  const [accounts, people, movements, obligationContext, recent, settlements] = await Promise.all([
    listAccounts(userId, { includeArchived: false }),
    listPeople(userId, { includeArchived: false }),
    loadAccountMovements(userId),
    loadObligations(userId),
    getTransactionListView(userId, timezone, { limit: RECENT_TRANSACTION_LIMIT }),
    getSettlementListView(userId, timezone, { limit: RECENT_SETTLEMENT_LIMIT }),
  ]);

  const summaries = summariseAccounts(accounts, movements);
  const accountViews = accounts.map((account) =>
    toAccountView(account, summaries.get(account.id)!),
  );

  const totals = calculateAccountTotals(accounts, movements, currency);

  // Person balances come from the obligations already loaded, so no person is queried
  // individually. Each balance is computed once and reused for both the per-person
  // rows and the receivable/payable totals, so the two cannot disagree.
  const { obligations } = obligationContext;
  const balances = people.map((person) => ({
    person,
    balance: calculatePersonBalanceFromObligations(person.id, obligations, currency),
  }));

  const personViews = balances.map((entry) => toPersonView(entry.person, entry.balance));
  const peopleTotals = calculatePeopleTotals(
    balances.map((entry) => entry.balance),
    currency,
  );

  const spending = await getDashboardSpending(userId, currency, timezone, now);

  return {
    currency,
    totals: toDashboardTotals(totals, accountViews),
    accounts: accountViews,
    people: toDashboardPeopleTotals(peopleTotals),
    peopleOwingUser: sortByOutstanding(
      personViews.filter((person) => person.balance.direction === "person_owes_user"),
    ).slice(0, PEOPLE_LIMIT),
    peopleUserOwes: sortByOutstanding(
      personViews.filter((person) => person.balance.direction === "user_owes_person"),
    ).slice(0, PEOPLE_LIMIT),
    spending,
    recentTransactions: recent.groups,
    recentAccountNames: recent.accountNames,
    recentCategoryNames: recent.categoryNames,
    recentPersonNames: recent.personNames,
    recentSettlements: settlements.items,
    // "Nothing recorded yet" is about activity, not about accounts: a user who has
    // added a bank account but no transactions still needs the onboarding prompt.
    isEmpty: recent.items.length === 0 && settlements.items.length === 0,
  };
}

/**
 * This month's spending, last month's, and the top categories.
 *
 * Months are boundaried in the **user's** timezone. Grouping in UTC would push a
 * late-evening expense into the wrong month for anyone east of UTC
 * (docs/02-DATA-MODEL.md section 27).
 */
async function getDashboardSpending(
  userId: string,
  currency: string,
  timezone: string,
  now: Date,
): Promise<DashboardSpending> {
  const monthStart = startOfMonthInTimezone(now, timezone);
  const previousMonthStart = addMonthsInTimezone(monthStart, -1, timezone);

  const [transactions, splits] = await Promise.all([
    transactionRepository().listForProjection(userId, { types: ["expense"] }),
    expenseSplitRepository().listAll(userId),
  ]);

  const total = calculateSpendingForMonth(transactions, splits, currency, timezone, now);
  const previousTotal = calculateSpendingForMonth(
    transactions,
    splits,
    currency,
    timezone,
    previousMonthStart,
  );

  // Only this month's expenses feed the category breakdown, so the figures agree with
  // the headline total above them.
  const monthKey = formatMonthKey(monthStart, timezone);
  const thisMonth = transactions.filter(
    (transaction) => formatMonthKey(transaction.date, timezone) === monthKey,
  );

  const byCategory = calculateSpendingByCategory(thisMonth, splits, currency).slice(
    0,
    TOP_CATEGORY_LIMIT,
  );

  const categoryIds = byCategory
    .map((entry) => entry.categoryId)
    .filter((id): id is string => id !== null);
  const categories = await categoryRepository().findManyByIds(userId, categoryIds);
  const categoryNames = new Map(categories.map((category) => [category.id, category.name]));
  // The same records already fetched for the names, so the swatch costs no extra query.
  const categoryIcons = new Map(categories.map((category) => [category.id, category.icon]));

  const topCategories: DashboardCategorySpending[] = byCategory.map((entry) => ({
    categoryId: entry.categoryId,
    name: entry.categoryId
      ? (categoryNames.get(entry.categoryId) ?? "Unknown category")
      : "Uncategorised",
    icon: entry.categoryId ? (categoryIcons.get(entry.categoryId) ?? null) : null,
    total: toMoneyFigure(entry.amount),
    transactionCount: entry.transactionCount,
  }));

  const difference = subtractMoney(total, previousTotal);

  return {
    monthKey,
    monthLabel: formatMonthLabel(monthStart, timezone),
    total: toMoneyFigure(total),
    previousTotal: toMoneyFigure(previousTotal),
    comparison: previousTotal.isZero()
      ? "no_previous"
      : difference.isZero()
        ? "same"
        : difference.isPositive()
          ? "more"
          : "less",
    difference: toMoneyFigure(difference.abs()),
    topCategories,
  };
}

/** Largest outstanding first: the balance most worth acting on goes at the top. */
function sortByOutstanding<T extends { balance: { netAbsolute: { amount: string } } }>(
  people: readonly T[],
): T[] {
  return [...people].sort(
    (a, b) => Number(b.balance.netAbsolute.amount) - Number(a.balance.netAbsolute.amount),
  );
}
