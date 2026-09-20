import { createSystem, defaultConfig, defineConfig } from "@chakra-ui/react";
import { semanticTokens } from "./semantic";
import { tokens } from "./tokens";

/**
 * The Chakra styling system.
 *
 * Built on `defaultConfig` rather than from scratch: the defaults carry the
 * component recipes and conditions, and this config only adds what the project
 * actually needs to change.
 *
 * Dark mode is intentionally not part of the MVP, so no colour-mode provider is
 * wired up and the `_dark` condition never activates.
 */
const config = defineConfig({
  globalCss: {
    html: {
      // Stops iOS from silently enlarging text in landscape.
      textSizeAdjust: "100%",
      WebkitTapHighlightColor: "transparent",
    },
    body: {
      bg: "surface.muted",
      color: "content",
      minHeight: "100dvh",
      // Respects the iPhone home-indicator area when installed as a PWA.
      paddingBottom: "env(safe-area-inset-bottom)",
    },
  },

  theme: {
    tokens,
    semanticTokens,

    textStyles: {
      /**
       * Monetary amounts.
       *
       * Tabular figures keep a column of amounts aligned, which is what makes a
       * transaction list scannable (docs/06-CODING-PRACTICES.md section 41).
       */
      amount: {
        value: {
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum"',
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
