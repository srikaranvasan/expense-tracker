import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { FlatCompat } from "@eslint/eslintrc";
import prettierConfig from "eslint-config-prettier";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

/**
 * Layer boundaries from docs/05-FOLDER-STRUCTURE.md sections 18-19 are enforced
 * with lint rules rather than documentation alone, so a forbidden dependency
 * fails CI instead of quietly shipping.
 */
const forbiddenInDomain = [
  { group: ["react", "react-dom", "react/*"], message: "domain/ must not depend on React." },
  { group: ["next", "next/*"], message: "domain/ must not depend on Next.js." },
  { group: ["mongodb", "mongodb/*"], message: "domain/ must not depend on MongoDB." },
  { group: ["dexie", "dexie/*"], message: "domain/ must not depend on IndexedDB." },
  {
    group: ["next-auth", "next-auth/*", "@auth/*"],
    message: "domain/ must not depend on auth infrastructure.",
  },
  {
    group: ["@chakra-ui/*", "@emotion/*", "@/theme", "@/theme/*"],
    message: "domain/ must not depend on a UI library or the theme.",
  },
  {
    group: ["@/server/*", "@/offline/*", "@/app/*", "@/features/*", "@/components/*"],
    message: "domain/ must not depend on outer layers.",
  },
];

/**
 * Styling is a presentation concern. A server or lib module that imports a UI
 * library has taken on a responsibility that does not belong to it
 * (docs/05-FOLDER-STRUCTURE.md section 19).
 */
const noUiLibrary = (layer) => ({
  group: ["@chakra-ui/*", "@emotion/*", "@/theme", "@/theme/*"],
  message: `${layer} must not depend on a UI library or the theme.`,
});

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "out/**",
      "playwright-report/**",
      "test-results/**",
      "public/sw.js",
      "next-env.d.ts",
    ],
  },

  ...compat.extends("next/core-web-vitals", "next/typescript"),

  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": ["warn", { prefer: "type-imports" }],
      eqeqeq: ["error", "always", { null: "ignore" }],
      "no-console": ["error", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-restricted-syntax": [
        "error",
        {
          selector: "NewExpression[callee.name='Number']",
          message: "Do not coerce monetary values with Number(). Use lib/money instead.",
        },
      ],
    },
  },

  // Domain layer: pure financial rules only.
  {
    files: ["src/domain/**/*.ts"],
    rules: {
      "no-restricted-imports": ["error", { patterns: forbiddenInDomain }],
    },
  },

  // lib/ is generic infrastructure and must stay framework-free.
  {
    files: ["src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["mongodb", "mongodb/*"], message: "lib/ must not depend on MongoDB." },
            noUiLibrary("lib/"),
            {
              group: ["@/server/*", "@/offline/*", "@/features/*"],
              message: "lib/ must not depend on outer layers.",
            },
          ],
        },
      ],
    },
  },

  // server/ owns persistence and business orchestration, never presentation.
  {
    files: ["src/server/**/*.ts", "src/server/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            noUiLibrary("server/"),
            {
              group: ["dexie", "dexie/*", "@/offline/*"],
              message: "server/ must not depend on client-side storage.",
            },
          ],
        },
      ],
    },
  },

  // offline/ runs in the browser: no server-only code, and no MongoDB driver.
  {
    files: ["src/offline/**/*.ts", "src/offline/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["mongodb", "mongodb/*"], message: "offline/ must not import MongoDB." },
            {
              group: ["@/server/*", "@/app/*"],
              message: "offline/ must not depend on server-only code.",
            },
            noUiLibrary("offline/"),
          ],
        },
      ],
    },
  },

  // UI must never reach into the database layers directly.
  {
    files: ["src/components/**/*.tsx", "src/features/**/components/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["mongodb", "mongodb/*"], message: "UI must not import MongoDB." },
            {
              group: ["@/server/db/*", "@/server/repositories/*"],
              message: "UI must not import repositories or DB models.",
            },
            {
              group: ["dexie"],
              message: "UI must go through offline/repositories instead of Dexie directly.",
            },
          ],
        },
      ],
    },
  },

  // Generic UI primitives must stay free of financial rules.
  {
    files: ["src/components/ui/**/*.tsx"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/domain/*", "@/features/*"],
              message: "components/ui must stay generic (no domain or feature logic).",
            },
          ],
        },
      ],
    },
  },

  {
    files: ["**/*.test.ts", "**/*.test.tsx", "tests/**/*.ts", "scripts/**/*.ts"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  prettierConfig,
];

export default eslintConfig;
