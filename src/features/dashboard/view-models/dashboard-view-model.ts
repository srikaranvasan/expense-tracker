import type { AccountTotals } from "@/domain/accounts/calculations";
import type { PeopleTotals } from "@/domain/people/calculations";
import type { Money } from "@/lib/money";
import { formatMoney } from "@/lib/money";
import type { MoneyDto } from "@/types/common";
import type { AccountView } from "@/features/accounts/view-models/account-view-model";
import type { PersonView } from "@/features/people/view-models/person-view-model";
import type { SettlementView } from "@/features/settlements/view-models/settlement-view-model";
import type { TransactionDayGroup } from "@/features/transactions/view-models/expense-view-model";

/**
 * Dashboard view model.
 *
 * Every figure here is **derived**, and the dashboard is where that discipline pays
 * off: a stored "total spending" field would be the first thing to disagree with the
 * transaction list after an edit (docs/01-MVP-SCOPE.md section 4). Nothing on this
 * screen is read from a cached aggregate.
 */

export type MoneyFigure = {
  amount: MoneyDto;
  formatted: string;
};

export function toMoneyFigure(value: Money): MoneyFigure {
  return { amount: value.toJSON(), formatted: formatMoney(value) };
}

export type DashboardTotals = {
  /** Bank plus cash. */
  liquidBalance: MoneyFigure;
  creditCardOutstanding: MoneyFigure;
  availableCredit: MoneyFigure;
  /** Liquid minus card debt. */
  netPosition: MoneyFigure;
  /** True when any card is over its limit, so the UI can say so once. */
  anyCardOverLimit: boolean;
  /** True when the user has no credit cards, so those tiles are hidden. */
  hasCreditCards: boolean;
};

export function toDashboardTotals(
  totals: AccountTotals,
  accounts: readonly AccountView[],
): DashboardTotals {
  const cards = accounts.filter((account) => account.type === "credit_card");

  return {
    liquidBalance: toMoneyFigure(totals.liquidBalance),
    creditCardOutstanding: toMoneyFigure(totals.creditCardOutstanding),
    availableCredit: toMoneyFigure(totals.availableCredit),
    netPosition: toMoneyFigure(totals.netPosition),
    anyCardOverLimit: cards.some((card) => card.overLimit),
    hasCreditCards: cards.length > 0,
  };
}

export type DashboardPeopleTotals = {
  peopleOweUser: MoneyFigure;
  userOwesPeople: MoneyFigure;
  /** Signed: positive when the user is owed more than they owe. */
  net: MoneyFigure;
  isSettled: boolean;
};

export function toDashboardPeopleTotals(totals: PeopleTotals): DashboardPeopleTotals {
  return {
    peopleOweUser: toMoneyFigure(totals.peopleOweUser),
    userOwesPeople: toMoneyFigure(totals.userOwesPeople),
    net: toMoneyFigure(totals.net),
    isSettled: totals.peopleOweUser.isZero() && totals.userOwesPeople.isZero(),
  };
}

export type DashboardSpending = {
  /** `YYYY-MM` in the user's timezone. */
  monthKey: string;
  monthLabel: string;
  total: MoneyFigure;
  /** The same month last month, for a plain-language comparison. */
  previousTotal: MoneyFigure;
  /**
   * How this month compares to last.
   *
   * A word, not just a signed number: "more than last month" is unambiguous where a
   * bare `+12%` next to a red arrow is not
   * (docs/06-CODING-PRACTICES.md section 40 - colour is never the only signal).
   */
  comparison: "more" | "less" | "same" | "no_previous";
  difference: MoneyFigure;
  topCategories: DashboardCategorySpending[];
};

export type DashboardCategorySpending = {
  categoryId: string | null;
  name: string;
  /**
   * `Category.icon` — free text that may name a glyph this set has, may not, or may be absent.
   *
   * Carried so the breakdown can draw the same swatch the category shows everywhere else
   * (`CategorySwatch`). Resolved at render time rather than here: the resolver is one place, and a
   * view model that pre-resolved it would be a second.
   */
  icon: string | null;
  total: MoneyFigure;
  transactionCount: number;
};

/**
 * Everything the dashboard renders.
 *
 * Assembled server-side in one pass so the page performs no arithmetic of its own.
 */
export type DashboardView = {
  currency: string;
  totals: DashboardTotals;
  accounts: AccountView[];
  people: DashboardPeopleTotals;
  /** People with an outstanding balance, largest first, already trimmed. */
  peopleOwingUser: PersonView[];
  peopleUserOwes: PersonView[];
  spending: DashboardSpending;
  recentTransactions: TransactionDayGroup[];
  recentAccountNames: Record<string, string>;
  recentCategoryNames: Record<string, string>;
  recentPersonNames: Record<string, string>;
  recentSettlements: SettlementView[];
  /** True when the user has recorded nothing at all, so the page can onboard. */
  isEmpty: boolean;
};
