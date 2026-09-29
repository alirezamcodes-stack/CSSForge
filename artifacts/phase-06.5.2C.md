# Phase 06.5.2C — Box Shadow and Text Shadow polish

**PHASE 06.5.2C COMPLETE.** Stopped before 06.5.2D.

## Visual changes

Both shadow editors now show compact Add/None actions, an intentional empty state, layer/visible counts, clear selected rows and explicit visible/hidden labels. Move, visibility and delete actions retain consistent 30px-wide hit targets. The selected editor identifies the shadow being edited and keeps its values together: X/Y and Blur/Spread for box shadows, X/Y and Blur for text shadows, followed by Color and the existing box Inset control.

Preset browsers use muted neutral preview surfaces instead of large white group backgrounds. All box presets use the same sample rectangle with their real CSS shadow; all text presets use the same Aa sample with their real text shadow. Names, categories, selected state, hover/focus treatment and tooltips support comparison. The collections remain exactly **15 box-shadow presets** and **8 text-shadow presets**, with their definitions unchanged.

## Files changed

- `src/ui/design/RichEffects.tsx` — RichShadow presentation only; existing editing callbacks retained. RichFilters/FilterSlider code is unchanged.
- `src/ui/design/shadows.module.css` — shadow-only layout, layer and preview styling.
- `tests/e2e/shadow-polish.spec.ts` — focused Chrome verification and six captures.
- This report and the screenshots below.

No changes to Typography, Background/Gradient, shared ColorControl/NumericScrubber behavior, Filters, Code, Navigator, dock, units, preset definitions, serialization or editing/session architecture. Prior screenshot evidence remains unchanged.

## Verification

- `pnpm typecheck`: passed.
- `pnpm test`: **37/37 passed**, seven files.
- `pnpm build`: passed.
- Focused actual built-Chrome tests: **2/2 passed** (existing shadow regression and the new shadow presentation flow).
- Verified box/text preset application, preset counts and selected states, multi-shadow selection, visibility/reorder/remove, numeric/color/inset editing, Undo/Reset, target isolation, empty state, 320px/390px layouts, non-overlapping action controls, color-popover bounds and actual 200% tab zoom. No runtime errors in tested flows.
- All six requested captures were visually inspected. No full visual regression review was performed.

## Screenshots

1. [Box Shadow presets open](screenshots/phase-06.5.2C/01-box-shadow-presets.png)
2. [Box Shadow with two layers](screenshots/phase-06.5.2C/02-box-shadow-two-layers.png)
3. [Selected Box Shadow editor](screenshots/phase-06.5.2C/03-selected-box-shadow.png)
4. [Text Shadow presets open](screenshots/phase-06.5.2C/04-text-shadow-presets.png)
5. [Text Shadow selected editor](screenshots/phase-06.5.2C/05-selected-text-shadow.png)
6. [Narrow viewport](screenshots/phase-06.5.2C/06-narrow-viewport.png)

Remaining shadow UI issues: no blocking issues found in the tested states. Large shadow blurs are bounded by their thumbnail preview areas; actual page rendering uses the complete unchanged preset CSS. Lower box-preset categories remain accessible through the compact browser's vertical scrolling.
