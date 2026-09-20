import { calculatePersonBalanceFromObligations } from "@/domain/people/calculations";
import { getPersonBalance, loadObligations } from "@/server/services/people/person-balances";
import { getPerson, listPeople } from "@/server/services/people/person-service";
import type { PersonDetailView, PersonOption, PersonView } from "../view-models/person-view-model";
import {
  toObligationView,
  toPersonOption,
  toPersonView,
  toSettlementSummaryView,
} from "../view-models/person-view-model";

/**
 * Read models for the people screens.
 *
 * The list view computes every balance from one pass over the obligations rather
 * than querying per person.
 */

export async function getPeopleListView(
  userId: string,
  currency: string,
  options: { includeArchived?: boolean; search?: string } = {},
): Promise<PersonView[]> {
  const people = await listPeople(userId, {
    includeArchived: options.includeArchived ?? false,
    ...(options.search ? { search: options.search } : {}),
  });

  if (people.length === 0) return [];

  const { obligations } = await loadObligations(userId);

  return people.map((person) =>
    toPersonView(person, calculatePersonBalanceFromObligations(person.id, obligations, currency)),
  );
}

export async function getPersonDetailView(
  userId: string,
  personId: string,
  currency: string,
  timezone: string,
): Promise<PersonDetailView> {
  const person = await getPerson(userId, personId);
  const { balance, obligations, settlements } = await getPersonBalance(userId, personId, currency);

  return {
    ...toPersonView(person, balance),
    obligations: obligations.map((obligation) => toObligationView(obligation, timezone)),
    settlements: settlements.map((settlement) => toSettlementSummaryView(settlement, timezone)),
  };
}

/** Active people only: an archived person must not be selectable. */
export async function getPersonOptions(userId: string): Promise<PersonOption[]> {
  const people = await listPeople(userId, { includeArchived: false });
  return people.map(toPersonOption);
}
