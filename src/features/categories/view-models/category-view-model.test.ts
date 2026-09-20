import { describe, expect, it } from "vitest";
import { buildCategory } from "@tests/helpers/builders";
import {
  toCategoryOptions,
  toCategoryTreeView,
  toCategoryViews,
  toParentOptions,
} from "./category-view-model";

describe("toCategoryViews", () => {
  it("resolves each child's parent name", () => {
    const food = buildCategory({ name: "Food" });
    const restaurants = buildCategory({ name: "Restaurants", parentId: food.id });

    const views = toCategoryViews([food, restaurants]);

    expect(views.find((v) => v.name === "Restaurants")?.parentName).toBe("Food");
    expect(views.find((v) => v.name === "Food")?.parentName).toBeNull();
  });

  it("marks archived categories", () => {
    const views = toCategoryViews([buildCategory({ archivedAt: new Date() })]);
    expect(views[0]?.isArchived).toBe(true);
  });
});

describe("toCategoryOptions", () => {
  it("lists each child immediately after its parent", () => {
    const food = buildCategory({ name: "Food" });
    const restaurants = buildCategory({ name: "Restaurants", parentId: food.id });
    const transport = buildCategory({ name: "Transport" });

    const options = toCategoryOptions([food, restaurants, transport]);

    expect(options.map((o) => o.name)).toEqual(["Food", "Restaurants", "Transport"]);
    expect(options.map((o) => o.depth)).toEqual([0, 1, 0]);
  });

  it("qualifies a child label with its parent", () => {
    // Two parents can each have a "Taxi"; the bare name would be ambiguous.
    const travel = buildCategory({ name: "Travel" });
    const taxi = buildCategory({ name: "Taxi", parentId: travel.id });

    const options = toCategoryOptions([travel, taxi]);

    expect(options.find((o) => o.name === "Taxi")?.label).toBe("Travel › Taxi");
  });

  it("keeps a parent selectable", () => {
    const food = buildCategory({ name: "Food" });
    const restaurants = buildCategory({ name: "Restaurants", parentId: food.id });

    const options = toCategoryOptions([food, restaurants]);
    expect(options.some((o) => o.id === food.id)).toBe(true);
  });
});

describe("toParentOptions", () => {
  it("returns only top-level categories", () => {
    const food = buildCategory({ name: "Food" });
    const restaurants = buildCategory({ name: "Restaurants", parentId: food.id });

    const options = toParentOptions([food, restaurants]);

    expect(options).toHaveLength(1);
    expect(options[0]?.name).toBe("Food");
  });
});

describe("toCategoryTreeView", () => {
  it("nests children and names their parent", () => {
    const food = buildCategory({ name: "Food" });
    const restaurants = buildCategory({ name: "Restaurants", parentId: food.id });

    const tree = toCategoryTreeView([food, restaurants]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.children[0]?.parentName).toBe("Food");
  });
});
