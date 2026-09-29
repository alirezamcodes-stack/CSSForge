# Phase 06.5.1 — visual hierarchy and surface separation

**PHASE 06.5.1 COMPLETE.** Phase 06.5.2 and Phase 07 have not started.

The inspector now distinguishes its shell, property sections, nested editors and individual controls through restrained tone, spacing and borders. Open headers have a subtle tint and leading accent; collapsed rows retain consistent 42px height, aligned indicators and clearer dividers. Header/body separation and outer elevation remain lightweight, with inspector geometry preserved.

Typography groups use small internal boundaries. Background and shadow layer selections are more visible, and their existing selected editors use a slightly elevated surface with an 8px inset. Preset disclosures and positioning/inset groups have deliberate boundaries. Input edges, label gaps, disabled appearance and focus treatment are consistent. Filter label/value/slider groups are tighter without reducing slider track or thumb sizes.

## Files changed

- `src/styles/tokens.css`: restrained hierarchy tone/divider tokens.
- `src/ui/ui.module.css`: shell, section, group, divider and density styles.
- `src/ui/shared/propertyControls.module.css`: visual control edges and states.
- `tests/e2e/hierarchy.spec.ts`: one focused built-extension verification/capture flow.
- This report and the six screenshots below.

No production TS/TSX, property logic, units, preset collections, editing controllers, Code/HTML semantics or Navigator/picker behavior changed. Prior screenshots and the supplied reference package remain unchanged.

## Verification

- Typecheck: passed.
- Unit tests: **37/37 passed**, seven files.
- Production MV3 build: passed.
- Focused built-Chrome tests: **4/4 passed** (the new hierarchy flow plus three existing professional editing regressions).
- Confirmed section open/close, real typography/background/shadow/filter edits, keyboard/scrubber/color interactions, Undo/Reset, 320px and 390px layouts, no horizontal panel overflow, and actual 200% Chrome tab zoom. No runtime errors in tested flows.
- Reviewed all six captures against their corresponding Phase 06.5 images, using only the relevant CSS Pro inspector/effects screenshots for reference.

## Screenshots

1. [Collapsed sections](screenshots/phase-06.5.1/01-collapsed-sections.png)
2. [Typography open](screenshots/phase-06.5.1/02-typography-open.png)
3. [Background open](screenshots/phase-06.5.1/03-background-open.png)
4. [Box shadow open](screenshots/phase-06.5.1/04-box-shadow-open.png)
5. [Filters open](screenshots/phase-06.5.1/05-filters-open.png)
6. [Narrow viewport](screenshots/phase-06.5.1/06-narrow-viewport.png)

Remaining hierarchy issues: none blocking in the reviewed states. Long Background editors still use the inspector's existing primary vertical scroll area; no extra nested scrolling or large section cards were introduced.
