import { describe, expect, it } from "vitest";
import { ACCOUNT_TYPES } from "@/domain/accounts/entities";
import { resolveAccountAppearance, resolveAccountIcon } from "@/features/accounts/icon-map";
import { SWATCH_COLORS } from "@/features/categories/icon-map";
import { resolveTransactionIcon } from "@/features/transactions/icon-map";
import type { TransactionType } from "@/types/common";
import { HANDOFF_GLYPHS, ICON_NAMES, IN_HOUSE_GLYPHS, isIconName } from "./names";

/**
 * The icon **vocabulary**, and the three resolvers that map application concepts onto it.
 *
 * Deliberately in the `unit` project rather than `ui`: none of this needs a DOM, and keeping it
 * free of the glyph JSX is the reason `names.ts` exists at all. The glyph *geometry* is
 * asserted separately in `registry.test.tsx`.
 */

describe("icon vocabulary", () => {
  it("holds the 29 glyphs from the handoff plus 15 drawn in-house", () => {
    /*
     * 29, not the 28 the design system document's prose claims: its four tables list
     * 6 + 10 + 7 + 6. The tables are the authority and every row in them is present, so the
     * prose count is an arithmetic slip. Asserted with the real number so the review list in the
     * group 25 update document cannot drift from the code.
     *
     * The in-house count went 14 → 15 in group 43: `chevron-left`, for `BackLink`. The handoff
     * draws no back affordance on any screen, so like `sun`/`moon` it had to be drawn here.
     */
    expect(HANDOFF_GLYPHS).toHaveLength(29);
    expect(IN_HOUSE_GLYPHS).toHaveLength(15);
    expect(ICON_NAMES).toHaveLength(44);
  });

  it("keeps the two lists disjoint", () => {
    const overlap = HANDOFF_GLYPHS.filter((name) =>
      (IN_HOUSE_GLYPHS as readonly string[]).includes(name),
    );
    expect(overlap).toEqual([]);
  });

  it("has no duplicate names", () => {
    expect(new Set(ICON_NAMES).size).toBe(ICON_NAMES.length);
  });

  describe("name narrowing", () => {
    it("accepts a real glyph name", () => {
      expect(isIconName("home")).toBe(true);
      expect(isIconName("chevron-down")).toBe(true);
    });

    it("rejects anything else", () => {
      // Guards the stored `Category.icon` path: a free-text column from the database must not be
      // able to index the registry.
      expect(isIconName("nope")).toBe(false);
      expect(isIconName("")).toBe(false);
      expect(isIconName(null)).toBe(false);
      expect(isIconName(undefined)).toBe(false);
      expect(isIconName(42)).toBe(false);
    });

    it("rejects inherited object properties", () => {
      // The reason this uses a Set and not `name in ICONS`. Both of these exist on
      // Object.prototype, would pass an `in` check, and would then fail to render.
      expect(isIconName("toString")).toBe(false);
      expect(isIconName("constructor")).toBe(false);
      expect(isIconName("hasOwnProperty")).toBe(false);
    });
  });

  describe("glyphs the rest of the design system depends on", () => {
    /*
     * Each is named by a component contract elsewhere in the design system document. A missing
     * one is a type error at the call site, but only once that call site exists — which for most
     * of these is four groups away.
     */
    it.each([
      // 7.4 status badges
      "check",
      "alert-triangle",
      "split",
      "transfer",
      "card",
      // 7.4 direction amounts
      "arrow-in",
      "arrow-out",
      // 7.5 navigation
      "home",
      "activity",
      "accounts",
      "people",
      "categories",
      "sign-out",
      // 7.2 input prefixes and the select chevron
      "mail",
      "lock",
      "chevron-down",
      // 7.7 quick-add
      "plus",
      // 9.1 the "computed" marker
      "equals",
      // group 35 activity controls
      "search",
      "filter",
      // groups 37-39 row controls
      "archive",
      "restore",
      "edit",
      "delete",
      // group 30 chrome
      "offline",
      "install",
      // group 24 colour mode
      "sun",
      "moon",
    ])("%s exists", (name) => {
      expect(isIconName(name)).toBe(true);
    });
  });
});

describe("account appearance", () => {
  it.each(ACCOUNT_TYPES)("maps %s to a glyph and one of the five fills", (type) => {
    // No fallback needed and none provided: AccountType is a closed union, so the compiler stops
    // a fourth type being added without deciding how it looks.
    const appearance = resolveAccountAppearance(type);

    expect(isIconName(appearance.icon)).toBe(true);
    expect(SWATCH_COLORS).toContain(appearance.swatch);
    expect(appearance.swatchToken).toBe(`swatch.${appearance.swatch}`);
  });

  it("colours a credit card as a liability, not as money held", () => {
    /*
     * The colours carry the meaning the palette already has: teal is the brand, mint is
     * positive, coral is negative. A card is a liability — `isAssetAccount` excludes it — so it
     * gets the negative fill.
     */
    expect(resolveAccountAppearance("bank").swatch).toBe("teal");
    expect(resolveAccountAppearance("cash").swatch).toBe("mint");
    expect(resolveAccountAppearance("credit_card").swatch).toBe("coral");
  });

  it("uses the glyph that matches the type", () => {
    expect(resolveAccountIcon("bank")).toBe("bank");
    expect(resolveAccountIcon("cash")).toBe("cash");
    expect(resolveAccountIcon("credit_card")).toBe("card");
  });
});

describe("transaction type appearance", () => {
  const TYPES: TransactionType[] = ["expense", "income", "transfer", "credit_card_payment"];

  it.each(TYPES)("resolves a glyph for %s", (type) => {
    expect(isIconName(resolveTransactionIcon(type, null))).toBe(true);
  });

  it("gives an expense its category's glyph", () => {
    /*
     * Not a generic "expense" glyph. A column of activity rows should be readable at a glance as
     * groceries, transport, bills, which is the most informative thing in the row.
     */
    expect(resolveTransactionIcon("expense", "utensils")).toBe("cutlery");
    expect(resolveTransactionIcon("expense", "car")).toBe("car");
  });

  it("falls back for an expense whose category has no icon", () => {
    expect(resolveTransactionIcon("expense", null)).toBe("ellipsis");
  });

  it("uses a type glyph for the three kinds that have no category", () => {
    expect(resolveTransactionIcon("transfer", null)).toBe("transfer");
    expect(resolveTransactionIcon("credit_card_payment", null)).toBe("card");
    expect(resolveTransactionIcon("income", null)).toBe("arrow-in");
  });

  it("ignores a category icon on a type that cannot have one", () => {
    // Defensive, and worth asserting: a transfer row that borrowed a stale category glyph would
    // read as an expense.
    expect(resolveTransactionIcon("transfer", "utensils")).toBe("transfer");
    expect(resolveTransactionIcon("credit_card_payment", "utensils")).toBe("card");
  });
});
