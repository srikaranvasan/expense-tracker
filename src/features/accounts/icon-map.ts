import type { IconName } from "@/components/icons/names";
import type { SwatchColor } from "@/features/categories/icon-map";
import { swatchToken } from "@/features/categories/icon-map";
import type { AccountType } from "@/types/common";

/**
 * Glyph and swatch colour per account type.
 *
 * Unlike categories (`features/categories/icon-map.ts`), this needs no resolver and no
 * fallback: `AccountType` is a closed union of three, so the mapping is total and the compiler
 * enforces that a fourth type cannot be added without deciding how it looks.
 *
 * The colours are not arbitrary. They line up with the meaning the rest of the palette already
 * carries: bank is the brand teal, cash is the positive mint, and a credit card is coral —
 * the negative fill — because a card is a liability rather than money the user holds
 * (`isAssetAccount` in `domain/accounts/entities.ts`). Section 6.4.
 */

type AccountAppearance = {
  icon: IconName;
  swatch: SwatchColor;
};

const ACCOUNT_APPEARANCE: Record<AccountType, AccountAppearance> = {
  bank: { icon: "bank", swatch: "teal" },
  cash: { icon: "cash", swatch: "mint" },
  credit_card: { icon: "card", swatch: "coral" },
};

export function resolveAccountAppearance(type: AccountType): AccountAppearance & {
  /** `swatch.coral`, ready for a `bg` prop. */
  swatchToken: string;
} {
  const appearance = ACCOUNT_APPEARANCE[type];

  return { ...appearance, swatchToken: swatchToken(appearance.swatch) };
}

export function resolveAccountIcon(type: AccountType): IconName {
  return ACCOUNT_APPEARANCE[type].icon;
}
