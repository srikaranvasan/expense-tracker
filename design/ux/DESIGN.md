# Expense Tracker — Design Handoff

First-draft visual design for the Expense Tracker PWA, styled as a personal auditing tool: pastel colors, sharp geometric edges, and typography/markers borrowed from ledger and audit-stamp conventions. This document is for whoever builds the UI — it explains the system so new screens stay consistent with the ones already drawn, and flags what's still missing.

Open `index.html` in this folder to browse every screen as plain HTML/CSS (no build step, no framework — just open the files in a browser).

## What's designed vs. what's still needed

**Designed:** style guide, sign in, dashboard (light + dark, desktop + mobile), add expense (desktop + mobile), activity / transaction list (desktop), settle up (desktop), and the mobile quick-add FAB in its expanded state.

**Not designed yet** — build these from the tokens/components below rather than inventing a new style:

- Accounts list and account-detail pages
- People list and a per-person detail/history page
- Categories list, plus the inline add/edit form for a category (no modal — see Product rules)
- Full forms for Split a bill, Transfer, and Pay card (right now these only exist as buttons/nav highlights)
- An edit-expense state, if it needs to differ from add-expense (e.g. a delete action)
- Sign-up screen (Login currently has a "Create one" link that goes nowhere)
- Dark-theme and mobile versions of Activity and Settle up
- The bottom tab bar + quick-add FAB pattern, applied consistently to every mobile screen (only 3 mobile screens have it so far)

## Design tokens

### Color — light theme

| Role                      | Hex                             | Used for                                                |
| ------------------------- | ------------------------------- | ------------------------------------------------------- |
| Page background           | `#FAF7F2`                       | app background                                          |
| Surface                   | `#FFFFFF`                       | cards, inputs, headers                                  |
| Ink (primary text/border) | `#1E1B29`                       | all borders, headings, primary text                     |
| Secondary text            | `#5B5770`                       | nav links, labels, subtitles                            |
| Tertiary/meta text        | `#8B87A0`                       | timestamps, helper text                                 |
| Primary accent (teal)     | `#7FD1C3` fill / `#1D7A6C` text | primary buttons, active nav, logo mark, links           |
| Accent tint               | `#DCF3EE`                       | net-position banner, reference boxes                    |
| Positive / "owes you"     | `#BFEBD2` fill / `#2E8A61` text | avatars, tiles, in-arrow amounts                        |
| Negative / "you owe"      | `#FFC7B8` fill / `#D1523F` text | avatars, tiles, out-arrow amounts, required-field marks |
| Pending / neutral accent  | `#FCE49B`                       | electricity category, spend tile                        |
| Category — shopping       | `#C0DBF7`                       |                                                         |
| Category — groceries      | `#BFEBD2`                       |                                                         |

### Color — dark theme

| Role                      | Hex                             | Used for                            |
| ------------------------- | ------------------------------- | ----------------------------------- |
| Page background           | `#141220`                       | app background                      |
| Surface                   | `#1E1B2C`                       | cards, inputs, headers              |
| Ink (primary text/border) | `#F3F0FA`                       | all borders, headings, primary text |
| Secondary text            | `#B7B2CC`                       | nav links, labels, subtitles        |
| Tertiary/eyebrow text     | `#9B96B3`                       | small caps labels                   |
| Meta text                 | `#8B87A0`                       | timestamps (same value as light)    |
| Primary accent (teal)     | `#4FB9A8` fill / `#7EE3D2` text | primary buttons, active nav, links  |
| Accent tint               | `#16302C`                       | net-position banner                 |
| Positive / "owes you"     | `#8FDBB4` fill / `#8CE3B2` text |                                     |
| Negative / "you owe"      | `#FF9F8C` fill / `#FF9C86` text |                                     |
| Pending / neutral accent  | `#F0CE6E`                       |                                     |
| Category — shopping       | `#93C3F0`                       |                                     |
| Category — groceries      | `#8FDBB4`                       |                                     |

Icons drawn _inside_ a colored swatch or avatar (category icons, avatar initials) are always stroked/filled in the **light-theme ink `#1E1B29`**, in both themes — every fill they sit on (teal, mint, coral, butter, sky) is bright enough that dark ink stays readable. Icons everywhere else use `currentColor` so they inherit whatever text color surrounds them.

### Typography

- **Space Grotesk** (500/600/700) — headings, nav labels, button labels, tab bar labels.
- **Manrope** (400/500/600/700) — body copy, form inputs, descriptions.
- **IBM Plex Mono** (500/600) — every number, date, and reference/transaction code, plus small-caps eyebrow labels (uppercase, `letter-spacing: .07–.1em`). Amounts use `font-variant-numeric: tabular-nums` so digits align in columns.

All three load from Google Fonts (`css2?family=Space+Grotesk:wght@500;600;700&family=Manrope:wght@400;500;600;700&family=IBM+Plex+Mono:wght@500;600`).

### Geometry & elevation

- **Zero border-radius, everywhere.** No rounded corners on anything — buttons, cards, inputs, avatars, swatches.
- **Hard offset shadows, no blur:** `box-shadow: Npx Npx 0 <ink-color>`, where N scales with the element's importance (4px for buttons, 6–8px for cards/modals-that-aren't-modals).
- Borders are 1.5–2px solid ink; lighter dividers use `rgba(ink, 0.10–0.28)`.
- The logo mark and category/account icons are drawn as small inline stroke SVGs (never emoji, never icon fonts) with a consistent 1.2–1.8px stroke weight.
- A few "audit" motifs recur on purpose: a diamond logo mark (a square rotated 45°), square (never circular) avatars with initials, corner "registration tick" brackets on the sign-in card, and dashed-border rotated "stamps" for status text (e.g. **BALANCED**, **AUDITED · OK**) — these reinforce the ledger/audit framing the whole app is built around.

### Components

- **Buttons** — primary: teal fill, ink border, hard shadow. Secondary: white/surface fill, ink border, no shadow. Icon-only (e.g. sign-out): a plain square with just the icon centered — give it a `title`/`aria-label` since there's no visible text.
- **Inputs** — 1.5px ink-alpha border, surface background, ~13px padding, square corners.
- **"Select display"** — every dropdown-looking control (paid-from account, category, etc.) is a **real native `<select>`** skinned to look like a bordered box with the current value plus a chevron icon. Keep the native element for keyboard/screen-reader support; only the visual chrome is custom.
- **Avatars** — square, ink border, initials, filled with whatever color fits the context (teal for self, mint/coral for other people depending on balance direction).
- **Category swatches** — small (20px) bordered square containing a category icon, rather than a bare color dot.
- **Direction arrows** — a small in/out arrow glyph always precedes an "owes you" / "you owe" amount, in addition to (never instead of) spelling the direction out in words.
- **Navigation** — desktop: horizontal top nav, icon + label links, active item gets ink text + a teal underline. Mobile: bottom tab bar with icon-over-label stacks; active tab gets the same teal underline treatment.
- **Mobile quick-add** — a small square "+" floating action button, bottom-right, positioned `absolute` _inside_ the screen's own container (not `fixed` — that escapes the artboard and can end up rendering in the wrong stacking context) so it always sits ~20px above the bottom tab bar. Tapping it should expand four stacked action pills above it (Add expense, Split a bill, Transfer, Pay card) over a dimmed scrim — see `Mobile-QuickAdd-Expanded.html` for the expanded state. A press-and-hold on the FAB itself is meant to jump straight to Add expense as a shortcut; there's currently no visible hint that this gesture exists, which is worth a product decision before shipping it.

## Product rules the UI has to respect

These come from how the real app works, not just visual preference — please don't design around them:

- **Every number is computed, never cached.** Balances, totals, and "net position" are recalculated on load. Don't design anything that implies a stored/"as of" value beyond a plain timestamp label (see the Dashboard's "AS OF ..." text) — no "live" badges or similar.
- On a shared expense, **three amounts must stay visibly distinct**: the total paid, your own share, and what others owe — never collapse these into a single figure.
- **Direction is always spelled out in words** ("Ravi owes you", "you owe Priya") — never a bare signed number or color alone to convey who owes whom.
- **No modals or dialogs anywhere in the app.** Every add/edit interaction is inline on the page (e.g., adding a category appends an inline form; it does not open a popup).
- **Single responsive breakpoint at 768px.** Below it, use the mobile layouts (designed at iPhone 16 Pro's 393–402px content width) rather than a fluid in-between layout.
- **Tabular/mono figures** for all money amounts, dates, and reference/transaction codes.

### Known bugs in the current app — don't repeat these

- The Cancel button on every create/edit form is clipped off the right edge of the screen, so there is currently no reachable way to cancel a form anywhere in the real app. The redesigned forms (Add expense, Settle up) already put Cancel in a safe, reachable position — keep it that way.
- Mobile page titles were getting crushed by their own header action buttons at 402px width. The redesigned mobile header (slimmer, icon-only sign-out, avatar badge) already fixes this — don't reintroduce a wide text button in that header.

## Where to go from here

Build the missing screens listed at the top from the same tokens and components — nothing there should need a new visual idea, just an application of what's already established. If you have access to the account, the live version of this design (with light/dark toggle) is here: https://claude.ai/artifact/AgPzbvyL1rczXoLcnubbSy
