import type { PersonObligation } from "@/domain/people/calculations";
import type { Settlement, SettlementAllocation } from "@/domain/settlements/entities";
import { SETTLEMENT_DIRECTION_LABELS } from "@/domain/settlements/entities";
import { formatDate, formatDateTime, toDateInputValue } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { MoneyDto, SettlementDirection, SplitStatus } from "@/types/common";

/**
 * Settlement view models.
 *
 * A settlement is only meaningful alongside what it settled, so the detail view carries
 * its allocations with the expense each one paid down.
 */

export type SettlementView = {
  id: string;
  clientId: string;
  personId: string;
  personName: string;
  direction: SettlementDirection;
  directionLabel: string;
  amount: MoneyDto;
  formattedAmount: string;
  accountId: string | null;
  accountName: string | null;
  date: string;
  dateLabel: string;
  dateInputValue: string;
  notes: string | null;
  allocationCount: number;
  syncVersion: number;
};

export type SettlementViewContext = {
  timezone: string;
  personName?: string;
  accountName?: string | null;
  allocationCount?: number;
};

export function toSettlementView(
  settlement: Settlement,
  context: SettlementViewContext,
): SettlementView {
  return {
    id: settlement.id,
    clientId: settlement.clientId,
    personId: settlement.personId,
    personName: context.personName ?? "Someone",
    direction: settlement.direction,
    directionLabel: SETTLEMENT_DIRECTION_LABELS[settlement.direction],
    amount: settlement.amount.toJSON(),
    formattedAmount: formatMoney(settlement.amount),
    accountId: settlement.accountId,
    accountName: context.accountName ?? null,
    date: settlement.date.toISOString(),
    dateLabel: formatDate(settlement.date, context.timezone),
    dateInputValue: toDateInputValue(settlement.date, context.timezone),
    notes: settlement.notes,
    allocationCount: context.allocationCount ?? 0,
    syncVersion: settlement.syncVersion,
  };
}

/** One expense this settlement paid down. */
export type SettlementAllocationView = {
  id: string;
  expenseSplitId: string;
  transactionId: string | null;
  expenseDescription: string;
  expenseDateLabel: string;
  amount: MoneyDto;
  formattedAmount: string;
};

export type SettlementDetailView = SettlementView & {
  createdAtLabel: string;
  allocations: SettlementAllocationView[];
};

export function toSettlementDetailView(
  settlement: Settlement,
  allocations: readonly SettlementAllocation[],
  context: SettlementViewContext & {
    /** Expense description and date by split id. */
    expensesBySplitId?: ReadonlyMap<
      string,
      { transactionId: string; description: string; date: Date }
    >;
  },
): SettlementDetailView {
  const { timezone } = context;

  return {
    ...toSettlementView(settlement, { ...context, allocationCount: allocations.length }),
    createdAtLabel: formatDateTime(settlement.createdAt, timezone),
    allocations: allocations.map((allocation) => {
      const expense = context.expensesBySplitId?.get(allocation.expenseSplitId);

      return {
        id: allocation.id,
        expenseSplitId: allocation.expenseSplitId,
        transactionId: expense?.transactionId ?? null,
        expenseDescription: expense?.description ?? "Expense",
        expenseDateLabel: expense ? formatDate(expense.date, timezone) : "",
        amount: allocation.amount.toJSON(),
        formattedAmount: formatMoney(allocation.amount),
      };
    }),
  };
}

/**
 * An outstanding obligation as the settlement form shows it.
 *
 * `suggestedAmount` is what an oldest-first spread of the entered payment would put
 * against this expense, so the form can pre-fill sensible values.
 */
export type SettleableObligationView = {
  expenseSplitId: string;
  transactionId: string;
  description: string;
  dateLabel: string;
  date: string;
  originalAmount: MoneyDto;
  remainingAmount: MoneyDto;
  formattedOriginal: string;
  formattedRemaining: string;
  status: SplitStatus;
};

export function toSettleableObligationView(
  obligation: PersonObligation,
  timezone: string,
): SettleableObligationView {
  return {
    expenseSplitId: obligation.expenseSplitId,
    transactionId: obligation.transactionId,
    description: obligation.description,
    date: obligation.date.toISOString(),
    dateLabel: formatDate(obligation.date, timezone),
    originalAmount: obligation.originalAmount.toJSON(),
    remainingAmount: obligation.remainingAmount.toJSON(),
    formattedOriginal: formatMoney(obligation.originalAmount),
    formattedRemaining: formatMoney(obligation.remainingAmount),
    status: obligation.status,
  };
}

/** Everything the settle-up page needs. */
export type SettleUpView = {
  personId: string;
  personName: string;
  currency: string;
  /** Which direction has money outstanding, if either. */
  direction: SettlementDirection | null;
  directionLabel: string;
  outstanding: MoneyDto;
  formattedOutstanding: string;
  obligations: SettleableObligationView[];
  /** Both directions, when the person owes and is owed at the same time. */
  reverseDirection: SettlementDirection | null;
  reverseOutstanding: MoneyDto | null;
  reverseObligations: SettleableObligationView[];
};
