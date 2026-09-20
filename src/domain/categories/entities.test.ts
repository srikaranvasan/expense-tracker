import { describe, expect, it } from "vitest";
import { buildCategory } from "@tests/helpers/builders";
import { buildCategoryTree } from "./entities";

describe("buildCategoryTree", () => {
  it("returns an empty list for no categories", () => {
    expect(buildCategoryTree([])).toEqual([]);
  });

  it("groups children under their parent", () => {
    const food = buildCategory({ name: "Food", parentId: null });
    const restaurants = buildCategory({ name: "Restaurants", parentId: food.id });
    const groceries = buildCategory({ name: "Groceries", parentId: food.id });

    const tree = buildCategoryTree([restaurants, food, groceries]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.name).toBe("Food");
    expect(tree[0]?.children.map((c) => c.name)).toEqual(["Groceries", "Restaurants"]);
  });

  it("sorts parents and children by name", () => {
    const transport = buildCategory({ name: "Transport" });
    const bills = buildCategory({ name: "Bills" });
    const food = buildCategory({ name: "Food" });

    expect(buildCategoryTree([transport, bills, food]).map((c) => c.name)).toEqual([
      "Bills",
      "Food",
      "Transport",
    ]);
  });

  it("promotes an orphan to the top level rather than dropping it", () => {
    // The parent is archived and therefore absent from this list. Losing the child
    // from the picker would be worse than showing it ungrouped.
    const orphan = buildCategory({ name: "Restaurants", parentId: "missing-parent" });

    const tree = buildCategoryTree([orphan]);

    expect(tree).toHaveLength(1);
    expect(tree[0]?.name).toBe("Restaurants");
    expect(tree[0]?.children).toEqual([]);
  });

  it("keeps every category exactly once", () => {
    const food = buildCategory({ name: "Food" });
    const restaurants = buildCategory({ name: "Restaurants", parentId: food.id });
    const transport = buildCategory({ name: "Transport" });

    const tree = buildCategoryTree([food, restaurants, transport]);
    const total = tree.length + tree.reduce((sum, node) => sum + node.children.length, 0);

    expect(total).toBe(3);
  });
});
