import { InvalidPersonError } from "@/domain/shared/errors";
import type { Person } from "./entities";

/**
 * Business rules for people.
 *
 * Archived people remain referenced by historical expenses, so archiving only
 * removes them from pickers - it never invalidates past records.
 */

/** An archived person may not be added to a new expense or settlement. */
export function assertPersonUsable(person: Person, purpose = "this transaction"): void {
  if (person.archivedAt !== null) {
    throw new InvalidPersonError(`"${person.name}" is archived and cannot be used for ${purpose}.`);
  }
}

/**
 * Checks that every referenced person id resolved to a person the user owns.
 *
 * A missing id and another user's id are treated identically, so the API never
 * confirms that a foreign record exists.
 */
export function assertAllPeopleResolved(
  requestedIds: readonly string[],
  resolved: ReadonlyMap<string, Person>,
): void {
  for (const id of requestedIds) {
    if (!resolved.has(id)) {
      throw new InvalidPersonError("One of the selected people could not be found.");
    }
  }
}

export function assertNoDuplicatePeople(personIds: readonly string[]): void {
  if (new Set(personIds).size !== personIds.length) {
    throw new InvalidPersonError("The same person cannot be added twice.");
  }
}
