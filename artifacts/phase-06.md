# Phase 06 — complete

Real Code and HTML/Navigator are connected to the selected page element. Phase 07 has not started.

Code separates CSSOM-authored inline declarations, readable matching rules and session overrides. CodeMirror value edits, local property/value validation, opaque RGB/hex swatches and owned declaration toggles reuse the existing transaction controller. Undo/reset and deactivation preserve original author sources. Unsupported author toggles remain unavailable.

HTML/Navigator provides bounded, lazy branches around selection, expansion/collapse, real tree selection, parent/child/sibling navigation, selected-row visibility, Back to canvas and Pick element. Open shadow boundaries are marked; owned UI is excluded.

## Verification

- Typecheck: passed.
- Unit tests: **33 passed**, six files.
- Browser regression suite: **31 passed** (15 actual built-Chrome extension tests and 16 fixture/performance tests).
- Final presentation verification after selected-row scrolling/error deduplication: **4 of 4 Phase 06 built-extension tests passed** again. These are included in the 31 unique browser tests above.
- Production MV3 build: passed; `activeTab` and `scripting` remain the only permissions.
- Narrow 390px viewport and actual 200% Chrome tab zoom: passed.
- Picker regression: 2,000 hover events, zero computed-style reads or UI publications, one geometry read; teardown passed.
- Seven Phase 06 screenshots inspected. Historical evidence was not recaptured.
- No blocking defects observed in tested flows.

## Screenshots

1. [Real Code](screenshots/phase-06/01-real-code.png)
2. [Media and pseudo context](screenshots/phase-06/02-media-pseudo-code.png)
3. [Real inline edit](screenshots/phase-06/03-real-inline-edit.png)
4. [Invalid CSS error](screenshots/phase-06/04-invalid-css.png)
5. [Real HTML/Navigator](screenshots/phase-06/05-real-html-navigator.png)
6. [DOM navigation selection](screenshots/phase-06/06-dom-navigation-selection.png)
7. [Narrow viewport](screenshots/phase-06/07-narrow-viewport.png)

## Intentional limits

CSSOM is browser-normalized authored data, not original source-file text or computed winner provenance. Inaccessible cross-origin stylesheets are reported, without inventing declarations. Imports, nesting, layers/container/scope rules, inherited relevance, complex pseudo contexts and full cascade resolution remain outside this bounded reader. Large sources/branches are capped and disclosed. Keyframes and unsupported properties remain read-only. External CSS/DOM changes require Refresh sources/tree or reselection; no mutation observer or polling was added. Closed shadows and frame contents remain unavailable. Full Changes/history/export remains deferred.
