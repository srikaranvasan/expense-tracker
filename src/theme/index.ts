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
 * Every semantic token carries a `_dark` value as of group 23. The colour-mode provider
 * that activates them arrives in group 24; until then the dark half is written but dormant,
 * which is deliberate — retrofitting `_dark` across forty tokens later is worse than
 * writing them once, and it keeps the two halves of the palette reviewable side by side.
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
      // Manrope. Set here rather than relied on from Chakra's default, so the body face
      // is a property of the document and a component that forgets to say so inherits
      // the right one.
      fontFamily: "body",
      minHeight: "100dvh",
      // Respects the iPhone home-indicator area when installed as a PWA.
      paddingBottom: "env(safe-area-inset-bottom)",
    },

    /**
     * Nothing in this design is round.
     *
     * Belt and braces alongside the `radii.l1/l2/l3` override in `semantic.ts`, because the
     * two fail differently: the token override misses anything that hard-codes a radius —
     * a third-party stylesheet, a browser default on `<progress>`, an inline style — and
     * this misses nothing but cannot be overridden locally.
     *
     * The `!important` is what makes it reliable and is the reason it is scoped to
     * `border-radius` alone. If one element ever genuinely needs a radius, remove it from
     * this selector rather than fighting it.
     */
    "*, *::before, *::after": {
      borderRadius: "0 !important",
    },
  },

  theme: {
    tokens,
    semanticTokens,

    textStyles: {
      /**
       * Monetary amounts, dates and reference codes.
       *
       * Tabular figures keep a column of amounts aligned, which is what makes a
       * transaction list scannable (docs/06-CODING-PRACTICES.md section 41).
       *
       * Now carries the mono family too, so "every number is mono" is one decision at one
       * site rather than a convention each screen has to remember
       * (docs/design-tasks/01-DESIGN-SYSTEM.md section 4).
       */
      amount: {
        value: {
          fontFamily: "mono",
          fontVariantNumeric: "tabular-nums",
          fontFeatureSettings: '"tnum"',
        },
      },

      /**
       * The small-caps mono label above almost every block in this design, and the
       * treatment field labels now use.
       *
       * `textTransform` rather than pre-uppercased strings: a screen reader announcing
       * "P A I D   F R O M" is the cost of shouting in the markup, and the visual result
       * is identical.
       */
      eyebrow: {
        value: {
          fontFamily: "mono",
          fontSize: "eyebrow",
          fontWeight: "600",
          letterSpacing: "eyebrow",
          textTransform: "uppercase",
          color: "content.muted",
        },
      },

      /** Uppercase mono inside a bordered status chip (section 7.4). */
      badge: {
        value: {
          fontFamily: "mono",
          fontSize: "badge",
          fontWeight: "500",
          letterSpacing: "badge",
          textTransform: "uppercase",
        },
      },
    },
  },
});

export const system = createSystem(defaultConfig, config);
