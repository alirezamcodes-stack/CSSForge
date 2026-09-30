# Engine 07.1.5 — Selection / Targeting Hardening

Date: 2026-09-30 (Europe/Berlin). Production fixes based on the locked [selection audit](selection-audit.md). Engine 07.2 has not started. UI composition, author declarations, Cascade 07.1 semantics, and extension permissions are unchanged.

## B1–B7 disposition

| Finding | Status | Regression evidence |
| --- | --- | --- |
| B1 copied-marker styling | Contained before paint; synchronous CSS-query interval is an explicitly deferred architecture limitation | A08, A13, A15; built clone/removal test |
| B2 stale position/transform highlight | Fixed for observed target/ancestor/neighbour changes | A03, A16; built position, transform and ancestor test |
| B3 removed zero-size selection | Fixed independently of size changes | A14; built zero-size removal test |
| B4 transformed HTML root | Fixed using a viewport-based top-layer overlay | A04 translate and scale; built root transform and existing actual 200% zoom cases |
| B5 root-move disagreement | Fixed; picker/Design/Code/source invalidate together; fresh explicit pick is allowed | A09; built Code/Design invalidation and repick test |
| B6 SVG rect sizing | Fixed conservatively for existing controls | A05; built rect width 80px/height 50px; svg/path/circle/use/text opacity preserved |
| B7 tiny highlight | Fixed: outline does not impose a border-box minimum | A06; built 1×1 geometry; zero/non-rendered geometry hidden |

## Target lifecycle

`targetLifecycle.ts` binds an Element object to its owning document, initial editing root and session token. A binding is unsafe when disconnected, re-rooted, re-documented, quarantined or outside an accessible supported root. Object identity remains authoritative; neither copied markers nor same ID/class replacements rebind an editing target.

Picker, editing and source association use the same policy. Design and Code consume the guarded editing snapshot and target ID. Lost targets remove unsafe session layers, clear cached association and selection, stop highlighting and reject old edit handles. Old transactions remain available for safe undo/reset, but retired targets cannot delete a later binding for the same Element. Explicit picking in a new open root creates a fresh session binding; there is no automatic migration.

Selection observers watch at most 64 ancestor nodes and 128 nearby layout siblings, without subtree traversal. Child-list signals catch removal regardless of size. Attributes, child/text changes and ResizeObserver signals schedule the existing frame gate. Same-root reparenting rebinds the bounded observer chain. All observers are disconnected on target loss/reset/deactivation. There is no polling or permanent animation-frame loop.

## Marker containment and the remaining synchronous interval

While session style layers are active, one marker-hygiene observer per editing root watches inserted nodes and only the session's marker attributes. It does not match replacements or scan the document. Processing is capped at 128 records, 256 added-subtree nodes and 128 active owners per root. Copied markers are stripped; ownership remains the actual Element. Oversized insertions or damaged original markers fail closed by quarantining layers and invalidating their bindings. Reset/deactivation also remove copied markers through explicit cleanup.

**Strict synchronous immunity is not achieved.** A08 retains the original same-task `cloneNode(true)` + `getComputedStyle(copy)` observation: the result can still be 31px before MutationObserver delivery. At the pre-paint frame boundary the clone is 18px, its copied marker is gone and the original remains 31px. Replacement clears selection/Code/Design and leaves zero active layers before repaint. This interval is observable to page JavaScript, even though the clone is never an authorized editing recipient and receives no persistent/painted session edit in the tested cases.

The current stylesheet selector cannot distinguish two DOM objects with identical copied attributes synchronously. Mutation observers cannot execute inside the intervening author JavaScript operation. A stronger guarantee requires a different styling/ownership mechanism; stable selectors or later mutation reconciliation alone do not prove it. Host API monkey-patching, rewriting author inline styles and generated replacement selectors were not introduced. This is the audit brief's permitted architecture deferral, not a claim that B1 has no remaining observable interval.

## Geometry and supported boundaries

The overlay's manual popover places it in Chrome's top layer, giving fixed descendants a viewport containing block under translated/scaled HTML. Host-page transforms remain intact. An outline preserves the target box dimensions; zero-width/height rectangles display no arbitrary highlight/label.

Size capability permits existing width/height controls for SVG `svg`, `rect`, `image` and `foreignObject`. Circle/path/use/text remain distinct targets with supported ordinary edits such as opacity; their geometry is not broadly enabled. HTML inline/replaced-element sizing remains conservative.

Candidate collection runs on explicit picks only. It combines the raw composed event path, point stacks recursively within accessible open roots, and ancestry, with deduplication (64 candidates, 12 point roots, depth 8). Raw target remains primary. Interactive ancestors and covered siblings are alternatives in internal metadata; there is no cycling UI or silent SVG promotion.

Slot child navigation uses assigned elements, falling back to slot children. Normal DOM child navigation remains bounded, including windows around selected children far down large lists. Iframes remain outer-element targets with an internal `iframe-interior-unsupported` boundary and existing tree feedback. No child-frame injection, coordinate transport or new permission was added.

## Changed files in this phase

Production:

- [picker/controller.ts](../src/picker/controller.ts)
- [picker/targetLifecycle.ts](../src/picker/targetLifecycle.ts)
- [picker/invalidation.ts](../src/picker/invalidation.ts)
- [picker/overlay.ts](../src/picker/overlay.ts)
- [picker/candidates.ts](../src/picker/candidates.ts)
- [picker/navigation.ts](../src/picker/navigation.ts)
- [picker/tree.ts](../src/picker/tree.ts)
- [editing/session.ts](../src/editing/session.ts)
- [editing/markerContainment.ts](../src/editing/markerContainment.ts)
- [editing/capabilities.ts](../src/editing/capabilities.ts)
- [engine/sources/index.ts](../src/engine/sources/index.ts)

Tests/report/evidence:

- [selection-audit.spec.ts](../tests/e2e/selection-audit.spec.ts): original repros retained; B1–B7 assertions converted; A15 budget/containment and A16 coalescing/reparenting added.
- [targeting-hardening.spec.ts](../tests/e2e/targeting-hardening.spec.ts): actual built Chrome regressions for all seven findings, including fresh picking after root invalidation.
- [extension.spec.ts](../tests/e2e/extension.spec.ts): obsolete 13px tab expectation corrected to the locked current 12px stylesheet. No UI style change.
- [targeting.test.ts](../tests/targeting.test.ts): five identity and conservative SVG/HTML capability checks.
- This report and `artifacts/diagnostics/selection-hardening/A01.json`–`A16.json`. Original audit evidence and fixture remain unchanged.

## Verification

Commands:

```text
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e tests/e2e/selection-audit.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/extension.spec.ts tests/e2e/editing.spec.ts tests/e2e/code-html.spec.ts
pnpm test:e2e tests/e2e/selection-audit.spec.ts --grep A08 --repeat-each 5
```

Typecheck passed. Unit suite: 164 tests in 12 files passed. Chrome MV3 build passed, total 1.07 MB (985.85 kB content script); `activeTab`/`scripting`, no host permissions. Final focused browser suite: **30 passed (44.5s)** against the final build. Marker frame-boundary containment also passed five consecutive runs.

Performance: A12 measures 1,000 alternating raw pointer events with zero synchronous geometry reads, zero source scans and zero cascade resolutions; one target rect read in the coalesced frame (plus the existing overlay-label measurement). A16 measures 1,000 position mutations with one target rect read, no additional source scans or cascade resolutions. Teardown removes markers/layers/overlay and prevents subsequent picker work. Existing pointer-performance, Design/Code/media/pseudo/shadow/navigation and actual 200% zoom regressions remain covered.

Deferred: synchronous copied-attribute CSS-query immunity, stable replacement locators, mutation reconciliation, full iframe execution, closed Shadow DOM, candidate cycling UI, clipped-visible-region geometry and arbitrary CSSOM/continuous animation tracking outside the bounded invalidation signals.

**ENGINE 07.1.5 COMPLETE**, using the brief's explicit allowance for a demonstrated later-architecture requirement on B1's strict synchronous interval. This does not claim complete synchronous clone-style immunity. No Engine 07.2 work was started.
