import { defineTokens } from "@chakra-ui/react";

/**
 * Raw design tokens.
 *
 * These are the primitive values. Nothing in the application references them
 * directly: components use the semantic tokens in `semantic.ts`, so a palette
 * change happens in one place (docs/05-FOLDER-STRUCTURE.md section 5).
 */
export const tokens = defineTokens({
  colors: {
    brand: {
      50: { value: "#eef2ff" },
      100: { value: "#e0e7ff" },
      200: { value: "#c7d2fe" },
      300: { value: "#a5b4fc" },
      400: { value: "#818cf8" },
      500: { value: "#4f5bd5" },
      600: { value: "#4338ca" },
      700: { value: "#3730a3" },
      800: { value: "#312e81" },
      900: { value: "#1e1b4b" },
    },

    /** Money in, or a person owing the user. */
    money: {
      in: { value: "#15803d" },
      inSoft: { value: "#f0fdf4" },
      /** Money out, or the user owing a person. */
      out: { value: "#b91c1c" },
      outSoft: { value: "#fef2f2" },
    },

    caution: {
      500: { value: "#b45309" },
      50: { value: "#fffbeb" },
    },

    ink: {
      50: { value: "#f8fafc" },
      100: { value: "#f1f5f9" },
      200: { value: "#e2e8f0" },
      400: { value: "#94a3b8" },
      600: { value: "#475569" },
      800: { value: "#1e293b" },
      900: { value: "#0f172a" },
    },
  },

  radii: {
    card: { value: "0.875rem" },
  },

  sizes: {
    /** Comfortable minimum touch target for one-handed use. */
    touch: { value: "2.75rem" },
    /** Maximum content width on desktop. */
    content: { value: "64rem" },
  },

  fonts: {
    body: {
      value:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
    heading: {
      value:
        'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    },
  },
});
