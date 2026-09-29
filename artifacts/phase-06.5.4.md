# Phase 06.5.4 — Professional CSS value and unit system

**PHASE 06.5.4 COMPLETE.** No cascade/selector engine, Changes/export, animation tooling or Phase 07 work started.

## Shared model and integration

`src/editing/values.ts` owns scalar parsing, property-specific unit menus, authored/editor versus computed-reference representation, structured-value classification, conversion availability, numeric formatting and per-unit stepping. `NumericScrubber` uses it across Design dimensions, spacing, typography, borders, offsets, box/text shadow lengths and gradient angles/stops. Filters retain their fixed-unit behavior.

Known inline and session values retain meaningful units. Inline `calc()`/`var()` and keywords now remain in the editor rather than being replaced by computed pixels. CSSOM can normalize authored expression spelling; expressions remain intact and are not scrubbed or converted. The browser still validates real edits. Zero can retain an explicit unit or be a valid unitless zero. Precision is capped at four decimal places for generated px values and six for other generated values, avoiding visible round-trip noise.

The compact picker converts size rather than swapping suffixes. Unavailable options stay disabled with a reason; valid explicit manual entry remains available. Relative-unit scrubbing uses the current unit (em/rem/ch/rad/s use 0.1, turns use 0.01, other usual units use 1), with existing Shift/Alt multipliers, Enter and Escape. Unit conversions use one ordinary session transaction and retain Undo/Reset, target isolation and actual units in Code output.

## Property-aware unit mapping

| Property/control | Units |
| --- | --- |
| Width, height | px, %, em, rem, vw, vh, vmin, vmax, ch |
| Margin, padding, font size, position offsets | px, %, em, rem, vw, vh |
| Letter spacing, border width, shadow x/y/blur/spread | px, em, rem |
| Border radius | px, %, em, rem |
| Line height | unitless, px, %, em, rem |
| Opacity | unitless, % |
| Font weight, z-index | unitless |
| Existing gradient angle | deg, rad, turn |
| Existing gradient stop positions | %, px, em, rem |
| Shared model only: rotate/time categories | deg/rad/turn; ms/s. No new controls added. |

## Conversion rules and limits

- px/rem use root font size; px/em use parent font size for font-size and element font size elsewhere. Unitless line-height and its % values use element font size; font-size % uses parent font size.
- vw/vh/vmin/vmax use the current viewport when the root does not force scrollbars or reserve a stable scrollbar gutter.
- Angles and time use fixed mathematical ratios. Opacity supports the existing safe percentage representation plus unitless conversion.
- Width and margin/padding % use a content-width reference only for a conservative immediate normal-flow block/flow-root container: horizontal writing, a definite inline `!important` width, no animation/transition, no multi-column sizing, and a block/flow-root grandparent rather than a flex/grid-item ambiguity. Border-box padding/borders are subtracted. Vertical margins/padding correctly use the width reference.
- Scalar border-radius % conversion requires a square CSS border box, because a single percentage otherwise changes its horizontal and vertical radii differently.
- Direct scalar fields and visible shadow/gradient components are checked against freshly computed references. When the editor value does not match a known rendered reference (for example min-width clamping), conversion is unavailable. This is a conservative guard, not cascade resolution.
- Height/offset percentages, ambiguous containing blocks, non-square radius percentages and nonzero gradient-stop %/length conversion are intentionally unavailable. Zero-length conversions remain safe without a percentage basis.
- ch manual entry is supported for dimensions; conversion to/from other units is unavailable because no font-metric basis is guessed.
- Font/layout-dependent conversions in media/pseudo editing contexts are conservatively unavailable. Root-element font-size em/rem/% conversion is not inferred from its own computed font size.
- Context is cached only for the open menu, refreshed on every open and again on an explicit conversion. No polling, hover conversion work or additional scrub-time measurement was introduced.

Known limitations: Design preserves known inline/session tokens; values whose winning stylesheet source is unresolved still use the computed fallback. Code retains its existing source representation. No source-winner inference or full expression engine was added. Six-decimal relative-unit precision preserves practical visual size, not infinite mathematical precision. Units outside the supported property menus are not offered for conversion.

## Files changed

- `src/editing/values.ts` — shared value model and conversion rules.
- `src/editing/conversionContext.ts` — selected-target context and computed-reference reads.
- `src/editing/properties.ts` — inline expression and unitless-zero preservation.
- `src/editing/session.ts` — authored metadata and guarded, read-only conversion-context access.
- `src/editing/rich.ts` — shadow numeric parsing uses the shared model.
- `src/ui/shared/NumericScrubber.tsx` — property-aware picker, conversion and current-unit stepping.
- `src/ui/shared/propertyControls.module.css` — compact unit trigger/chevron.
- `src/ui/ui.module.css` — unit selectors fit existing geometry and spacing controls.
- `src/ui/design/EditControls.tsx` — common Design fields and opacity integration.
- `src/ui/design/RichEffects.tsx` — box/text shadow length integration only.
- `src/ui/design/RichBackground.tsx` — angle and stop-value integration only.
- `tests/values.test.ts` — 54 focused shared-model cases.
- `tests/editing.test.ts` — updated zero/expression preservation expectations.
- `tests/e2e/units.spec.ts` — two built-Chrome unit/safety flows and six captures.
- `tests/e2e/editing.spec.ts` — assertions reflect separate spacing values and unit labels.
- This report and the six captures below.

## Exact verification

- `pnpm typecheck`: passed.
- `pnpm test`: **91/91 passed**, eight files, including 54 parsing/preservation/conversion/safety/stepping cases in `tests/values.test.ts`.
- `pnpm build`: passed; built extension approximately **1.05MB**. No permission or dependency changes.
- `git diff --check`: passed.
- Focused browser command (no prior-phase screenshot capture environment enabled):

```text
pnpm test:e2e tests/e2e/units.spec.ts tests/e2e/editing.spec.ts tests/e2e/rich.spec.ts tests/e2e/picker-performance.spec.ts --grep "Phase 06.5.4|unit safety|real Design values|geometry, display|selection isolation|open-shadow editing|background layers, gradients|shadow presets and|burst of filter|raw hover bursts"
```

**10/10 passed** on the final build:

1. Real Design values and reversible spacing, typography, background and border edits.
2. Geometry, display, opacity, positioning and prior-override undo.
3. Selection isolation, explicit units, author styles, stale DOM and teardown.
4. Open-shadow editing, inline-important protection and real 200% zoom.
5. Raw hover bursts: no computed inspection/UI publication; teardown stops work.
6. Filter input bursts: at most one selected-style refresh per frame.
7. Background layers, gradients, URLs and companion lists: real atomic edits.
8. Shadow presets/multiple shadows: shared undo and target isolation.
9. Phase 06.5.4 real unit conversions, keyboard and pointer scrubbing, Undo/Reset, Code units, target switching, expression preservation, six captures, 320px/390px controls and 200% zoom.
10. Conversion safety: ambiguous percentages, non-square radius, raw manual %, calc/auto, changed host reference widths, multi-column rejection and min-width mismatch rejection.

Actual conversion cases include width px→% and px→vw, font-size px→rem, spacing px→em/rem, radius px→%, box/text shadow px→rem/em, gradient deg→turn and line-height unitless↔px. Initial test-only assertions were corrected for Chrome's omission of default gradient angles and CSSOM calc-term ordering. No application runtime errors in tested flows.

## Captures

1. [Width unit picker](screenshots/phase-06.5.4/01-width-unit-picker.png)
2. [Font size in rem](screenshots/phase-06.5.4/02-font-size-rem.png)
3. [Spacing with non-px units](screenshots/phase-06.5.4/03-spacing-non-px.png)
4. [Shadow in rem](screenshots/phase-06.5.4/04-shadow-rem.png)
5. [Gradient angle in turns](screenshots/phase-06.5.4/05-gradient-turn.png)
6. [Narrow viewport](screenshots/phase-06.5.4/06-narrow-viewport.png)

Only these six views were captured and visually inspected. No new UI design phase was started.
