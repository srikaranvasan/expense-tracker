import { describe, expect, it } from "vitest";
import { buildCategory } from "@tests/helpers/builders";
import {
  assertCanBecomeChild,
  assertCategoryKind,
  assertCategoryUsable,
  assertNameAvailable,
  assertNotSelfParent,
  assertValidParent,
  siblingsOf,
} from "./rules";

describe("assertCategoryUsable", () => {
  it("accepts an active category", () => {
    expect(() => assertCategoryUsable(buildCategory())).not.toThrow();
  });

  it("rejects an archived category", () => {
    expect(() => assertCategoryUsable(buildCategory({ archivedAt: new Date() }))).toThrow(
      /archived/i,
    );
  });
});

describe("assertCategoryKind", () => {
  it("accepts a matching kind", () => {
    expect(() => assertCategoryKind(buildCategory({ kind: "expense" }), "expense")).not.toThrow();
  });

  it("rejects an income category on an expense", () => {
    expect(() => assertCategoryKind(buildCategory({ kind: "income" }), "expense")).toThrow(
      /income category/i,
    );
  });
});

describe("assertValidParent", () => {
  it("accepts a top-level category of the same kind", () => {
    expect(() => assertValidParent(buildCategory({ parentId: null }), "expense")).not.toThrow();
  });

  it("rejects nesting more than one level deep", () => {
    const child = buildCategory({ name: "Restaurants", parentId: "cat-food" });
    expect(() => assertValidParent(child, "expense")).toThrow(/already a sub-category/i);
  });

  it("rejects an archived parent", () => {
    expect(() => assertValidParent(buildCategory({ archivedAt: new Date() }), "expense")).toThrow(
      /archived/i,
    );
  });

  it("rejects a parent of a different kind", () => {
    expect(() => assertValidParent(buildCategory({ kind: "income" }), "expense")).toThrow(
      /same kind/i,
    );
  });
});

describe("assertNotSelfParent", () => {
  it("accepts a null or different parent", () => {
    expect(() => assertNotSelfParent("cat1", null)).not.toThrow();
    expect(() => assertNotSelfParent("cat1", "cat2")).not.toThrow();
  });

  it("rejects a category parenting itself", () => {
    expect(() => assertNotSelfParent("cat1", "cat1")).toThrow(/its own parent/i);
  });
});

describe("assertCanBecomeChild", () => {
  it("accepts a category with no children", () => {
    expect(() => assertCanBecomeChild(false, "Food")).not.toThrow();
  });

  it("rejects a category that already has children", () => {
    // Otherwise its children would end up two levels deep.
    expect(() => assertCanBecomeChild(true, "Food")).toThrow(/sub-categories/i);
  });
});

describe("assertNameAvailable", () => {
  const siblings = [buildCategory({ name: "Food" }), buildCategory({ name: "Transport" })];

  it("accepts an unused name", () => {
    expect(() => assertNameAvailable("Bills", siblings)).not.toThrow();
  });

  it("rejects a duplicate regardless of case or padding", () => {
    expect(() => assertNameAvailable("food", siblings)).toThrow(/already have a category/i);
    expect(() => assertNameAvailable("  FOOD  ", siblings)).toThrow();
  });

  it("ignores the category being renamed", () => {
    const existing = siblings[0]!;
    expect(() => assertNameAvailable("Food", siblings, existing.id)).not.toThrow();
  });
});

describe("siblingsOf", () => {
  it("returns only categories sharing the given parent", () => {
    const food = buildCategory({ name: "Food", parentId: null });
    const restaurants = buildCategory({ name: "Restaurants", parentId: food.id });
    const groceries = buildCategory({ name: "Groceries", parentId: food.id });
    const transport = buildCategory({ name: "Transport", parentId: null });

    const all = [food, restaurants, groceries, transport];

    expect(
      siblingsOf(all, null)
        .map((c) => c.name)
        .sort(),
    ).toEqual(["Food", "Transport"]);
    expect(
      siblingsOf(all, food.id)
        .map((c) => c.name)
        .sort(),
    ).toEqual(["Groceries", "Restaurants"]);
  });
});
