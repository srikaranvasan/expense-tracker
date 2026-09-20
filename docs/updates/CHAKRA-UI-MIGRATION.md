# Chakra UI Migration

Not a numbered task group. This records a mid-build change of styling system, made
after group 4, and the items added to group 1 to cover it.

## 1. What was built

The UI was originally built with Tailwind CSS v4. It was migrated to Chakra UI v3
before further screens were written, so the theme and shared primitives exist before
the bulk of the interface.

Delivered: a Chakra theme with semantic tokens, the provider, rebuilt
`components/ui` primitives, all existing screens converted, Tailwind removed, and a
component test helper plus the first component tests.

The architecture documents were updated first — `00-README.md`,
`04-USER-FLOWS.md`, `05-FOLDER-STRUCTURE.md`, `06-CODING-PRACTICES.md`,
`07-MVP-IMPLEMENTATION-PLAN.md`, `11-TESTING-STRATEGY.md`, `13-MVP-TASK-GROUP.md` —
because none of them had named a styling approach.

## 2. Files added, changed, removed

### Added — `src/theme/`

| File | Purpose |
| --- | --- |
| `tokens.ts` | Raw primitives: brand ramp, `money.in` / `money.out`, ink greys, `radii.card`, `sizes.touch`, `sizes.content` |
| `semantic.ts` | Meanings, not colours: `surface`, `content`, `line`, `positive`, `negative`, `warning`, and `brand` as a full Chakra palette |
| `index.ts` | `createSystem(defaultConfig, config)`, `globalCss`, the `amount` text style |

### Added — application

- `src/app/providers.tsx` — the only new Client Component.
- `src/components/layout/SkipToContent.tsx` — extracted from the old stylesheet's
  focus-visible utility.
- `src/components/ui/AppLink.tsx` — `AppLink` and `RowLink`.
- `tests/helpers/render.tsx` — `renderWithProviders()`.
- `src/components/ui/Field.test.tsx`, `src/components/ui/BalanceBadge.test.tsx`.

### Rewritten

Every component and page: `components/ui/{Button,Field,Card,BalanceBadge}`,
`components/feedback/{Alert,EmptyState}`,
`components/layout/{AppShell,BottomNav,PageHeader}`, all
`features/*/components/*`, and every page under `app/(auth)/` and `app/(app)/`.

### Removed

`src/app/globals.css`, `postcss.config.mjs`, `src/components/ui/cn.ts`, and the
`tailwindcss` and `@tailwindcss/postcss` dependencies.

### Changed

- `next.config.ts` — added `experimental.optimizePackageImports: ["@chakra-ui/react"]`.
- `eslint.config.mjs` — `domain/`, `server/`, and `lib/` may not import
  `@chakra-ui/*`, `@emotion/*`, or `@/theme`.

## 3. Key decisions

### Semantic tokens, not raw colours at call sites

Components reference `positive`, `negative`, `warning`, `content.muted`,
`surface.sunken`. No component contains a hex value. The financial set is deliberately
small because the same four meanings recur on every screen.

`brand` is defined as a complete Chakra palette (`solid`, `contrast`, `fg`, `muted`,
`subtle`, `emphasized`, `focusRing`) so `colorPalette="brand"` resolves correctly
without per-component overrides.

### `Button` takes `tone`, not Chakra's `variant`

Chakra's variants are `solid | subtle | surface | outline | ghost | plain` — a
vocabulary about appearance. The wrapper exposes
`tone="primary" | "secondary" | "ghost" | "danger"` instead.

"danger" is a statement about consequence; "solid red" is a statement about pixels.
Call sites should say what the action means, and the mapping between the two belongs
in one file. The wrapper also defaults `type="button"`, so a button inside a form
cannot submit it by accident.

### `invalid` moved from the input to the field

Chakra's `Field.Root` propagates invalid state through context, so `aria-invalid`
reaches the control automatically. Roughly twenty call sites lost a redundant
`invalid={Boolean(errors.x?.length)}` prop, and the error text now always renders
through `Field.ErrorText`, which is what makes it announced rather than colour-only.

### Native select, not a custom listbox

`SelectInput` wraps `NativeSelect`. On iOS the OS picker is faster one-handed and
needs no accessibility work of its own. Inputs default to `size="lg"` because a
sub-16px font makes iOS Safari zoom on focus.

### `Stack asChild` for forms, not `as="form"`

Chakra's `as` prop does not widen the prop types, so `<Stack as="form" action={...}>`
fails to typecheck — `action` is not a `StackProps` member. `asChild` hands rendering
to a real `<form>` element and keeps both the layout styling and the server-action
wiring:

```tsx
<Stack asChild gap="4">
  <form action={formAction} noValidate>…</form>
</Stack>
```

### No dark mode, so no `next-themes`

The Chakra Next.js guide composes `ThemeProvider` from `next-themes`. Dark mode is not
in MVP scope, so the dependency was skipped. Without the `.dark` class the `_dark`
condition never activates and everything renders light. Adding it later means adding
one provider.

### `DetailRow` became a real `DataList` item

Previously two visually adjacent divs. Now `DataList.Item` / `ItemLabel` / `ItemValue`,
so the label-value relationship is exposed to assistive technology instead of being
purely visual.

### `RowLink` makes the whole row the target

List rows are the most-tapped elements in the app. A full-row link with `minH="touch"`
is far easier to hit on a phone than a text link inside the row.

### Amounts carry a text style

`textStyle="amount"` applies tabular figures. A column of amounts only scans well if
the digits align, which makes this a legibility requirement rather than decoration.

### The lint rules were extended

`05-FOLDER-STRUCTURE.md` section 19 now forbids `domain → Chakra UI`,
`server → Chakra UI`, `lib → Chakra UI`. Styling is a presentation concern; a domain
module importing a UI library has taken on a responsibility that is not its own. The
rule makes it fail CI rather than rely on review.

## 4. Business rules enforced

No financial rules changed. One accessibility rule is now structural:

```text
Colour is never the only signal for a financial meaning
```

`BalanceBadge` always renders a direction label ("owes you" / "you owe") next to the
amount, and both component tests assert the label is present.

## 5. How it was verified

```text
npx tsc --noEmit         clean
npx eslint .             clean
npx prettier --check .   clean
npx vitest run           221 tests across unit, integration, ui
npx next build           succeeds, 24 routes
```

Nine new component tests in the `ui` project. They assert on roles, labels, and
`aria-invalid` rather than class names, because styling is expected to change while
the meaning of a control is not.

`Field.test.tsx` verifies the label actually resolves to the control
(`getByLabelText` only succeeds if the association is real), that `aria-invalid` is set
when errors are present, that the error message is rendered as text, that the hint is
replaced rather than stacked with the error, and that a native select is wired the same
way.

Confirmed clean removal: no `className=` remains anywhere in `src/`, no Tailwind
reference in `package.json`.

### Bundle effect

`/register` had been 40.3 kB because the client form imported the schema module, which
pulls in Zod. Splitting the plain option constants into `features/auth/options.ts`
brought it to 2.5 kB. Chakra adds roughly 15-25 kB to each page's first load, which is
the expected cost of a component library.

## 6. Known gaps

- No dark mode.
- No toast or dialog usage yet. Confirmations are inline expanding panels, which suits
  the current flows; group 8's split editor may want a dialog.
- No visual regression testing. Component tests cover semantics, not appearance.
- Only two primitives have component tests. More should be added as the surface grows,
  per group 19.

## 7. Notes for the next group

- Build screens from `components/ui` first. Reach for a raw Chakra component only when
  no project default is needed, and wrap it only when there is a real default,
  constraint, or accessibility guarantee to add.
- Never write a hex colour or a raw pixel value in a component. If a token is missing,
  add it to `theme/`.
- Amounts get `textStyle="amount"`.
- Chakra's layout primitives render on the server. Only interactive components need
  `"use client"` — do not mark a whole page client just to use `Box`.
- Component tests must use `renderWithProviders` from `tests/helpers/render.tsx`;
  Chakra components read the theme from context and lose every token without it.
