import { defineSemanticTokens } from "@chakra-ui/react";

/**
 * Semantic tokens.
 *
 * These name a *meaning*, not a colour. Components use these so the intent is
 * readable at the call site and the palette can change without touching them
 * (docs/05-FOLDER-STRUCTURE.md section 5).
 *
 * The financial set is deliberately small, because the same four meanings recur
 * across every screen:
 *
 *   positive  money coming in, or a person owing the user
 *   negative  money going out, or the user owing a person
 *   warning   over a credit limit, or an unsettled balance
 *   muted     secondary and supporting text
 *
 * Colour is never the only signal. Every use is paired with a text label so the
 * meaning survives for colour-blind users and screen readers
 * (docs/06-CODING-PRACTICES.md section 40).
 */
export const semanticTokens = defineSemanticTokens({
  colors: {
    surface: {
      DEFAULT: { value: "white" },
      muted: { value: "{colors.ink.50}" },
      sunken: { value: "{colors.ink.100}" },
    },

    content: {
      DEFAULT: { value: "{colors.ink.800}" },
      muted: { value: "{colors.ink.600}" },
      subtle: { value: "{colors.ink.400}" },
      inverted: { value: "white" },
    },

    line: {
      DEFAULT: { value: "{colors.ink.200}" },
    },

    positive: {
      DEFAULT: { value: "{colors.money.in}" },
      surface: { value: "{colors.money.inSoft}" },
    },

    negative: {
      DEFAULT: { value: "{colors.money.out}" },
      surface: { value: "{colors.money.outSoft}" },
    },

    warning: {
      DEFAULT: { value: "{colors.caution.500}" },
      surface: { value: "{colors.caution.50}" },
    },

    /**
     * Drives Chakra's `colorPalette="brand"`, so branded components pick up the
     * right foreground and background without per-component overrides.
     */
    brand: {
      solid: { value: "{colors.brand.500}" },
      contrast: { value: "white" },
      fg: { value: "{colors.brand.700}" },
      muted: { value: "{colors.brand.50}" },
      subtle: { value: "{colors.brand.100}" },
      emphasized: { value: "{colors.brand.600}" },
      focusRing: { value: "{colors.brand.500}" },
    },
  },
});
