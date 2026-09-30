# CSSForge selection / targeting diagnostic audit

Date: 2026-09-30 (Europe/Berlin). Engine 07.0/07.1 and production UI remain unchanged. This audit adds fixtures, diagnostic tests and captured JSON evidence only. No selector engine, target promotion, frame injection, mutation engine or permissions change was implemented.

## Concrete findings

Seven implementation defects were reproduced. The highest confirmed severity is **high**. Additional targeting limitations are listed separately so they are not confused with wrong-node edit routing.

| Issue | Reproduction | Root cause | Severity | Recommended phase |
| --- | --- | --- | --- | --- |
| B1: copied edit marker affects another node | Edit `#dynamic` to 31px; clone or replace it with `cloneNode(true)` | Attribute-based override survives copying; disconnected target's style layer remains | High | 07.1.5 containment; 07.3 reconciliation |
| B2: stale highlight after position/transform change | Move selected box 55px or translate it 70px without changing its size | Size observer does not invalidate position-only changes | High | 07.1.5 Targeting Hardening |
| B3: removed zero-size target remains selected | Select zero-size child, let initial observer settle, remove it | No size change means no removal-driven paint | High | 07.1.5 Targeting Hardening |
| B4: document-root transform offsets overlay | `html { transform: translate(30px,20px) }` | Fixed overlay inherits a transformed containing block; viewport offset applied twice | Medium | 07.1.5 Targeting Hardening |
| B5: selection/editor disagree after root move | Move selected node into open shadow root, Refresh sources | Picker accepts connected node; editor rejects original-root mismatch | Medium | 07.1.5 Targeting Hardening |
| B6: valid SVG rect width edit is rejected | Select `<rect width=40>` and set CSS width to 80px | HTML inline-size heuristic disables SVG geometry properties | Medium | 07.1.5 Targeting Hardening |
| B7: tiny highlight is oversized | Select 1×1px element | Outline's border imposes a 2×2px minimum border box in tested Chrome | Low | 07.1.5 Targeting Hardening |
| L1: deepest node is often a poor editable target | Click a button's SVG icon | First Element in composed event path is selected without normalization | Medium | 07.1.5 candidate/normalization policy |
| L2: transparent overlay hides useful alternative | Click transparent overlay above a button | Event ancestry excludes covered siblings; no point-stack discovery | Medium | 07.1.5 candidate discovery; alternate-target UI later |
| L3: assigned slot content absent from child navigation | Host → shadow wrapper → slot → Child | Traversal reads DOM children, not `assignedElements()` | Medium | 07.1.5 Shadow DOM navigation policy |
| L4: iframe interiors cannot be picked | Click a button inside same-origin or cross-origin iframe | Top-frame injection/listeners only; no frame-scoped target protocol | High | Later hardening; boundary feedback in 07.1.5 |
| L5: unmarked replacements cannot be re-resolved | Replace node with new node having same ID/class | DOM object identity is the only target locator | Medium | 07.2 locator design, then 07.3 reconciliation |
| L6: highlight includes clipped portions | Pick 160×100px child clipped to 80×60px | Full bounding rectangle, with no ancestor clip intersection | Medium | Later geometry hardening |
| L7: invisible children remain navigable | Navigate to zero-size or `display:none` sibling | Validity checks `[hidden]`, not renderability | Low | 07.1.5 renderability state; visibility policy later |

### B1 — copied markers leak session CSS to another element

**Category:** stale target / rerender / cascade-editing. **Severity:** high. **Repro:** A08; actual built-extension confirmation in A13.

1. Select `#dynamic`; apply `font-size:31px` through the existing editor. A generated `data-cssforge-target-*="1"` marker and matching important CSS are installed.
2. Append `old.cloneNode(true)` with another ID. Both the selected original and the unselected clone compute to 31px.
3. Replace the original with a clone. The old DOM object disconnects. In the fixture, selection and Design clear by the 150ms observation, and Code unmounts in the built extension. The style layer remains; the replacement still computes to 31px.
4. Applying another edit using the old target ID returns false with “The editing target or context changed. Pick it again.” Reset/deactivate removes the copied marker and layer and restores 18px.

**Root cause/modules:** [session.ts:63](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/editing/session.ts:63>) releases layers only during explicit lifecycle operations; [session.ts:68](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/editing/session.ts:68>) renders a selector matching any copy of the marker; copy cleanup runs during render/release, not when the page clones a node. [controller.ts:71](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/controller.ts:71>) clears disconnected selection without releasing its override source.

**Recommended fix:** 07.1.5 should quarantine/remove unsafe targets' session layers and synchronize the lost-target state. Preserve the actual DOM-object ownership check; do not treat copied markers as replacement identity. 07.3 should add scoped mutation reconciliation and marker-copy hygiene. This is accidental CSS recipient expansion, not evidence that Design/Code directly wrote a new declaration to the wrong DOM object.

**Evidence:** [A08.json](<C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/selection-audit/A08.json>), [A13.json](<C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/selection-audit/A13.json>).

### B2 — position-only geometry is not invalidated

**Category:** overlay geometry. **Severity:** high. **Repro:** A03.

After initial ResizeObserver delivery settles, change selected `#absolute` from `left:40px` to `left:95px`. The outline remains 55px behind. Change selected `#transformed` to `translateX(70px) rotate(10deg)`: the outline remains about 70px behind. Both recover on `picker.refresh()`.

**Root cause/modules:** [controller.ts:89](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/controller.ts:89>) observes only target size. [controller.ts:121](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/controller.ts:121>) schedules geometry on scroll/resize/explicit refresh; position/transform mutations have no trigger. [controller.ts:71](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/controller.ts:71>) computes a correct rectangle when scheduled.

**Recommended fix:** 07.1.5 should add bounded invalidation for selected-target/ancestor changes, and define how active CSS motion keeps a visible overlay current. Coalesce geometry through the existing frame gate. Avoid stylesheet/source/cascade work on pointermove and avoid permanent document-wide polling.

**Evidence:** [A03.json](<C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/selection-audit/A03.json>). The diagnostic explicitly waits for initial observer delivery; otherwise a queued initial paint can mask the bug.

### B3 — removal can leave a zero-size target stale

**Category:** stale target. **Severity:** high. **Repro:** A14.

Select `#zero` via parent/child navigation. After the initial observer notification, remove it. At the 200ms observation the picker still reports `div#zero` and Design still retains its target ID, despite `isConnected === false`. Source access returns null; an attempted edit rejects the target. An explicit refresh clears selection.

**Root cause/modules:** [controller.ts:38](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/controller.ts:38>) has an appropriate connection guard, but [controller.ts:71](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/controller.ts:71>) evaluates it only when paint runs. Size observation is not a complete DOM-lifecycle signal. Zero size before and after removal can produce no new ResizeObserver notification.

**Recommended fix:** 07.1.5 needs targeted connection/root invalidation independent of size changes, plus a shared target-gone state for picker/editor/Code. 07.3 can later own broader mutation reconciliation. Do not auto-select a replacement yet.

**Evidence:** [A14.json](<C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/selection-audit/A14.json>). Ordinary rendered-node removal/replacement did clear selection in A08/A09/A13; this is a distinct zero-size failure.

### B4 — transformed document root changes the overlay's coordinate space

**Category:** overlay geometry. **Severity:** medium. **Repro:** A04.

Apply `transform:translate(30px,20px)` to `document.documentElement`; select `#absolute`. The outline's actual rectangle is offset exactly +30px/+20px from the selected rectangle. Clearing that transform and refreshing restores alignment.

**Root cause/modules:** [overlay.ts:8](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/overlay.ts:8>) and [overlay.ts:17](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/overlay.ts:17>) place a fixed host below the transformed HTML root. [overlay.ts:27](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/overlay.ts:27>) assigns viewport `getBoundingClientRect()` coordinates as local fixed coordinates. Shadow DOM does not isolate containing-block geometry.

**Recommended fix:** 07.1.5 should establish a viewport-space overlay or convert coordinates to the real containing block, with regression cases for root transform/scale. Do not remove host-page transforms to compensate.

**Evidence:** [A04.json](<C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/selection-audit/A04.json>).

### B5 — connected root moves leave picker and editing validity inconsistent

**Category:** Shadow DOM / stale target / edit association. **Severity:** medium. **Repro:** A09.

Select `#absolute` in the document, move that same node into `#open-host.shadowRoot`, then invoke the production Refresh sources path. Design becomes null and reports that the element moved to another document tree. The picker keeps `div#absolute`, and repaint updates its rectangle in the new root. The UI can therefore still identify/highlight a selected target that editing refuses.

**Root cause/modules:** [controller.ts:38](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/controller.ts:38>) checks connection/ownership but stores no selection root. [session.ts:34](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/editing/session.ts:34>) requires the original document/root. [sources/index.ts:83](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/engine/sources/index.ts:83>) associates sources with the actual Element and reads its current root on refresh. These components disagree on whether a root move is a valid continuing target.

**Recommended fix:** 07.1.5 should share target validity (Element, document, root, session identity) and clear/quarantine on unsupported root changes. Deliberate session migration belongs in 07.3 if later authorized. Preserve the current guard against writing into the wrong scope.

**Evidence:** [A09.json](<C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/selection-audit/A09.json>).

### B6 — SVG rect sizing is blocked by an HTML size heuristic

**Category:** SVG / cascade-editing capability, not hit testing. **Severity:** medium. **Repro:** A05.

The `<rect>` is selected and highlighted correctly. Applying `width:80px` through Design's existing edit session returns false (“This display mode does not provide an editable size box.”). Setting that CSS property directly in the diagnostic fixture changes native `getBBox().width` from 40 to 80.

**Root cause/modules:** [session.ts:60](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/editing/session.ts:60>) treats inline SVG internals like non-replaced inline HTML; only outer `svg` is in the replaced-element list. [session.ts:97](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/editing/session.ts:97>) rejects width/height from that flag.

**Recommended fix:** 07.1.5 should use conservative element/property capabilities for existing SVG controls (for example rect width/height), rather than promoting every SVG internal to its host. Broader SVG geometry editors remain later hardening. The existing opacity edits work on svg/path/rect/circle/use/text.

**Evidence:** [A05.json](<C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/selection-audit/A05.json>).

### B7 — borders enlarge very small highlights

**Category:** overlay geometry. **Severity:** low. **Repro:** A06.

The selected `#tiny` DOM rectangle is exactly 1×1px, and its position is correct. The overlay's actual rectangle is 2×2px in tested Chrome. This is a drawing-box mismatch, not a bad selected DOM rectangle.

**Root cause/modules:** [overlay.ts:11](<C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/overlay.ts:11>) uses a border on a border-box with assigned target dimensions. Border thickness imposes a minimum box extent below the intended size.

**Recommended fix:** 07.1.5 can draw using an outline/outer shadow or another treatment that preserves the assigned box. Handle non-rendered/zero-size targets explicitly instead of drawing an unexplained tiny box at (0,0).

**Evidence:** [A06.json](<C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/selection-audit/A06.json>).

## Target quality and available element stacks

A01 clicks the visible icon in `button > span > svg > path`. Current selection is `path#nested-path`. The browser's composed event path and point stack both contain `path → svg → span → button → main → body → html`. Manual Parent navigation reaches svg, span, then button correctly. A future normalization layer should offer useful interactive ancestors while preserving explicit SVG selection; aggressive automatic promotion would hide legitimate SVG editing.

For a transparent overlay, the event path is `transparent → overlap → main → body → html`. `document.elementsFromPoint()` additionally exposes the underlying button. This is where candidate-stack discovery helps: covered siblings are absent from event ancestry. The `pointer-events:none` overlay is correctly skipped by normal browser hit testing, and the underlying button is selected. Invisible/non-hit-testable elements will not all appear in a point stack; DOM ancestry/navigation remains necessary.

For nested open shadow roots, A07 confirms:

- Document point stack stops at the outer host.
- Outer ShadowRoot point stack exposes the inner host.
- Inner ShadowRoot point stack exposes the real button.
- The real composed pointer event already exposes that deep button to the current picker.

Thus current event-based hit testing does **not** stop at accessible open hosts. Future point-based alternate discovery must recurse through accessible roots and combine/deduplicate point stacks with ancestry. Closed roots retarget to the host and remain unavailable. `<use>` targets the exposed SVG use instance, not private rendered instance descendants. Pseudo-elements target their originating Element; explicit before/after context editing works, but the highlight is the originating element's rectangle.

Recommended later UI: candidate cycling/alternate-target choice. Backend discovery/normalization policy fits 07.1.5; no cycling UI was built here.

## Frame architecture

A10 uses the actual built extension. `same-frame.contentDocument` is readable; `cross-frame.contentDocument` is not. Neither has CSSForge UI/overlay/content-script behavior. Clicking either interior button leaves top-document selection unchanged. Clicking each iframe border selects/highlights the **outer iframe** correctly.

[background.ts:14](<C:/Users/alire/Documents/ChatGPT/CSSForge/entrypoints/background.ts:14>) injects with `{tabId}` only. [content.tsx:7](<C:/Users/alire/Documents/ChatGPT/CSSForge/entrypoints/content.tsx:7>) registers at runtime; the built manifest has no automatic content-script registration or added host permissions. Pointer events from child documents do not bubble through the parent window. Current DOM handles/editor guards are document-scoped; they cannot represent a child-frame target. There is therefore no child-frame coordinate translation to validate.

Architectural requirement: eligible frame-local controllers and source/editing sessions, a frame+document+root+target identity protocol, navigation/teardown synchronization, and overlay coordinate ownership. A top overlay would need border/scroll/zoom/transform-aware frame-to-parent geometry; alternatively overlays stay frame-local. Cross-origin content requires an explicitly reviewed eligibility/permission strategy, not parent DOM access. Keep iframe boundary feedback in 07.1.5; full frame support is later hardening. No broad permissions were requested or added.

## Edit failure classification

| Case | Observed outcome |
| --- | --- |
| A: wrong useful target | Nested icon picks path; transparent overlay picks overlay. Correct raw hit, potentially wrong user intent. |
| B: correct target, wrong highlight | B2/B4/B7 confirmed. Clipped boxes additionally use full bounding rectangles rather than visible intersections. |
| C: correct selection, edit affects another node | No direct Design/Code reassignment was found. B1 copied markers expand CSS recipients to clones. |
| D: correct edit, cascade blocks visible result | A11 installs 31px on the selected node, but `#absolute {font-size:24px!important}` wins over the attribute-selector important override. Engine 07.1 reports the author winner and specificity loss. Picker/marker routing is correct. |
| E: edit followed by rerender | Cloned replacement inherits session CSS via B1; unmarked fresh replacement does not. Built Code edits the original and unmounts after target loss. |
| F: disconnected selected element | Rendered removals clear selection in the fixtures. B3 zero-size removal can retain stale selection until refresh. Unsafe edits are rejected in both cases. |

Existing target association uses DOM references/WeakMaps and session target IDs. `identityOf()` is a display label, explicitly **not** a selector. Tree IDs point to stored Elements and reject disconnected handles. The generated edit-marker selector is used only to apply CSS and remove marker copies; it is not a re-resolution locator. Source and cascade caches use the selected Element object. Code is keyed by Design's target ID and passes that same ID/context to `applyBatch`; Design uses the same session. No replacement-selection selector exists.

A future stable locator needs document/frame identity, an open-root path, generation/connection state and enough validated distinguishing evidence to reject ambiguous replacements. That belongs to 07.2, followed by bounded mutation reconciliation in 07.3. Matching only an ID, display label or copied marker would reproduce the ambiguity demonstrated here.

## Coverage and measurements

| Requested category | Focused check and result |
| --- | --- |
| Nested button/span/svg/path | A01: deepest path selected; ancestry and point stack available |
| Overlap / transparent overlay | A01: top overlay selected; underlying button available only in point stack |
| pointer-events:none | A01: overlay skipped; underlying button selected |
| Absolute / fixed / sticky | A02: selection and viewport geometry correct across tested scroll/resize |
| Transforms | A02 initial transformed target correct; A03 transform-only updates stale; A04 transformed HTML root offsets overlay |
| Nested scroll containers | A02: inner and outer scroll update the highlight correctly |
| Clipped / overflow:hidden | A04: full 160×100 rectangle drawn for child visible through 80×60 clip |
| Very small elements | A06: 1×1 target selected; actual overlay becomes 2×2 |
| Zero-size elements | A06: reachable through navigation; A14 removal can remain stale |
| SVG svg/path/rect/circle/use/text | A05: all selected/highlighted and opacity edited correctly; rect width incorrectly refused |
| Open Shadow DOM | A07: real target, styles and edit recipient correct |
| Nested open Shadow DOM / hosts | A07: deep target and parent navigation correct; per-root point stacks verified |
| Slotted content | A07: click/edit succeeds in light-DOM scope; slot child navigation does not enumerate assigned elements |
| Closed Shadow DOM | A07: host only, no claim of inner access |
| Same-origin iframe | A10: readable DOM from test, but no frame content script / interior picking |
| Cross-origin iframe | A10: DOM boundary inaccessible; no interior picking |
| Dynamic replacement / framework rerender | A08/A09/A13: clone leak versus safe unmarked loss distinguished |
| Removal after selection | A09 rendered removal clears; A14 zero-size removal remains stale |
| Page layout changes | A02 resize/scroll correct; A03 position-only invalidation absent |
| before/after pseudo-elements | A06: owner Element selected; explicit before editing applies correctly |
| Zoom | A13: actual Chrome 200% tab zoom aligns target and outline exactly in captured CSS coordinates |
| Cleanup | A08/A12/A13: reset/deactivate removes copied markers, layers and overlays; queued work stops |

A12 records **1,000 alternating raw pointer events**: zero geometry reads during the synchronous burst, one selected hover-target geometry read plus one overlay-label measurement after the frame, zero source-index scans and zero cascade resolutions. After destroy, another 1,000 events plus resize/removal cause no further picker geometry reads. The existing picker-performance regression also passes. This is a controlled browser fixture measurement, not a latency benchmark for arbitrary live sites.

## Recommended 07.1.5 scope

1. Share target validity/lifecycle across picker, editor, source association and Code; detect disconnect/root changes independently of target size.
2. Quarantine unsafe session CSS so copied markers cannot silently retain styling after target loss; reserve broader mutation reconciliation for 07.3.
3. Add bounded position/transform/ancestor invalidation and correct overlay containing-block geometry, preserving frame coalescing and zero source/cascade work on raw moves.
4. Fix tiny/non-rendered highlight presentation and use conservative SVG capabilities for existing width/height edits.
5. Define target normalization and accessible candidate-stack collection without automatic broad promotion or a new cycling UI.
6. Define slotted navigation behavior and explicit frame boundaries; keep full frame execution/permissions and stable replacement locators outside this hardening pass.

No production fixes were applied during the audit. Engines 07.0/07.1 stay locked. Engine 07.2 was not started.

## Changed files and verification

Added [selection-audit.spec.ts](<C:/Users/alire/Documents/ChatGPT/CSSForge/tests/e2e/selection-audit.spec.ts>), [selection-audit.html](<C:/Users/alire/Documents/ChatGPT/CSSForge/tests/e2e/fixtures/selection-audit.html>), this report, and A01–A14 JSON evidence in `artifacts/diagnostics/selection-audit`. Existing production source and existing regression tests were not modified.

- `pnpm typecheck`: passed.
- `pnpm test`: 159 tests passed, 11 files.
- `pnpm build`: Chrome MV3 build passed, 1.07 MB; permissions remain activeTab/scripting.
- `pnpm test:e2e tests/e2e/selection-audit.spec.ts tests/e2e/picker-performance.spec.ts`: 14 audit tests plus the existing performance regression. Assertions intentionally describe current failure behavior; passing diagnostic tests do not mean the defects are fixed.

**SELECTION AUDIT COMPLETE.**
