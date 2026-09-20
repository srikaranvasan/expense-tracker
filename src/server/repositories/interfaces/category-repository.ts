import type { Category, CategoryKind } from "@/domain/categories/entities";
import type {
  ChangeFeedQuery,
  OptimisticUpdateMeta,
  RepositoryContext,
  SyncedCreateMeta,
} from "./common";

export type CreateCategoryInput = SyncedCreateMeta & {
  name: string;
  icon?: string | null;
  parentId?: string | null;
  kind?: CategoryKind;
};

export type UpdateCategoryInput = OptimisticUpdateMeta & {
  name?: string;
  icon?: string | null;
  parentId?: string | null;
};

export type ListCategoriesQuery = {
  includeArchived?: boolean;
  kind?: CategoryKind;
};

export interface CategoryRepository {
  findById(
    userId: string,
    categoryId: string,
    context?: RepositoryContext,
  ): Promise<Category | null>;
  findByClientId(userId: string, clientId: string): Promise<Category | null>;
  findManyByIds(userId: string, categoryIds: readonly string[]): Promise<Category[]>;
  list(userId: string, query?: ListCategoriesQuery): Promise<Category[]>;
  create(
    userId: string,
    input: CreateCategoryInput,
    context?: RepositoryContext,
  ): Promise<Category>;
  /** Bulk insert used when seeding a new user's default categories. */
  createMany(
    userId: string,
    inputs: readonly CreateCategoryInput[],
    context?: RepositoryContext,
  ): Promise<Category[]>;
  update(userId: string, categoryId: string, input: UpdateCategoryInput): Promise<Category>;
  archive(userId: string, categoryId: string): Promise<Category>;
  restore(userId: string, categoryId: string): Promise<Category>;
  /** True when any non-archived category has this one as its parent. */
  hasChildren(userId: string, categoryId: string): Promise<boolean>;
  countAll(userId: string): Promise<number>;
  /** Records changed since a sync cursor, for the pull endpoint. */
  changesSince(userId: string, query: ChangeFeedQuery): Promise<Category[]>;
}
