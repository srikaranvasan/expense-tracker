import type { PersonBalance, PersonObligation } from "@/domain/people/calculations";
import type { Person } from "@/domain/people/entities";
import type { Settlement } from "@/domain/settlements/entities";
import { SETTLEMENT_DIRECTION_LABELS } from "@/domain/settlements/entities";
import { formatDate } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { referenceCodeFor } from "@/lib/utils/reference-code";
import { initials } from "@/lib/utils/text";
import type {
  MoneyDto,
  PersonBalanceDirection,
  SettlementDirection,
  SplitStatus,
} from "@/types/common";

/**
 * Person view models.
 *
 * A balance is always presented with its direction, never as a bare number: "₹450"
 * is meaningless without knowing who owes whom.
 */

export type PersonView = {
  id: string;
  clientId: string;
  name: string;
  initials: string;
  notes: string | null;
  isArchived: boolean;
  syncVersion: number;
  balance: PersonBalanceView;
};

export type PersonBalanceView = {
  currency: string;
  direction: PersonBalanceDirection;
  /** Signed: positive when the person owes the user. */
  net: MoneyDto;
  /** Unsigned, for display next to a direction label. */
  netAbsolute: MoneyDto;
  formattedNet: string;
  personOwesUser: MoneyDto;
  userOwesPerson: MoneyDto;
  isSettled: boolean;
  unsettledCount: number;
  label: string;
};

const DIRECTION_LABELS: Record<PersonBalanceDirection, string> = {
  person_owes_user: "owes you",
  user_owes_person: "you owe",
  settled: "settled up",
};

export function toPersonBalanceView(balance: PersonBalance): PersonBalanceView {
  return {
    currency: balance.currency,
    direction: balance.direction,
    net: balance.net.toJSON(),
    netAbsolute: balance.netAbsolute.toJSON(),
    formattedNet: formatMoney(balance.netAbsolute),
    personOwesUser: balance.personOwesUser.toJSON(),
    userOwesPerson: balance.userOwesPerson.toJSON(),
    isSettled: balance.isSettled,
    unsettledCount: balance.unsettledCount,
    label: DIRECTION_LABELS[balance.direction],
  };
}

export function toPersonView(person: Person, balance: PersonBalance): PersonView {
  return {
    id: person.id,
    clientId: person.clientId,
    name: person.name,
    initials: initials(person.name),
    notes: person.notes,
    isArchived: person.archivedAt !== null,
    syncVersion: person.syncVersion,
    balance: toPersonBalanceView(balance),
  };
}

/** One shared expense as it appears on a person's page. */
export type ObligationView = {
  transactionId: string;
  expenseSplitId: string;
  description: string;
  dateLabel: string;
  date: string;
  direction: "person_owes_user" | "user_owes_person";
  directionLabel: string;
  originalAmount: MoneyDto;
  allocatedAmount: MoneyDto;
  remainingAmount: MoneyDto;
  formattedOriginal: string;
  formattedRemaining: string;
  status: SplitStatus;
  statusLabel: string;
};

const STATUS_LABELS: Record<SplitStatus, string> = {
  unsettled: "Unsettled",
  partially_settled: "Partly settled",
  settled: "Settled",
};

export function toObligationView(obligation: PersonObligation, timezone: string): ObligationView {
  return {
    transactionId: obligation.transactionId,
    expenseSplitId: obligation.expenseSplitId,
    description: obligation.description,
    date: obligation.date.toISOString(),
    dateLabel: formatDate(obligation.date, timezone),
    direction: obligation.direction,
    directionLabel: obligation.direction === "person_owes_user" ? "Owes you" : "You owe",
    originalAmount: obligation.originalAmount.toJSON(),
    allocatedAmount: obligation.allocatedAmount.toJSON(),
    remainingAmount: obligation.remainingAmount.toJSON(),
    formattedOriginal: formatMoney(obligation.originalAmount),
    formattedRemaining: formatMoney(obligation.remainingAmount),
    status: obligation.status,
    statusLabel: STATUS_LABELS[obligation.status],
  };
}

export type SettlementSummaryView = {
  id: string;
  date: string;
  dateLabel: string;
  direction: SettlementDirection;
  directionLabel: string;
  amount: MoneyDto;
  formattedAmount: string;
  /**
   * The ledger reference — `#A3F09`.
   *
   * The person page's settlement history was the one money list group 32 left without a reference,
   * because these rows read a summary view of their own rather than `SettlementView`. Same derivation
   * as everywhere else; see `lib/utils/reference-code.ts`.
   */
  referenceCode: string | null;
  notes: string | null;
};

export function toSettlementSummaryView(
  settlement: Settlement,
  timezone: string,
): SettlementSummaryView {
  return {
    id: settlement.id,
    date: settlement.date.toISOString(),
    dateLabel: formatDate(settlement.date, timezone),
    direction: settlement.direction,
    directionLabel: SETTLEMENT_DIRECTION_LABELS[settlement.direction],
    amount: settlement.amount.toJSON(),
    formattedAmount: formatMoney(settlement.amount),
    referenceCode: referenceCodeFor(settlement),
    notes: settlement.notes,
  };
}

/** Everything the person detail page needs. */
export type PersonDetailView = PersonView & {
  obligations: ObligationView[];
  settlements: SettlementSummaryView[];
};

export type PersonOption = {
  id: string;
  name: string;
  initials: string;
};

export function toPersonOption(person: Person): PersonOption {
  return { id: person.id, name: person.name, initials: initials(person.name) };
}
