# Design Implementation Updates

One document per task group from [`../02-DESIGN-TASK-GROUPS.md`](../02-DESIGN-TASK-GROUPS.md),
written for a developer who did not do the work.

Separate from `docs/updates/`, which covers the MVP build (groups 1-20). Same seven headings,
same bar for "complete" — see section 3 of the task-groups document.

## Index

| Group | Document | Status |
| --- | --- | --- |
| 21 | [Design Decisions And Sign-off](GROUP-21-DESIGN-DECISIONS.md) | Complete — decisions recorded, seven pending designer confirmation |
| 22 | [Typography And Font Loading](GROUP-22-TYPOGRAPHY.md) | Complete |
| 23 | [Design Tokens](GROUP-23-DESIGN-TOKENS.md) | Complete — dark half written but not yet rendered |
| 24 | [Dark Mode Infrastructure](GROUP-24-DARK-MODE.md) | Complete — no contrast pass in dark yet (group 40) |
| 25 | [Icon System](GROUP-25-ICON-SYSTEM.md) | Complete — 14 in-house glyphs need designer review |
| 26 | [Form Primitives](GROUP-26-FORM-PRIMITIVES.md) | Complete — focus painting proven in group 40 |
| 27 | [Buttons And Actions](GROUP-27-BUTTONS.md) | Complete — clipped-Cancel bug fixed and measured |
| 28 | [Surfaces And Feedback](GROUP-28-SURFACES.md) | Complete — a tint is not a swatch (section 3.4) |
| 29 | [Money, Identity And Status Components](GROUP-29-MONEY-COMPONENTS.md) | Complete |
| 30 | [Application Shell And Navigation](GROUP-30-SHELL.md) | Complete — fixed a latent group 23 token collision |
| 31 | [Mobile Quick-Add](GROUP-31-QUICK-ADD.md) | Complete — dropped the duplicate mobile action row (section 3.8) |
| 32 | [Ledger Reference Codes](GROUP-32-REFERENCE-CODES.md) | Complete — corrected group 21 to derive from `clientId`; fixed a fixture bug |
| 33 | [Auth Screens](GROUP-33-AUTH-SCREENS.md) | Complete — fixed a group 26 bug that had hidden every input prefix |
| 34 | [Dashboard](GROUP-34-DASHBOARD.md) | Complete — card debt now coral as drawn; new `overLimit` badge kind |
| 35 | [Activity And Transaction Detail](GROUP-35-ACTIVITY.md) | Complete — new `contrast` button tone; fixed the crushed-title bug in the row |
| 36 | [Transaction Forms](GROUP-36-TRANSACTION-FORMS.md) | Complete — new `FormLayout`/`TintPanel`/`ReferenceBox`; forms own their layout |
| 37 | [Accounts Screens](GROUP-37-ACCOUNTS.md) | Complete — undrawn screens; new `archived` badge kind |
| 38 | [People And Settlements Screens](GROUP-38-PEOPLE-SETTLEMENTS.md) | Complete — the `BALANCED` stamp finally placed; settle-up matches its artboard |
| 39 | [Categories Screen](GROUP-39-CATEGORIES.md) | Complete — icon picker built as a real radio group |
| 40 | [Accessibility And Contrast Audit](GROUP-40-ACCESSIBILITY.md) | Complete — 8 defects fixed, incl. a 1.76:1 dark-mode button and a picker with no focus ring; screen-reader pass still manual |
| 41 | [Verification And Handoff Refresh](GROUP-41-VERIFICATION.md) | Complete — 1,690 tests and 143 captures pass; 2 e2e failures traced to a pre-existing sign-out defect that needs its own task |

Link the document and change the status as each group lands, so the table is the answer to
"where is the redesign up to".

**The series is complete.** Two things are outstanding and neither belongs to it:

1. **Sign-out does not end the session** — a pre-existing auth-layer defect the final verification
   surfaced. Diagnosed with evidence in [group 41, section 3.1](GROUP-41-VERIFICATION.md). This
   should be the next task.
2. **Designer sign-off** on three darkened palette values, sixteen dark screens and forty screens
   that were never drawn. All of it is listed in section 6 of
   [`design/screenshots/README.md`](../../../design/screenshots/README.md), with the refreshed
   captures beside it.

## Reading order for a new developer

1. `design/ux/DESIGN.md` — the designer's intent, in their words
2. `design/ux/index.html` — the drawn screens, in a browser
3. `../01-DESIGN-SYSTEM.md` — the rules those screens were turned into
4. These documents, in group order

Group 21 is the one to read even if you are only touching one screen: it records the answers
to the questions the handoff left open, and those answers constrain everything after it.
