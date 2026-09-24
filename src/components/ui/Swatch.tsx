import { Flex } from "@chakra-ui/react";
import { Icon } from "@/components/icons/Icon";
import type { IconName } from "@/components/icons/names";

/**
 * A bordered square holding a glyph.
 *
 * ## Why this is only the shell
 *
 * Section 6.4 describes `CategorySwatch`, `AccountSwatch` and the transaction-type marker, and the
 * obvious implementation puts all three here. That breaks the layering rule in
 * `docs/05-FOLDER-STRUCTURE.md`: **`components/ui` must stay generic**, and each of the three needs a
 * *feature's* resolver to decide its colour and glyph. ESLint enforces it, and rightly — a UI
 * primitive that knows what a credit card is stops being reusable and starts being a feature.
 *
 * So the geometry lives here and the three mappings live with the features that own them:
 *
 * ```text
 * features/categories/components/CategorySwatch.tsx
 * features/accounts/components/AccountSwatch.tsx
 * features/transactions/components/TransactionTypeSwatch.tsx
 * ```
 *
 * ## The three cases, and the one that differs
 *
 * | Swatch | Fill | Glyph colour |
 * | --- | --- | --- |
 * | category | one of the five swatch colours | ink, fixed in both modes |
 * | account | swatch colour by account type | ink, fixed in both modes |
 * | transaction type | **`surface`** | **`currentColor`** |
 *
 * The third is the odd one. It marks a *kind*, not an identity, so it carries no colour of its own —
 * and because its fill is `surface`, a fixed ink glyph would be invisible in dark mode. The mistake
 * in reverse (inheriting the text colour inside a coloured fill) is what `onSwatch` prevents. That is
 * the whole reason `fixedInk` is a required prop rather than defaulting to `true`: a caller has to
 * decide, because getting it wrong is invisible in light mode.
 */

export type SwatchSize = "sm" | "md" | "lg";

/** 20px in a breakdown row, 26px in a list, 32px in a detail header. */
const SIZES = {
  sm: { box: "20px", icon: "swatchSm" },
  md: { box: "26px", icon: "swatch" },
  lg: { box: "32px", icon: "swatchLg" },
} as const;

export type SwatchProps = {
  /** A semantic token — `swatch.mint`, `surface`. Never a hex value: the dark mode depends on it. */
  bg: string;
  icon: IconName;
  size?: SwatchSize;
  /**
   * Whether the glyph is pinned to ink.
   *
   * `true` inside a coloured fill; `false` on `surface`. Required, because both answers look correct
   * in light mode and only one of them is.
   */
  fixedInk: boolean;
};

export function Swatch({ bg, icon, size = "md", fixedInk }: SwatchProps) {
  const dimensions = SIZES[size];

  return (
    <Flex
      as="span"
      align="center"
      justify="center"
      width={dimensions.box}
      height={dimensions.box}
      flexShrink="0"
      bg={bg}
      borderWidth="thin"
      borderStyle="solid"
      borderColor="line"
    >
      {/*
        Always decorative. A swatch sits beside the name of the thing it depicts — a category, an
        account, a transaction — so its glyph is a second rendering of text that is already there.
      */}
      <Icon name={icon} size={dimensions.icon} onSwatch={fixedInk} />
    </Flex>
  );
}
