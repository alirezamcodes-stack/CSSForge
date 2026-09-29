# Phase 06.5.2B — Background and Gradient polish

**PHASE 06.5.2B COMPLETE.** Stopped before 06.5.2C.

## Visual changes

Background rows now show larger previews, separate layer/type labels, hidden-state feedback, aligned 30px action targets and a restrained selected highlight. The selected editor identifies its layer and groups position/size/repeat controls below the gradient tools.

The gradient track has inset edge handles, visible stop numbers, selected outlines and matching row highlights. Selecting or focusing a row selects its handle. Explicit percentage stops support local pointer dragging and arrow adjustment through existing serialization/session transactions; pointer updates are coalesced per animation frame, Undo groups a drag, and Escape cancels the active drag. Numeric row entry remains available. No canvas handles or unit-system expansion was added.

Stop rows remain compact and reuse ColorControl unchanged. Secondary distribute/reverse commands use existing Lucide icons. The unchanged 28 presets have named gradient thumbnails, categories, selected/hover/focus treatment and a bounded scrolling browser.

## Files changed

- `src/ui/design/RichBackground.tsx` — Background presentation and local stop-selection wiring.
- `src/ui/design/GradientTrack.tsx` — track presentation and transient handle interaction.
- `src/ui/design/background.module.css` — Background-only styles.
- `tests/e2e/background-polish.spec.ts` — focused verification and five captures.
- This report and the screenshots below.

Typography, ColorControl implementation, shadow/filter editors, Code, Navigator, dock, presets, parser/serializer, unit handling and editing/session architecture were not modified. Prior screenshot evidence remains unchanged.

## Verification

- Typecheck: passed.
- Unit tests: **37/37 passed**, seven files.
- Production build: passed.
- Focused actual built-Chrome tests: **2/2 passed** (new Background polish flow and existing Background/layer/URL regression).
- Verified layer selection/reorder/visibility/removal, companion size preservation, linear/radial editing, stop color/position editing, drag/Undo/Escape, keyboard adjustment, reverse/distribute, preset application/selection, 320px and 390px layouts, layer action spacing and actual 200% Chrome tab zoom. No runtime errors in tested flows.
- Five requested views inspected against the current Background presentation. No full visual regression review or historical recapture.

## Screenshots

1. [Background layers](screenshots/phase-06.5.2B/01-background-layers.png)
2. [Gradient with two stops](screenshots/phase-06.5.2B/02-gradient-two-stops.png)
3. [Gradient with three stops](screenshots/phase-06.5.2B/03-gradient-three-stops.png)
4. [Background presets](screenshots/phase-06.5.2B/04-background-presets.png)
5. [Narrow viewport](screenshots/phase-06.5.2B/05-narrow-viewport.png)

Remaining limits: track dragging is limited to explicit percentage stops. Implicit and non-percentage stops remain editable in their rows; their track markers use the existing evenly spaced fallback rather than claiming exact unit conversion. Long editors retain the inspector's vertical scrolling. No blocking issues were found in the tested Background/Gradient flows.
