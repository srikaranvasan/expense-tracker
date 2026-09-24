# Navigation Implementation Updates

One document per task group from [`../02-NAVIGATION-TASK-GROUPS.md`](../02-NAVIGATION-TASK-GROUPS.md),
written for a developer who did not do the work.

Separate from `docs/updates/` (the MVP build, groups 1-20) and `docs/design-tasks/updates/` (the
"Ledger Geometry" restyle, groups 21-41). Same seven headings, same bar for "complete" — see
section 3 of the task-groups document.

## Index

| Group | Document | Status |
| --- | --- | --- |
| 42 | [Navigation Decisions And Sign-off](GROUP-42-NAVIGATION-DECISIONS.md) | Complete — decisions recorded; the view-model audit made group 47 far cheaper than costed |
| 43 | [The Back Link Primitive](GROUP-43-BACK-LINK-PRIMITIVE.md) | Complete — `chevron-left` is the 15th in-house glyph awaiting designer review |
| 44 | [`PageHeader` Learns About Parents](GROUP-44-PAGE-HEADER-PARENT.md) | Complete — one existing test's selector changed, with reasons (section 3.3) |
| 45 | [Detail Pages Get A Way Up](GROUP-45-DETAIL-PAGES.md) | Complete — closes the `/settlements/[id]` dead end |
| 46 | [Forms Get A Way Up And A Way Out](GROUP-46-FORMS.md) | Complete — 7 `router.back()` calls replaced; scroll-restoration trade accepted |
| 47 | [The Dead Ends And The Guards](GROUP-47-DEAD-ENDS-AND-GUARDS.md) | Complete — 5 guards, the "Cannot edit" screen, 6 linked detail rows; no data-layer change |
| 48 | [Verification And Recapture](GROUP-48-VERIFICATION.md) | Complete — see section 3 for the e2e run that hit the real database |

Link the document and change the status as each group lands, so the table is the answer to "where
is the navigation work up to".

**The series is complete.** What is outstanding:

1. **Designer sign-off on the back link.** It introduces no new token or colour, but its placement
   above the page title is drawn in no artboard — there is no back affordance anywhere in
   `design/ux/screens/`. Listed with the other pending reviews in
   [`design/screenshots/README.md`](../../../design/screenshots/README.md) section 6.
2. **`/settlements` is still not a nav destination**, by decision
   ([group 42, section 3.2](GROUP-42-NAVIGATION-DECISIONS.md)) rather than oversight. It is two
   taps from anywhere after group 47.
3. **Sign-out does not end the session** — a pre-existing auth defect the design series' final
   verification surfaced, diagnosed in `docs/design-tasks/updates/GROUP-41-VERIFICATION.md`
   section 3.1. Still unaddressed, still the strongest candidate for the next task. Untouched by
   this series.

## Reading order for a new developer

1. [`../01-NAVIGATION-AUDIT.md`](../01-NAVIGATION-AUDIT.md) — what was wrong, route by route, and
   the four defect classes the groups refer to by name
2. [Group 42](GROUP-42-NAVIGATION-DECISIONS.md) — the answers that constrain everything after it
3. [Group 43](GROUP-43-BACK-LINK-PRIMITIVE.md) and [44](GROUP-44-PAGE-HEADER-PARENT.md) — the two
   pieces every other group applies
4. The rest, in group order

Group 42 is the one to read even if you are only touching one screen. In particular section 3.9,
which records that every id needed to link a named record was already on the view models — a fact
that is invisible from reading the detail types, because the fields come from a base type.

## The shape of the fix, in one paragraph

The app had a complete frame — five nav destinations in a header, the same five in a tab bar, a
quick-add button — and **nothing on any page pointing upward**. Fifteen of twenty-eight screens
had no on-screen way back; three could not be left at all. The fix is one primitive (`BackLink`),
one optional prop (`PageHeader.parent`), one module that keeps parent labels agreeing with the
navigation (`Parents.ts`), seven `router.back()` calls replaced with hierarchy pushes, five guard
alerts given actions, and six detail rows turned from strings into links. No data model, no
business rule, and no financial calculation changed.
