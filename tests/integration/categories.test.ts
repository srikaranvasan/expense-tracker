import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_CATEGORIES } from "@/config/constants";
import type { User } from "@/domain/users/entities";
import type {
  CategoryTreeView,
  CategoryView,
} from "@/features/categories/view-models/category-view-model";
import { categoryRepository } from "@/server/repositories/mongo/category-repository";
import { transactionRepository } from "@/server/repositories/mongo/transaction-repository";
import { expectData, expectError, invokeRoute } from "@tests/helpers/api";
import {
  createAndSignInTestUser,
  createTestUser,
  sessionModuleMock,
  setCurrentTestUser,
} from "@tests/helpers/auth";
import { clientId, fixedDate, inr } from "@tests/helpers/fixtures";

vi.mock("@/server/auth/session", () => sessionModuleMock());

const { GET: listCategories, POST: createCategory } = await import("@/app/api/categories/route");
const {
  GET: getCategory,
  PATCH: patchCategory,
  DELETE: archiveCategory,
} = await import("@/app/api/categories/[id]/route");
const { POST: restoreCategory } = await import("@/app/api/categories/[id]/restore/route");

const categories = categoryRepository();
const transactions = transactionRepository();

let user: User;

type ListResponse = { items: CategoryView[]; tree: CategoryTreeView[] };
type ArchiveResponse = CategoryView & { archivedChildren: number; transactionCount: number };

async function postCategory(body: Record<string, unknown>) {
  return invokeRoute<CategoryView>(createCategory, "/api/categories", {
    method: "POST",
    body: { clientId: clientId("cat"), ...body },
  });
}

async function fetchList(searchParams: Record<string, string> = {}) {
  return expectData(
    await invokeRoute<ListResponse>(listCategories, "/api/categories", { searchParams }),
  );
}

beforeEach(async () => {
  user = await createAndSignInTestUser();
});

describe("default categories", () => {
  it("are created when a user registers", async () => {
    const { items } = await fetchList();

    expect(items).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(items.map((item) => item.name).sort()).toEqual(
      DEFAULT_CATEGORIES.map((category) => category.name).sort(),
    );
  });

  it("are all top-level expense categories with an icon", async () => {
    const { items } = await fetchList();

    for (const item of items) {
      expect(item.parentId).toBeNull();
      expect(item.kind).toBe("expense");
      expect(item.icon).not.toBeNull();
      expect(item.isArchived).toBe(false);
    }
  });

  it("belong only to the user who registered", async () => {
    const other = await createTestUser();

    expect(await categories.countAll(user.id)).toBe(DEFAULT_CATEGORIES.length);
    expect(await categories.countAll(other.id)).toBe(DEFAULT_CATEGORIES.length);

    const mine = await categories.list(user.id);
    setCurrentTestUser(other);
    const theirs = await categories.list(other.id);

    // Same names, different records.
    expect(mine.map((c) => c.id).some((id) => theirs.map((t) => t.id).includes(id))).toBe(false);
  });

  it("are ordinary categories the user can archive", async () => {
    const { items } = await fetchList();
    const food = items.find((item) => item.name === "Food")!;

    const response = await invokeRoute<ArchiveResponse>(
      archiveCategory,
      `/api/categories/${food.id}`,
      { method: "DELETE", params: { id: food.id } },
    );

    expect(response.status).toBe(200);
    expect(expectData(response).isArchived).toBe(true);
  });
});

describe("POST /api/categories", () => {
  it("adds a top-level category", async () => {
    const response = await postCategory({ name: "Subscriptions" });

    expect(response.status).toBe(201);
    const category = expectData(response);
    expect(category.name).toBe("Subscriptions");
    expect(category.parentId).toBeNull();
    expect(category.kind).toBe("expense");
  });

  it("adds a sub-category under a parent", async () => {
    const { items } = await fetchList();
    const food = items.find((item) => item.name === "Food")!;

    const child = expectData(await postCategory({ name: "Restaurants", parentId: food.id }));

    expect(child.parentId).toBe(food.id);

    const { tree } = await fetchList();
    const foodNode = tree.find((node) => node.id === food.id);
    expect(foodNode?.children.map((c) => c.name)).toEqual(["Restaurants"]);
  });

  it("normalises whitespace in the name", async () => {
    const category = expectData(await postCategory({ name: "  Home    Repairs  " }));
    expect(category.name).toBe("Home Repairs");
  });

  it("rejects a duplicate name at the same level", async () => {
    const response = await postCategory({ name: "Food" });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_CATEGORY");
    expect(expectError(response).message).toMatch(/already have a category/i);
  });

  it("rejects a duplicate regardless of case", async () => {
    expect((await postCategory({ name: "food" })).status).toBe(400);
    expect((await postCategory({ name: "  FOOD " })).status).toBe(400);
  });

  it("rejects a name that duplicates an archived sibling", async () => {
    const { items } = await fetchList();
    const food = items.find((item) => item.name === "Food")!;

    await invokeRoute(archiveCategory, `/api/categories/${food.id}`, {
      method: "DELETE",
      params: { id: food.id },
    });

    // Reusing the name would produce two "Food" categories as soon as the old one
    // is restored.
    expect((await postCategory({ name: "Food" })).status).toBe(400);
  });

  it("allows the same child name under different parents", async () => {
    // "Trips > Taxi" and "Commute > Taxi" are meaningfully different.
    const trips = expectData(await postCategory({ name: "Trips" }));
    const commute = expectData(await postCategory({ name: "Commute" }));

    expect((await postCategory({ name: "Taxi", parentId: trips.id })).status).toBe(201);
    expect((await postCategory({ name: "Taxi", parentId: commute.id })).status).toBe(201);
  });

  it("rejects nesting more than one level deep", async () => {
    const { items } = await fetchList();
    const food = items.find((item) => item.name === "Food")!;
    const child = expectData(await postCategory({ name: "Restaurants", parentId: food.id }));

    const response = await postCategory({ name: "Fine dining", parentId: child.id });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/already a sub-category/i);
  });

  it("rejects an archived parent", async () => {
    const parent = expectData(await postCategory({ name: "Leisure" }));
    await invokeRoute(archiveCategory, `/api/categories/${parent.id}`, {
      method: "DELETE",
      params: { id: parent.id },
    });

    const response = await postCategory({ name: "Cinema", parentId: parent.id });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/archived/i);
  });

  it("rejects another user's category as a parent", async () => {
    const other = await createTestUser();
    const theirs = await categories.create(other.id, {
      clientId: clientId("cat"),
      name: "Theirs",
    });

    const response = await postCategory({ name: "Mine", parentId: theirs.id });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/not found/i);
  });

  it("rejects an empty name", async () => {
    expect((await postCategory({ name: "   " })).status).toBe(400);
  });

  it("rejects an icon containing markup", async () => {
    const response = await postCategory({ name: "Odd", icon: "<script>x</script>" });
    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("VALIDATION_ERROR");
  });

  it("is idempotent for a repeated clientId", async () => {
    const id = clientId("cat");

    const first = expectData(
      await invokeRoute<CategoryView>(createCategory, "/api/categories", {
        method: "POST",
        body: { clientId: id, name: "Subscriptions" },
      }),
    );

    // A retried offline create must return the original record, not be rejected by
    // the duplicate-name rule for clashing with what it already created.
    const second = expectData(
      await invokeRoute<CategoryView>(createCategory, "/api/categories", {
        method: "POST",
        body: { clientId: id, name: "Subscriptions" },
      }),
    );

    expect(second.id).toBe(first.id);
    expect(await categories.countAll(user.id)).toBe(DEFAULT_CATEGORIES.length + 1);
  });

  it("requires authentication", async () => {
    setCurrentTestUser(null);
    expect((await postCategory({ name: "Nope" })).status).toBe(401);
  });
});

describe("GET /api/categories", () => {
  it("returns a flat list and a tree", async () => {
    const { items } = await fetchList();
    const food = items.find((item) => item.name === "Food")!;
    await postCategory({ name: "Restaurants", parentId: food.id });

    const result = await fetchList();

    expect(result.items).toHaveLength(DEFAULT_CATEGORIES.length + 1);
    expect(result.tree).toHaveLength(DEFAULT_CATEGORIES.length);
    expect(result.tree.find((node) => node.id === food.id)?.children).toHaveLength(1);
  });

  it("excludes archived categories unless asked", async () => {
    const extra = expectData(await postCategory({ name: "Temporary" }));
    await invokeRoute(archiveCategory, `/api/categories/${extra.id}`, {
      method: "DELETE",
      params: { id: extra.id },
    });

    const active = await fetchList();
    expect(active.items.some((item) => item.id === extra.id)).toBe(false);

    const all = await fetchList({ includeArchived: "true" });
    expect(all.items.find((item) => item.id === extra.id)?.isArchived).toBe(true);
  });

  it("does not return another user's categories", async () => {
    const other = await createTestUser();
    setCurrentTestUser(other);
    const theirs = expectData(await postCategory({ name: "Theirs only" }));

    setCurrentTestUser(user);
    const { items } = await fetchList();
    expect(items.some((item) => item.id === theirs.id)).toBe(false);
  });
});

describe("PATCH /api/categories/:id", () => {
  it("renames a category", async () => {
    const category = expectData(await postCategory({ name: "Subscriptions" }));

    const updated = expectData(
      await invokeRoute<CategoryView>(patchCategory, `/api/categories/${category.id}`, {
        method: "PATCH",
        params: { id: category.id },
        body: { name: "Recurring" },
      }),
    );

    expect(updated.name).toBe("Recurring");
    expect(updated.syncVersion).toBe(category.syncVersion + 1);
  });

  it("allows renaming to its own current name", async () => {
    const category = expectData(await postCategory({ name: "Subscriptions" }));

    const response = await invokeRoute(patchCategory, `/api/categories/${category.id}`, {
      method: "PATCH",
      params: { id: category.id },
      body: { name: "Subscriptions" },
    });

    expect(response.status).toBe(200);
  });

  it("rejects renaming onto a sibling's name", async () => {
    const category = expectData(await postCategory({ name: "Subscriptions" }));

    const response = await invokeRoute(patchCategory, `/api/categories/${category.id}`, {
      method: "PATCH",
      params: { id: category.id },
      body: { name: "Food" },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).code).toBe("INVALID_CATEGORY");
  });

  it("moves a category under a parent", async () => {
    const { items } = await fetchList();
    const food = items.find((item) => item.name === "Food")!;
    const standalone = expectData(await postCategory({ name: "Restaurants" }));

    const moved = expectData(
      await invokeRoute<CategoryView>(patchCategory, `/api/categories/${standalone.id}`, {
        method: "PATCH",
        params: { id: standalone.id },
        body: { parentId: food.id },
      }),
    );

    expect(moved.parentId).toBe(food.id);
  });

  it("promotes a child to the top level when the parent is cleared", async () => {
    const { items } = await fetchList();
    const food = items.find((item) => item.name === "Food")!;
    const child = expectData(await postCategory({ name: "Restaurants", parentId: food.id }));

    const promoted = expectData(
      await invokeRoute<CategoryView>(patchCategory, `/api/categories/${child.id}`, {
        method: "PATCH",
        params: { id: child.id },
        body: { parentId: null },
      }),
    );

    expect(promoted.parentId).toBeNull();
  });

  it("refuses to make a category with children into a child", async () => {
    const parent = expectData(await postCategory({ name: "Trips" }));
    await postCategory({ name: "Taxi", parentId: parent.id });

    const { items } = await fetchList();
    const food = items.find((item) => item.name === "Food")!;

    const response = await invokeRoute(patchCategory, `/api/categories/${parent.id}`, {
      method: "PATCH",
      params: { id: parent.id },
      body: { parentId: food.id },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/sub-categories/i);
  });

  it("refuses to make a category its own parent", async () => {
    const category = expectData(await postCategory({ name: "Subscriptions" }));

    const response = await invokeRoute(patchCategory, `/api/categories/${category.id}`, {
      method: "PATCH",
      params: { id: category.id },
      body: { parentId: category.id },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/its own parent/i);
  });

  it("refuses to edit an archived category", async () => {
    const category = expectData(await postCategory({ name: "Temporary" }));
    await invokeRoute(archiveCategory, `/api/categories/${category.id}`, {
      method: "DELETE",
      params: { id: category.id },
    });

    const response = await invokeRoute(patchCategory, `/api/categories/${category.id}`, {
      method: "PATCH",
      params: { id: category.id },
      body: { name: "Nope" },
    });

    expect(response.status).toBe(400);
    expect(expectError(response).message).toMatch(/restore/i);
  });

  it("rejects a stale sync version", async () => {
    const category = expectData(await postCategory({ name: "Subscriptions" }));

    await invokeRoute(patchCategory, `/api/categories/${category.id}`, {
      method: "PATCH",
      params: { id: category.id },
      body: { name: "First" },
    });

    const stale = await invokeRoute(patchCategory, `/api/categories/${category.id}`, {
      method: "PATCH",
      params: { id: category.id },
      body: { name: "Second", expectedSyncVersion: category.syncVersion },
    });

    expect(stale.status).toBe(409);
  });

  it("does not update another user's category", async () => {
    const other = await createTestUser();
    const theirs = await categories.create(other.id, {
      clientId: clientId("cat"),
      name: "Theirs",
    });

    const response = await invokeRoute(patchCategory, `/api/categories/${theirs.id}`, {
      method: "PATCH",
      params: { id: theirs.id },
      body: { name: "Mine now" },
    });

    expect(response.status).toBe(404);
  });
});

describe("DELETE /api/categories/:id", () => {
  it("archives rather than deleting, and keeps classified transactions", async () => {
    const category = expectData(await postCategory({ name: "Subscriptions" }));

    await transactions.create(user.id, {
      clientId: clientId("txn"),
      type: "expense",
      amount: inr("499"),
      description: "Streaming",
      date: fixedDate(),
      categoryId: category.id,
      paidBy: { type: "user", personId: null },
    });

    const response = await invokeRoute<ArchiveResponse>(
      archiveCategory,
      `/api/categories/${category.id}`,
      { method: "DELETE", params: { id: category.id } },
    );

    const data = expectData(response);
    expect(data.isArchived).toBe(true);
    expect(data.transactionCount).toBe(1);

    // The transaction survives and keeps its category reference.
    expect(await transactions.countByCategory(user.id, category.id)).toBe(1);
  });

  it("archives sub-categories with their parent", async () => {
    const parent = expectData(await postCategory({ name: "Trips" }));
    const child = expectData(await postCategory({ name: "Taxi", parentId: parent.id }));

    const response = await invokeRoute<ArchiveResponse>(
      archiveCategory,
      `/api/categories/${parent.id}`,
      { method: "DELETE", params: { id: parent.id } },
    );

    expect(expectData(response).archivedChildren).toBe(1);

    const all = await fetchList({ includeArchived: "true" });
    expect(all.items.find((item) => item.id === child.id)?.isArchived).toBe(true);
  });

  it("is safe to call twice", async () => {
    const category = expectData(await postCategory({ name: "Temporary" }));

    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await invokeRoute<ArchiveResponse>(
        archiveCategory,
        `/api/categories/${category.id}`,
        { method: "DELETE", params: { id: category.id } },
      );
      expect(response.status).toBe(200);
      expect(expectData(response).isArchived).toBe(true);
    }
  });

  it("does not archive another user's category", async () => {
    const other = await createTestUser();
    const theirs = await categories.create(other.id, {
      clientId: clientId("cat"),
      name: "Theirs",
    });

    const response = await invokeRoute(archiveCategory, `/api/categories/${theirs.id}`, {
      method: "DELETE",
      params: { id: theirs.id },
    });

    expect(response.status).toBe(404);
  });
});

describe("POST /api/categories/:id/restore", () => {
  it("restores an archived category", async () => {
    const category = expectData(await postCategory({ name: "Temporary" }));
    await invokeRoute(archiveCategory, `/api/categories/${category.id}`, {
      method: "DELETE",
      params: { id: category.id },
    });

    const restored = expectData(
      await invokeRoute<CategoryView>(restoreCategory, `/api/categories/${category.id}/restore`, {
        method: "POST",
        params: { id: category.id },
      }),
    );

    expect(restored.isArchived).toBe(false);
  });

  it("promotes a restored child whose parent is still archived", async () => {
    const parent = expectData(await postCategory({ name: "Trips" }));
    const child = expectData(await postCategory({ name: "Taxi", parentId: parent.id }));

    // Archiving the parent archives the child too.
    await invokeRoute(archiveCategory, `/api/categories/${parent.id}`, {
      method: "DELETE",
      params: { id: parent.id },
    });

    const restored = expectData(
      await invokeRoute<CategoryView>(restoreCategory, `/api/categories/${child.id}/restore`, {
        method: "POST",
        params: { id: child.id },
      }),
    );

    // Restoring it into a hidden group would leave it invisible in the picker.
    expect(restored.isArchived).toBe(false);
    expect(restored.parentId).toBeNull();
  });
});

describe("GET /api/categories/:id", () => {
  it("returns a single category", async () => {
    const category = expectData(await postCategory({ name: "Subscriptions" }));

    const response = await invokeRoute<CategoryView>(
      getCategory,
      `/api/categories/${category.id}`,
      { params: { id: category.id } },
    );

    expect(expectData(response).name).toBe("Subscriptions");
  });

  it("returns 404 for another user's category", async () => {
    const other = await createTestUser();
    const theirs = await categories.create(other.id, {
      clientId: clientId("cat"),
      name: "Theirs",
    });

    const response = await invokeRoute(getCategory, `/api/categories/${theirs.id}`, {
      params: { id: theirs.id },
    });

    expect(response.status).toBe(404);
  });
});
