import type { Person } from "@/domain/people/entities";
import { assertAllPeopleResolved, assertNoDuplicatePeople } from "@/domain/people/rules";
import { InvalidPersonError } from "@/domain/shared/errors";
import { NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logging/logger";
import { normalizeWhitespace } from "@/lib/utils/text";
import type { PersonRepository } from "@/server/repositories/interfaces/person-repository";
import { personRepository } from "@/server/repositories/mongo/person-repository";

/**
 * People use cases.
 *
 * A Person is a contact, not an application account, so there is no invitation or
 * consent flow: the record belongs entirely to the user who created it
 * (docs/02-DATA-MODEL.md section 6).
 */

export type PersonServiceDependencies = {
  people: PersonRepository;
};

function defaultDependencies(): PersonServiceDependencies {
  return { people: personRepository() };
}

export type CreatePersonCommand = {
  clientId: string;
  name: string;
  notes?: string | null;
};

export async function createPerson(
  userId: string,
  command: CreatePersonCommand,
  dependencies: PersonServiceDependencies = defaultDependencies(),
): Promise<Person> {
  const name = normalizeWhitespace(command.name);
  if (name === "") throw new InvalidPersonError("A name is required.");

  const person = await dependencies.people.create(userId, {
    clientId: command.clientId,
    name,
    notes: command.notes ?? null,
  });

  logger.info("person created", {
    operation: "people.create",
    userId,
    entityType: "person",
    entityId: person.id,
  });

  return person;
}

export type UpdatePersonCommand = {
  name?: string;
  notes?: string | null;
  expectedSyncVersion?: number;
};

export async function updatePerson(
  userId: string,
  personId: string,
  command: UpdatePersonCommand,
  dependencies: PersonServiceDependencies = defaultDependencies(),
): Promise<Person> {
  const existing = await dependencies.people.findById(userId, personId);
  if (!existing) throw new NotFoundError("Person");

  if (command.name !== undefined && normalizeWhitespace(command.name) === "") {
    throw new InvalidPersonError("A name is required.");
  }

  const person = await dependencies.people.update(userId, personId, {
    ...(command.name !== undefined ? { name: normalizeWhitespace(command.name) } : {}),
    ...(command.notes !== undefined ? { notes: command.notes } : {}),
    ...(command.expectedSyncVersion !== undefined
      ? { expectedSyncVersion: command.expectedSyncVersion }
      : {}),
  });

  logger.info("person updated", {
    operation: "people.update",
    userId,
    entityType: "person",
    entityId: personId,
  });

  return person;
}

/**
 * Archives a person.
 *
 * Allowed even with an outstanding balance: the user may simply want them out of
 * the picker. The balance and history remain visible on the person's page, and the
 * UI warns before archiving someone who still owes or is owed money.
 */
export async function archivePerson(
  userId: string,
  personId: string,
  dependencies: PersonServiceDependencies = defaultDependencies(),
): Promise<Person> {
  const existing = await dependencies.people.findById(userId, personId);
  if (!existing) throw new NotFoundError("Person");

  if (existing.archivedAt !== null) return existing;

  const person = await dependencies.people.archive(userId, personId);

  logger.info("person archived", {
    operation: "people.archive",
    userId,
    entityType: "person",
    entityId: personId,
  });

  return person;
}

export async function restorePerson(
  userId: string,
  personId: string,
  dependencies: PersonServiceDependencies = defaultDependencies(),
): Promise<Person> {
  const existing = await dependencies.people.findById(userId, personId);
  if (!existing) throw new NotFoundError("Person");

  return dependencies.people.restore(userId, personId);
}

export async function listPeople(
  userId: string,
  query: { includeArchived?: boolean; search?: string } = {},
  dependencies: PersonServiceDependencies = defaultDependencies(),
): Promise<Person[]> {
  return dependencies.people.list(userId, query);
}

export async function getPerson(
  userId: string,
  personId: string,
  dependencies: PersonServiceDependencies = defaultDependencies(),
): Promise<Person> {
  const person = await dependencies.people.findById(userId, personId);
  if (!person) throw new NotFoundError("Person");
  return person;
}

/**
 * Resolves person references for another operation.
 *
 * Verifies ownership and rejects duplicates before any financial record is
 * written (docs/06-CODING-PRACTICES.md section 15).
 */
export async function resolveOwnedPeople(
  userId: string,
  personIds: readonly string[],
  options: { allowDuplicates?: boolean } = {},
  dependencies: PersonServiceDependencies = defaultDependencies(),
): Promise<Map<string, Person>> {
  const ids = personIds.filter(Boolean);
  if (!options.allowDuplicates) assertNoDuplicatePeople(ids);

  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();

  const people = await dependencies.people.findManyByIds(userId, unique);
  const byId = new Map(people.map((person) => [person.id, person] as const));

  assertAllPeopleResolved(unique, byId);

  return byId;
}
