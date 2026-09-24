import { Swatch } from "@/components/ui/Swatch";
import type { SwatchSize } from "@/components/ui/Swatch";
import type { AccountType } from "@/types/common";
import { resolveAccountAppearance } from "../icon-map";

export type AccountSwatchProps = {
  type: AccountType;
  size?: SwatchSize;
};

/**
 * An account's colour and glyph, from its type.
 *
 * No resolver logic and no fallback: `AccountType` is a closed union of three, so the mapping is total
 * and the compiler stops a fourth type being added without deciding how it looks.
 *
 * The colours are not arbitrary — teal is the brand, mint is positive, coral is negative, and a credit
 * card is a liability rather than money held (`isAssetAccount` excludes it), so it gets coral.
 */
export function AccountSwatch({ type, size = "lg" }: AccountSwatchProps) {
  const appearance = resolveAccountAppearance(type);

  return <Swatch bg={appearance.swatchToken} icon={appearance.icon} size={size} fixedInk />;
}
