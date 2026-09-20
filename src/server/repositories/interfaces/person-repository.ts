import type { Person } from "@/domain/people/entities";
import type {
  ChangeFeedQuery,
  OptimisticUpdateMeta,
  RepositoryContext,
  SyncedCreateMeta,
} from "./common";

export type CreatePersonInput = SyncedCreateMeta & {
  name: string;
  notes?: string | null;
};

export type UpdatePersonInput = OptimisticUpdateMeta & {
  name?: string;
  notes?: string | null;
};

export type ListPeopleQuery = {
  includeArchived?: boolean;
  search?: string;
};

export interface PersonRepository {
  findById(userId: string, personId: string, context?: RepositoryContext): Promise<Person | null>;
  findByClientId(userId: string, clientId: string): Promise<Person | null>;
  findManyByIds(userId: string, personIds: readonly string[]): Promise<Person[]>;
  list(userId: string, query?: ListPeopleQuery): Promise<Person[]>;
  create(userId: string, input: CreatePersonInput, context?: RepositoryContext): Promise<Person>;
  update(userId: string, personId: string, input: UpdatePersonInput): Promise<Person>;
  archive(userId: string, personId: string): Promise<Person>;
  restore(userId: string, personId: string): Promise<Person>;
  /** Records changed since a sync cursor, for the pull endpoint. */
  changesSince(userId: string, query: ChangeFeedQuery): Promise<Person[]>;
}
