# Current UI — end-to-end functional audit

Audit date: 2026-10-01. Workspace: `C:/Users/alire/Documents/ChatGPT/CSSForge/`. Scope: the current production Chrome MV3 extension, with the engine foundation through 07.4C locked.

## 1. Executive summary

The current UI is not yet production-ready. Ordinary editing, context isolation, real session Undo/Reset, edited-target migration, source refresh, layer operations and enabled unit conversions largely work. Shared interaction, validation and stacking defects affect many otherwise functional controls.

**24 explicitly listed UI/control groups audited; 3 groups have no observed feature/control defect in the supported scenarios (Filters, contexts, visible Undo/Reset).** The other 21 are partial or incomplete, including groups affected by shared controls. This is a strict group count, not a count of individual working buttons. Global hostile-page/selection layering failures also constrain the three working groups.

**15 deduplicated confirmed product defects (A–F): 0 Critical, 2 High, 11 Medium, 2 Low.** Additionally: **4 incomplete/unwired findings (J, Medium)** and **1 visual consistency finding (G, Low)**. All actionable findings together total **20: 0 Critical, 2 High, 15 Medium, 3 Low**. H/I observations are excluded from bug totals.

The release blockers are inspector viewport anchoring on transformed pages, host UI covering CSSForge, selection feedback painting above CSSForge, and pointer-blocked spacing unit menus. The main synchronization defect is missing selected assigned-slot content in HTML/Navigator. No stale current authored source was retained after a successfully migrated edited target and source refresh.

No new product feature, product fix, broad redesign or locked engine refactor was performed. The only existing-file change is a Vite preview watcher ignore for audit/test profile and artifact folders, preventing Windows locked-cookie watcher failures. Native Code color inputs were exercised through the page; the operating-system color dialog was not separately audited.

## 2. Current visible UI inventory

“Working” means the tested supported feature/control paths have no reported local/shared-control defect. “Partial” includes usable controls with a confirmed edge case, shared-control defect or an enabled placeholder. These groups deliberately overlap where a shared control is embedded in another surface; findings are counted only once.

| # | Group | Current controls/access points | Result | Coverage/exception |
|---|---|---|---|---|
| 1 | Picker / highlight | Activation/cancel, hover/click, geometry, target lifecycle, Parent/Child | Partial | UI03; correct target identity and rectangles |
| 2 | Inspector shell | Open/close, menu, header drag, keyboard move, clamp, sections, scroll/resize | Partial | UI01/UI02 |
| 3 | Dimensions | Read-only X/Y; Width/Height; geometry radius; Computed label | Partial | DA03 shared validation; no min/max/aspect controls |
| 4 | Spacing | Four margin + four padding fields and unit menus | Partial | DA01/DA03; no linked/unlinked control |
| 5 | Typography | Family/custom family, weight, size/line height, color, four alignments, letter spacing, decoration, transform | Partial | Shared color and numeric validation issues |
| 6 | Border / radius | Aggregate width/style/color/radius; duplicate geometry radius stays synchronized | Partial | EFF-B-02/DA03; no side/corner selector |
| 7 | Display / opacity | Ten display options; opacity NumericScrubber | Partial | DA03; native button inline computation is correct |
| 8 | Positioning | Static/relative/absolute/fixed/sticky; four conditional offsets; z-index | Partial | DA02/DA03 |
| 9 | Shared ColorControl | Six contexts: text, background, border, box shadow, text shadow, gradient stops | Partial | EFF-A-01/02, EFF-B-02, EFF-F-01; G separately |
| 10 | Background | Color; select/add/remove/hide/show/reorder layers; linear/radial/URL types; position/size/repeat; 28 presets | Partial | Shared color issues; gradient editor counted below |
| 11 | Gradient | Direction/angle, shape/origin, stop color/position/select/add/remove/drag; distribute/reverse | Partial | EFF-B-01 and shared color validation |
| 12 | Box shadow | Add/select/remove/hide/show/reorder; X/Y/blur/spread/inset/color; presets | Partial | EFF-A-02 and shared color validation |
| 13 | Text shadow | Add/select/remove/hide/show/reorder; X/Y/blur/color; presets | Partial | Shared color validation; no box-shadow contamination |
| 14 | Filters | Eight numeric/range pairs; Reset filters | Working | Blur, brightness, contrast, grayscale, hue rotate, invert, saturation, sepia |
| 15 | Media / state / pseudo | Base/readable media conditions; current, hover, focus, active, before/after | Working | Scope, activation, Undo/Reset pass; no state forcing |
| 16 | Code | Sources/status, Refresh, value editor, Add session declaration, supported color swatches, override toggles, Undo/Reset | Partial | CA61/CA62 |
| 17 | HTML | DOM navigation, selected branch, Refresh, expansion and keyboard | Partial | CA63/CA64 |
| 18 | Navigator | Live tree/navigation, Close, Back to canvas, Pick element, modal focus | Partial | CA63/CA64 |
| 19 | Changes | Real edited-element count; Undo/Reset; Close/Escape/modal focus | Incomplete | J04; detailed review is absent |
| 20 | Bottom dock | Ten buttons including three placeholder tools; Measurement and More menus | Partial | J01–03; functional dock actions pass |
| 21 | Popovers / menus / tooltips | Opening/repeat close, outside press, Escape, focus return, arrows, collision/scroll | Partial | DA01/UI03; ordinary geometry and focus pass |
| 22 | NumericScrubber / units | 22 Design instances plus effect numerics; typing, arrows/modifiers, drag/cancel, conversions/raw grammar | Partial | DA02/DA03; enabled conversions preserve size |
| 23 | Visible Undo / Reset | Inspector menu, Code and Changes actions; Design/effects/context/target replacement | Working | Session truth verified; author-policy UI is absent |
| 24 | Keyboard / focus | Tabs, Shift+Tab, Enter/Escape, menu arrows, numeric editing, header movement, modal focus | Partial | CA61–63, DA02/03, EFF-F-01 |

The Design inventory contains **22 numeric field instances**, **7 select menus / 50 listed choices**, **4 alignment buttons**, and the shared color controls. Initial computed/authored/session values, valid/invalid drafts, supported units, repeated edits, Undo/Reset and target switching were exercised. Options generated from an element’s current author value are retained in addition to the fixed menu choices.

Currently absent controls are not unwired defects: min/max/aspect ratio, linked spacing, per-side border/corner UI, italic, overflow/flex/grid alignment, eyedropper inside ColorControl, filter opacity/drop-shadow editors and filter reorder/enable switches. The eight current filter controls are listed above; unsupported existing functions are preserved rather than invented as new controls.

### Bottom-dock inventory

| Button | Intended/current action | Observed result | Active/disabled/focus/repeat |
|---|---|---|---|
| Pick / Cancel picking | Toggle page picking | Works; Escape cancels and normal page clicks resume | aria-pressed follows state; focus/Enter/tooltips work |
| Open Changes | Open current session surface | Real count/actions, incomplete review (J04) | Modal Escape/close and opener return pass; base dock becomes inert while open |
| Open Navigator | Open live DOM navigation | Opens real tree; CA63/64 remain | Modal focus, Close/Back to canvas/Pick element work |
| Background tools | Background tool affordance | Placeholder only (J01) | Enabled; expanded/active state and repeat close work; no action inside |
| Measurement tools | Read selected dimensions | Correct live rectangle, or select-first message | Expanded/active state, focus/Enter, repeat close pass; no distance-guide action is exposed |
| Color tools | Color-tool affordance | Placeholder only (J02) | Same enabled placeholder behavior |
| Eyedropper information | Color sampling affordance | Placeholder only (J03) | Same enabled placeholder behavior |
| More tools | Review changes / Open Navigator | Both open the current real surfaces | Keyboard/menu arrows, repeat close, nested opener return pass |
| Hide / Show inspector | Toggle inspector visibility | Works from dock and header | aria-pressed/label follow visibility; keyboard activation pass |
| Deactivate CSSForge | Remove UI, selection feedback and active interaction | Works; actual extension action can reactivate | No permanent toggle state implied; tooltip/focus/Enter paths and cleanup checked |

## 3. Fully working controls and successful paths

- **Selection identity/geometry:** nested elements, transparent overlay, pointer-events:none overlay, absolute/fixed/sticky/transformed elements, clipped descendants, 1×1px targets, SVG, open/nested open shadow roots, slots and same/cross-origin iframe outer borders. Hover/selected feedback matches native bounding rectangles; transformed differences are below 0.01px. Zero-size nodes can be selected through Child and correctly produce no outline. SH08 supersedes an unreliable iframe corner-click observation in SH01.
- **Inspector ordinary operation:** header/dock open and hide, corner drag/clamp, keyboard movement/Home, Escape drag cancellation, section disclosures, scrolling, resize and popover focus return. Event isolation prevents inspector key events and picker gestures from triggering the host page; normal page interactions resume when not picking.
- **Dimensions/spacing/layout:** width/height/radius, eight spacing sides, all ten display choices, opacity, five position modes, conditional offsets and z-index normal edits, session Undo/Reset and highlight movement work. Negative margins/offsets/letter spacing work; invalid negative dimensions/padding reject safely. Native inline span sizing and unsupported SVG circle sizing are disabled. SVG root and rect edits/Undo/Reset pass.
- **Typography:** all current family/weight/alignment/decoration/transform options and custom family entry work. Parent, inherited-child and descendant-owned values were compared against matching untouched native CSS for all nine current properties. Size, unitless/length line height and letter spacing preserve valid raw keywords/expressions. Color exceptions are separate below.
- **Color ordinary paths:** manual HEX/RGB/HSL, alpha, saturation/hue/alpha pointer and keyboard interactions, recent colors, invalid rejection, reopen/format persistence and Undo/Reset work across the six embedded color contexts, subject to the specific token/validation/cancellation defects below.
- **Background/layers:** add/select/remove/hide/show/reorder, HTTP(S) URL validation, position/size and all six repeat values preserve synchronized CSS and companion lists. All 28 background presets apply with correct selection. Final-layer removal and Undo restore metadata.
- **Ordinary gradients:** linear/radial type changes, direction/angle and shape/origin, stop selection/color/position/add/remove, pointer drag, drag Escape, keyboard arrows, distribute/reverse and angle unit conversion work. Minimum-two-stop and ambiguous-percentage guards are safe.
- **Shadows/filters:** all visible layer actions, numeric components, inset, colors and current presets apply real CSS; box and text shadow state remain isolated through repeated edits and target switches. All eight filter numeric/range controls, combined order preservation, local/session reset and supported additions around preserved opaque functions work.
- **Contexts:** base, active/inactive readable/nested media conditions, hover/focus/active and existing before/after rules remain scoped. Native state/viewport activation, return to base, Undo/Reset and no context leakage pass.
- **Code/source:** authored/inline/source status remains distinct from overrides; supported declaration editing, Add session declaration, invalid declaration correction, repeated edits, override disable/enable, RGB Code swatch input, Refresh sources, session Undo/Reset and migrated current attribution work.
- **HTML/Navigator ordinary paths:** parent/child/previous/next navigation, select and locate, open/nested-shadow and SVG ancestry, expand/collapse, explicit DOM refresh, a bounded 600-sibling branch around lazy-550, removal cleanup, modal focus and footer actions work. Assigned-slot and tree-arrow exceptions are below.
- **Visible Undo/Reset:** Design, Code, effects, multiple properties, contexts and edited target replacement restore real browser values. Counts/disabled states update, repeated Reset is safe, and errors are not replaced by invented success.

## 4. Partially working controls

| Group | What works | Remaining restriction |
|---|---|---|
| Inspector/picker | Ordinary page interaction and geometry | UI01–03 hostile-page and feedback layering |
| Numeric/spacing/position | Valid edits, conversions, gestures, Undo/Reset | DA01 pointer-blocked menu, DA02 integer stepping, DA03 explanation gap |
| Colors | Concrete colors, formats, picker and Undo | Token alpha hue loss, promised Escape not implemented, mixed borders, inaccessible error association |
| Complex gradients | Valid CSS is preserved; angle/Undo/Reset work | Interpolation hint is presented as an invented color stop |
| Code | Editing and source/session truth | Draft Escape and focus restoration |
| HTML/Navigator | Most structure and selection | Assigned slots omitted; Left/Right hierarchy focus incomplete |
| Dock/Changes | Real opening, count and session actions | Three empty tools; detailed Changes review absent |

## 5. Confirmed functional bugs

The compact table includes A–G/J so functional failures, incomplete surfaces and polish remain distinguishable. P1 = current-UI release/accessibility blockers to address first; P2 = remaining functional/state/focus fixes; P3 = deferred polish.

| ID | Surface | Problem | Category | Severity | Fix priority |
|---|---|---|---|---|---|
| UI01 | Inspector shell on transformed pages | html/body transforms move the inspector header and upper controls off-screen | E | High | P1 |
| UI02 | Host-page stacking | A maximum-z-index host overlay covers and intercepts the current UI | E | High | P1 |
| UI03 | Selection highlight versus all CSSForge surfaces | Selection outline and identity label paint above inspector, dock and review/popover content | E | Medium | P1 |
| J01 | Background tools | Enabled Background tools dock action has no connected tool | J | Medium | P1 |
| J02 | Color tools | Enabled Color tools dock action has no connected tool | J | Medium | P1 |
| J03 | Eyedropper information | Enabled Eyedropper information dock action has no connected tool | J | Medium | P1 |
| J04 | Changes | Changes is a live session summary with incomplete review content | J | Medium | P2 |
| DA01 | Spacing unit menus | The padding box paints over and intercepts enabled Margin unit options | E | Medium | P1 |
| DA02 | Z-index keyboard stepping | Alt+ArrowDown generates an invalid fractional z-index | F | Low | P2 |
| DA03 | Locally rejected NumericScrubber input | Unsupported unit rejection has no associated explanation | F | Low | P2 |
| CA61 | Code value editor | Escape leaves a CodeMirror draft open | D | Medium | P2 |
| CA62 | Code Apply/Cancel | Applying or cancelling a Code value drops focus to the page body | D | Medium | P2 |
| CA63 | HTML/Navigator tree keyboard | Tree Left/Right keys omit child and parent navigation | F | Medium | P2 |
| CA64 | HTML/Navigator slotted selection | Selected assigned slot content disappears from both trees | C | Medium | P1 |
| EFF-A-01 | Shared closed color inputs | Escape retains a color edit despite the field tooltip promising gesture cancellation | A | Medium | P2 |
| EFF-A-02 | ColorControl alpha on a valid CSS token | Changing currentColor alpha silently changes its hue to black | A | Medium | P2 |
| EFF-B-01 | Complex gradient stop editor | A valid interpolation hint is displayed as a color stop with an invented position | B | Medium | P2 |
| EFF-B-02 | Border color for nonuniform four-side colors | Four valid side colors appear as a single unparseable color token with a black/default picker | B | Medium | P2 |
| EFF-F-01 | All six ColorControl format inputs | Invalid popup format input omits aria-invalid although CSS is rejected | F | Medium | P2 |
| EFF-G-01 | Color controls across Typography and Effects | The same color picker has inconsistent format tabs, swatch shape and input typography across sections | G | Low | P3 |

## 6. UI-engine synchronization bugs

**CA64** is the confirmed synchronization failure: engine/header/highlight correctly select the assigned light-DOM node, while both DOM trees lose the selected row and cannot recover it with Refresh. This is an ancestry/traversal disagreement, not lost editing ownership.

**EFF-B-01/02** are presentation mismatches rather than incorrect engine writes: a valid gradient hint and mixed border shorthand are shown through controls that assume a simpler value. The valid native CSS survives opening, and supported Undo/Reset works.

No confirmed stale-source attribution bug after successful edited-target migration was observed. Explicit source/tree snapshots require their visible Refresh controls after external CSS/DOM changes. Unedited replacement retires selection safely; it is recorded as a current limitation rather than a stale retained tree.

## 7. Interaction/focus/keyboard bugs

CA61/62 affect Code cancellation/focus; CA63 affects the shared tree’s hierarchy arrows; DA02 affects integer keyboard stepping; DA03 and EFF-F-01 affect validation explanations. The tree expectation follows the [W3C Tree View keyboard pattern](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): Right on an open node moves to a child, and Left on a leaf/closed child moves to its parent.

Tab/Shift+Tab traversal, task-tab arrows/Home/End, menu arrows, modal focus containment, opener restoration, picker Escape, numeric Escape, gradient-drag Escape and inspector-drag Escape were exercised. No generic permanent keyboard trap was found. This was focused functional/accessibility checking, not a full WCAG or screen-reader certification.

## 8. Layout/zoom problems

UI01–03 and DA01 are the confirmed layout/paint/pointer problems. They are distinct: host transforms move the UI; host stacking covers it; the browser-top-layer selection overlay paints above it; and the spacing diagram locally occludes unit menus.

Ordinary-page checks covered **1440×900**, **390×844**, **320×450**, **390×280**, short effect editors at **1440/320×480**, and actual Chrome tab zoom **125%, 150%, 200%**. At a 1440×900 browser viewport, the measured CSS viewports were 1152×720, 960×600 and 720×450. Inspector and dock bounds remained inside, without overlap or Design horizontal scroll. Menus/color popovers used vertical scrolling when necessary; Code/Navigator remained bounded and reachable.

The extreme 390×280 case leaves only **79px** of Design scroll area. This is a practical density limitation; it was not misclassified as an off-screen control defect. Intermediate and 200% coverage includes effects, Typography, spacing, border and positioning. Screenshot dimensions reflect Chrome zoom/device pixels; a capture-offset ambiguity was checked with native CDP captures and DOM bounds instead of being counted as a product bug.

Host global button/input resets and custom-font styles were isolated: host text was 48px cursive/red while a dock button remained 13px with no 14px red border. Extension activation preserved host document/main geometry. High-z-index/transform exceptions remain release blockers.

## 9. Visual consistency issues

**EFF-G-01 (Low/P3)** records different format-tab treatments, swatch shapes, field fonts/density and heading separators for the same ColorControl in Typography versus Effects. This is separately counted as polish. Section boundaries, ordinary density, icon system and existing selected states were preserved; no visual redesign was attempted.

The feedback overlay, mixed border and gradient hint issues are assigned to functional/layout/value categories rather than double-counted as visual polish.

## 10. Expected behavior incorrectly perceived as a bug

| Category | Observation | Classification/evidence |
|---|---|---|
| H | Container font changes do not overwrite explicit child properties | Correct native inheritance/ownership; matching untouched CSS comparisons pass |
| H | Native button display:inline computes inline-block | Extension matches the untouched native button; choices-055 is superseded by unit-option-matrix-002 |
| H | .75 → 0.75, radial defaults/positions, double-position stop expansion and relative shadow pixels | Equivalent native CSS normalization, not stale state |
| H | Tiny/zero-size and transformed/SVG highlight rectangles | Bounding rectangles rather than painted-shape contours; no drawable zero-size outline |
| H | Context selection does not force :hover/:focus/:active, viewport or absent generated content | Rules activate only in the actual browser context; UI explains this |
| H/I | Ambiguous %/ch conversion is disabled with a reason; calc()/var()/keywords remain raw | Safe conversion guards; enabled options preserve current size; manual valid units remain supported |
| I | Cross-origin CSSOM, imports, relative/shadow-host unsupported sources, read-only keyframes | Truthfully marked unavailable/unresolved, not fabricated winners |
| I | Closed shadow and iframe interiors | Unavailable; iframe outer borders and open roots work; no full iframe support added |
| I | Bounded tree/source snapshots and unedited replacement retirement | Refresh handles external changes; no edited session means no migration to resume |
| I | Complex/repeated filter functions | Conflicting current field disabled with a preservation tooltip; unrelated supported functions and Undo/Reset remain safe |
| I | Author-mutation UI | No visible policy switch; mutated-author/blocked/partial rollback exercised by locked engine tests, not claimed as user-visible UI interactions |
| H / test maintenance | Legacy professional test expects 2em + ArrowUp = 3em | Current locked unitStep is0.1em; at20px font the correct result is2.1em /42px. Legacy assertion remains unchanged and fails; current units regressions pass |

## 11. Existing visible but unwired/incomplete surfaces

**J01–03:** three enabled dock affordances only open “This tool is not connected yet.” Their opening, focus, active state and closing are wired; their implied tools are not. Recommend hiding or disabling those three affordances with truthful labels in CURRENT UI FUNCTIONAL FIXES. Do not implement Background tools, Color tools or Eyedropper as new features during that fix phase.

**J04:** production Changes is a **real but incomplete session summary**, not static fixture data. It shows the true edited-element count and functional Undo/Reset with correct button disabling and modal focus. It exposes no detailed element/property/before-after/transaction review or copy/export. The preview-only fixture Changes component is not the production surface. Preserve the real session actions and clarify their scope; defer full Changes/History/Export.

For safety in the next fix phase, also disable alpha conversion for unresolved valid color tokens and unsupported gradient-hint editing until they can preserve semantics. Do not disable ordinary Design/Code editing or Undo/Reset globally; those core supported paths work. This report makes recommendations only—nothing was disabled here.

## 12. Exact reproduction steps and issue evidence

Fixtures are realistic host pages, not mocked React inspector state. `extensionHarness.setup` loads `.output/chrome-mv3` into installed Chrome via `Extensions.loadUnpacked`, invokes its actual action and checks host layout/manifest permissions. All new audit edits use shipped UI fields/buttons/sliders or keyboard/pointer gestures; engine snapshots are read-only diagnostics. Some older locked engine regressions intentionally call engine APIs/inject mutation races; they are separately identified as foundation verification.

Fixture IDs: shell/effects use Fieldnotes `#checkout`; Design uses `#audit-target`; Code/tree uses `#target` with a nested span, named slot and large branch. The exact fixture CSS and every action are retained in the four new current-ui specs. Click Code’s button padding when selecting it: the nested text span is independently selectable.

### UI01 — html/body transforms move the inspector header and upper controls off-screen

**E: Layout/zoom/overflow bug · High · P1.** Affected surface: Inspector shell on transformed pages.

1. Activate CSSForge on the hostile Fieldnotes fixture and pick #checkout.
2. Set document.documentElement.style.transform (or document.body.style.transform) to translate(30px,20px) scale(.9).
3. Open Measurement tools and inspect the inspector bounds.

**Expected:** The inspector stays anchored to the viewport with its header and controls reachable.

**Actual:** The 1440×900 viewport contains an inspector at x1063.2,y−768.4,width315,height1513.8. The header and upper Design controls are off-screen for both html and body transforms. Dock and Measurement remain clickable.

**Probable root cause:** The normal-document UI and its fixed/absolute descendants inherit the transformed ancestor containing block; the selection overlay alone uses the browser top layer. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [entrypoints/content.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/entrypoints/content.tsx), [src/ui/ui.module.css](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/ui.module.css), [src/ui/interactions/useInspectorDrag.ts](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/interactions/useInspectorDrag.ts).

**Evidence:** [SH06.json](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/SH06.json), [07-transform-html.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/07-transform-html.png), [07-transform-body.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/07-transform-body.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: viewport anchoring and clamping under host transforms.

### UI02 — A maximum-z-index host overlay covers and intercepts the current UI

**E: Layout/zoom/overflow bug · High · P1.** Affected surface: Host-page stacking.

1. Activate CSSForge and pick a page element.
2. Append a fixed inset:0 host div with z-index:2147483647 and pointer-events:auto.
3. Check document.elementFromPoint at the Measurement dock button centre and attempt to operate CSSForge.

**Expected:** Inspector, dock, popovers and modal controls remain operable above host page UI.

**Actual:** The top hit is div#host-cover, and the screenshot shows the host covering the inspector and dock. Removing the cover restores the Measurement popover. The page selection overlay remains above the cover.

**Probable root cause:** App UI uses normal-document stacking (app z-index2147483646), while createOverlay uses showPopover top-layer placement. A higher host stacking layer can occlude the UI. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [entrypoints/content.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/entrypoints/content.tsx), [src/ui/ui.module.css](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/ui.module.css), [src/picker/overlay.ts](C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/overlay.ts).

**Evidence:** [SH06.json](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/SH06.json), [08-host-high-z.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/08-host-high-z.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: ensure existing UI layers stay above hostile page stacking.

### UI03 — Selection outline and identity label paint above inspector, dock and review/popover content

**E: Layout/zoom/overflow bug · Medium · P1.** Affected surface: Selection highlight versus all CSSForge surfaces.

1. Pick #checkout and move the inspector to the upper-left over the selected button.
2. Alternatively open Changes while that target is selected, or use a 320px viewport and open Text color.
3. Observe the mint outline and dark target label crossing CSSForge content.

**Expected:** Target feedback stays behind CSSForge control, popover and review surfaces or is hidden while those surfaces cover the target.

**Actual:** The target outline/label crosses Typography controls, the ColorControl spectrum, the dock and the Changes review surface. Pointer events remain disabled on the feedback, but it obscures text and color controls.

**Probable root cause:** createOverlay calls showPopover; its top-layer paint order outranks ordinary CSSForge app/modal z-indices. Suspending picking does not hide the selected feedback. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/picker/overlay.ts](C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/overlay.ts), [src/ui/App.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/App.tsx), [entrypoints/content.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/entrypoints/content.tsx).

**Evidence:** [02-inspector-normal.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/02-inspector-normal.png), [04-live-changes.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/04-live-changes.png), [05-zoom-200.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/05-zoom-200.png), [06-short-viewport.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/06-short-viewport.png), [../effects/color-narrow-320.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/../effects/color-narrow-320.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: coordinate existing selection feedback and UI stacking.

### J01 — Enabled Background tools dock action has no connected tool

**J: Existing visible surface not actually wired · Medium · P1.** Affected surface: Background tools.

1. Focus the Background tools dock button and press Enter (or click).
2. Inspect the popover; repeat the trigger click to close it.

**Expected:** An enabled tool affordance provides its stated current action or clearly communicates unavailability before activation.

**Actual:** The popover titled Background tools only says “This tool is not connected yet.” It has no action controls; the trigger is enabled and displays active/expanded state.

**Probable root cause:** LiveDock later() deliberately renders placeholder popovers. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/dock/LiveDock.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/dock/LiveDock.tsx).

**Evidence:** [SH03.json](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/SH03.json).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: hide or disable existing placeholders with truthful labeling; do not implement future tools.

### J02 — Enabled Color tools dock action has no connected tool

**J: Existing visible surface not actually wired · Medium · P1.** Affected surface: Color tools.

1. Focus the Color tools dock button and press Enter (or click).
2. Inspect the popover; repeat the trigger click to close it.

**Expected:** An enabled tool affordance provides its stated current action or clearly communicates unavailability before activation.

**Actual:** The popover titled Color tools only says “This tool is not connected yet.” It has no action controls; the trigger is enabled and displays active/expanded state.

**Probable root cause:** LiveDock later() deliberately renders placeholder popovers. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/dock/LiveDock.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/dock/LiveDock.tsx).

**Evidence:** [SH03.json](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/SH03.json).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: hide or disable existing placeholders with truthful labeling; do not implement future tools.

### J03 — Enabled Eyedropper information dock action has no connected tool

**J: Existing visible surface not actually wired · Medium · P1.** Affected surface: Eyedropper information.

1. Focus the Eyedropper information dock button and press Enter (or click).
2. Inspect the popover; repeat the trigger click to close it.

**Expected:** An enabled tool affordance provides its stated current action or clearly communicates unavailability before activation.

**Actual:** The popover titled Color sampling only says “This tool is not connected yet.” It has no action controls; the trigger is enabled and displays active/expanded state.

**Probable root cause:** LiveDock later() deliberately renders placeholder popovers. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/dock/LiveDock.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/dock/LiveDock.tsx).

**Evidence:** [SH03.json](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/SH03.json).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: hide or disable existing placeholders with truthful labeling; do not implement future tools.

### J04 — Changes is a live session summary with incomplete review content

**J: Existing visible surface not actually wired · Medium · P2.** Affected surface: Changes.

1. Apply Font size to 27px and Text color to #abcdef to #checkout.
2. Open Changes from dock or More tools.
3. Inspect available content, press Undo last edit, then Reset session edits and Close.

**Expected:** The current surface accurately describes its available session actions and makes its incomplete review scope clear.

**Actual:** The edited-element count and Undo/Reset are real and update browser values; focus containment and opener return work. There is no selector/property/before-after/transaction list, copy/export or detailed review. The only explanation says detailed review/export is not connected. This is not the preview fixture surface.

**Probable root cause:** LiveSurface renders only editedCount, SessionActions and a limitation paragraph; fixture ChangesSurface is not mounted by the production App. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/inspector/LiveInspection.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/inspector/LiveInspection.tsx), [src/ui/design/EditControls.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/design/EditControls.tsx).

**Evidence:** [SH04.json](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/SH04.json), [04-live-changes.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/shell/04-live-changes.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: present the existing session summary truthfully; defer full Changes/History and Export.

### DA01 — The padding box paints over and intercepts enabled Margin unit options

**E: Layout/zoom/overflow bug · Medium · P1.** Affected surface: Spacing unit menus.

1. Pick #audit-target from the Design audit fixture; open only Spacing.
2. Enter Margin top to 10.5px, then open Margin top unit.
3. Try to click px or em; alternatively open Margin right unit and click px.

**Expected:** Every enabled unit option is visible and pointer reachable above the spacing diagram.

**Actual:** Padding controls paint across the menu. Native ShadowRoot.elementFromPoint hits padding-box controls rather than the enabled option; three tested option positions are blocked. Focusing the option and pressing Enter performs the size-preserving conversion correctly.

**Probable root cause:** Popover is rendered inside the compact spacing numeric wrapper; the sibling positioned padding-box content establishes paint order that outranks the menu in that wrapper. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/ui.module.css](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/ui.module.css), [src/ui/design/LiveDesignView.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/design/LiveDesignView.tsx), [src/ui/shared/NumericScrubber.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/shared/NumericScrubber.tsx), [src/ui/popovers/Popover.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/popovers/Popover.tsx).

**Evidence:** [unit-option-matrix.json#unit-option-matrix-059](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/unit-option-matrix.json), [unit-option-matrix.json#unit-option-matrix-064](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/unit-option-matrix.json), [unit-option-matrix.json#unit-option-matrix-077](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/unit-option-matrix.json), [blocked-unit-margin-top-px.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/blocked-unit-margin-top-px.png), [blocked-unit-margin-top-em.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/blocked-unit-margin-top-em.png), [blocked-unit-margin-right-px.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/blocked-unit-margin-right-px.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: place existing spacing menus above diagram controls; preserve conversion logic.

### DA02 — Alt+ArrowDown generates an invalid fractional z-index

**F: Accessibility/keyboard bug · Low · P2.** Affected surface: Z-index keyboard stepping.

1. Pick #audit-target; open Positioning with position:relative.
2. Enter Z-index to 5 and press Enter.
3. Focus Z-index and press Alt+ArrowDown.

**Expected:** A keyboard step for an integer-only property produces a valid integer or safely leaves the value unchanged.

**Actual:** The field becomes4.9 with aria-invalid=true and an error; the browser remains at z-index5. Escape safely restores5. No incorrect CSS is committed.

**Probable root cause:** NumericScrubber applies the generic Alt×0.1 multiplier to z-index without an integer-aware step; browser validation subsequently rejects the draft. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/shared/NumericScrubber.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/shared/NumericScrubber.tsx), [src/editing/values.ts](C:/Users/alire/Documents/ChatGPT/CSSForge/src/editing/values.ts), [src/ui/design/EditControls.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/design/EditControls.tsx).

**Evidence:** [supplement.json#supplement-016](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/supplement.json), [supplement-z-index-alt-step.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/supplement-z-index-alt-step.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: keep the existing integer field stepping valid; no new unit system.

### DA03 — Unsupported unit rejection has no associated explanation

**F: Accessibility/keyboard bug · Low · P2.** Affected surface: Locally rejected NumericScrubber input.

1. Pick #audit-target; open Spacing.
2. Type 11qu into Margin left and press Enter.
3. Inspect visible errors and the input accessibility attributes.

**Expected:** The rejected field identifies the invalid unit and links a readable error or explanation.

**Actual:** Browser margin stays8px and aria-invalid istrue, but there is no alert, aria-describedby or aria-errormessage. The tooltip still describes the browser value and generic drag/Escape instructions.

**Probable root cause:** validNumeric rejection occurs locally in NumericScrubber.apply before the editor callback and only sets invalid state; the engine error rendered by SessionActions is never populated. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/shared/NumericScrubber.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/shared/NumericScrubber.tsx), [src/ui/design/EditControls.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/design/EditControls.tsx).

**Evidence:** [unit-option-matrix.json#unit-option-matrix-322](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/unit-option-matrix.json), [unit-option-matrix.json#unit-option-matrix-323](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/unit-option-matrix.json), [invalid-unit-spacing.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/design/invalid-unit-spacing.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: connect local numeric validation to a concise field explanation.

### CA61 — Escape leaves a CodeMirror draft open

**D: Interaction/focus bug · Medium · P2.** Affected surface: Code value editor.

1. Pick button#target.primary through its padding and open Code.
2. Edit inline font-size to 25px and press Enter.
3. Edit the new CSSForge font-size override, replace the draft with 33px, and press Escape.

**Expected:** Escape discards the uncommitted draft and restores the existing 25px value control.

**Actual:** The CSS value font-size editor remains focused with 33px and Cancel visible. Browser font-size remains 25px. Only clicking Cancel discards the draft.

**Probable root cause:** ValueEditor handles Enter only; the shared Escape policy has no Code draft cancellation callback. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/code/LiveCodeView.tsx:18](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/code/LiveCodeView.tsx:18), [src/ui/interactions/useEscapePolicy.ts:6](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/interactions/useEscapePolicy.ts:6).

**Evidence:** [code-observations.json CT06](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/code-observations.json), [followup-observations.json FU02](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/followup-observations.json), [03-code-escape-draft.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/03-code-escape-draft.png), [17-code-escape-followup.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/17-code-escape-followup.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: Code keyboard cancellation

### CA62 — Applying or cancelling a Code value drops focus to the page body

**D: Interaction/focus bug · Medium · P2.** Affected surface: Code Apply/Cancel.

1. Pick button#target.primary, open Code, and use the inline font-size value editor.
2. Type 25px and press Enter; inspect keyboard focus.
3. Edit the font-size override again, then click Cancel; inspect keyboard focus and press Tab.

**Expected:** Successful apply and cancellation return focus to the corresponding value control; the next Tab follows that row predictably.

**Actual:** After both actions the CSSForge ShadowRoot has no active element and document.activeElement is body. After Apply, Tab enters the old inline Edit font-size button; after Cancel, Tab enters Add session declaration, skipping the replacement override value button.

**Probable root cause:** setEditing(false) destroys the focused CodeMirror or Cancel control and does not restore focus through a ref. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/code/LiveCodeView.tsx:48](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/code/LiveCodeView.tsx:48), [src/ui/code/LiveCodeView.tsx:59](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/code/LiveCodeView.tsx:59).

**Evidence:** [code-observations.json CT02/CT04/CT07](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/code-observations.json), [followup-observations.json FU01/FU02](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/followup-observations.json).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: Code focus restoration

### CA63 — Tree Left/Right keys omit child and parent navigation

**F: Accessibility/keyboard bug · Medium · P2.** Affected surface: HTML/Navigator tree keyboard.

1. Pick button#target.primary, open HTML, and focus its already expanded treeitem.
2. Press ArrowRight.
3. Focus its leaf span#target-label treeitem and press ArrowLeft.

**Expected:** Right on an expanded node focuses its first child; Left on a leaf focuses its parent. Branch collapse and expansion also remain available.

**Actual:** Right leaves focus on button#target.primary; Left leaves focus on span#target-label. Up/Down, Home/End and Enter work. Roving tabIndex remains on the selected row after arrow focus moves.

**Probable root cause:** LiveDOMTree implements Left/Right only as expansion toggles, without a parent/child focus branch; tabIndex derives from selection rather than focused row. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/html/LiveHTMLView.tsx:23](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/html/LiveHTMLView.tsx:23), [src/ui/html/LiveHTMLView.tsx:27](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/html/LiveHTMLView.tsx:27).

**Evidence:** [tree-observations.json TR02](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/tree-observations.json), [followup-observations.json FU04](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/followup-observations.json), [18-tree-keyboard.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/18-tree-keyboard.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: complete existing tree keyboard interaction

### CA64 — Selected assigned slot content disappears from both trees

**C: UI-engine synchronization bug · Medium · P1.** Affected surface: HTML/Navigator slotted selection.

1. Use an open shadow host with a named slot and an assigned light-DOM strong#slotted-label child.
2. Pick the rendered slotted label, then inspect HTML and open Navigator.
3. Click Refresh tree.
4. Alternatively pick the open-shadow button, select the visible slot treeitem and use Child.

**Expected:** The assigned selected node appears exactly once with its slot ancestry in both trees, and selection remains locatable after Refresh or Child navigation.

**Actual:** Inspector identity and page highlight correctly show strong#slotted-label, but both trees contain no selected row and no strong#slotted-label row. Refresh preserves the omission. Selecting slot shows the assigned child, but Child selects the strong and makes it disappear again. Parent of the assigned child goes directly to the light-DOM host.

**Probable root cause:** controller.parentOf follows parentElement/open-root host without assignedSlot; navigationChildren traverses a host's shadow tree and assigned slot children. The selected path therefore disagrees with tree traversal. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/picker/controller.ts:91](C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/controller.ts:91), [src/picker/navigation.ts:1](C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/navigation.ts:1), [src/picker/tree.ts:16](C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/tree.ts:16).

**Evidence:** [tree-observations.json TR05](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/tree-observations.json), [followup-observations.json FU05/FU06](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/followup-observations.json), [19-html-slotted-selected.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/19-html-slotted-selected.png), [20-navigator-slotted-selected.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/20-navigator-slotted-selected.png), [21-html-slot-child.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/code-tree/21-html-slot-child.png).

**Recommended next fix:** CURRENT UI FUNCTIONAL FIXES: composed slot ancestry consistency

### EFF-A-01 — Escape retains a color edit despite the field tooltip promising gesture cancellation

**A: Functional bug · Medium · P2.** Affected surface: Shared closed color inputs.

1. Select #checkout in the built-Chrome fixture.
2. Open Typography and focus Text color.
3. Replace the native white value with #00ff00.
4. Press Escape while the field is focused.

**Expected:** Escape restores the white color, consistent with the displayed tooltip 'Escape reverts the current gesture.'

**Actual:** Target stays rgb(0, 255, 0); field stays #00ff00. Undo later restores white.

**Probable root cause:** EditField passes a NumericScrubber tooltip to ColorControl. ColorControl handles Enter but has no Escape/cancelGesture handler. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/shared/ColorControl.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/shared/ColorControl.tsx), [src/ui/design/EditControls.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/design/EditControls.tsx).

**Evidence:** [focused-color.json#focused-color-001](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/focused-color.json), [focused-color-escape.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/focused-color-escape.png).

**Recommended next fix:** Shared color interaction and truthful tooltip behavior

### EFF-A-02 — Changing currentColor alpha silently changes its hue to black

**A: Functional bug · Medium · P2.** Affected surface: ColorControl alpha on a valid CSS token.

1. Select the white-text #checkout fixture.
2. Open Box shadow and Add box shadow.
3. Set Box shadow color to currentColor and press Enter.
4. Open Box shadow color picker and type 50% in Alpha.

**Expected:** Either preserve the rendered white hue while changing opacity, or disable alpha for a token that cannot be resolved safely.

**Actual:** White currentColor shadow becomes rgba(0, 0, 0, 0.5); main field is #00000080. Undo restores currentColor.

**Probable root cause:** The numeric alpha handler calls rgb(parsed ?? '#000') when Culori cannot parse currentColor, replacing a valid unresolved token with black. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/shared/ColorControl.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/shared/ColorControl.tsx).

**Evidence:** [focused-color.json#focused-color-003](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/focused-color.json), [focused-color-currentcolor-alpha.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/focused-color-currentcolor-alpha.png).

**Recommended next fix:** Shared color token handling; disable alpha for unresolved valid tokens until conversion is safe

### EFF-B-01 — A valid interpolation hint is displayed as a color stop with an invented position

**B: Incorrect value/state · Medium · P2.** Affected surface: Complex gradient stop editor.

1. Select #complex-gradient, authored with linear-gradient(90deg, red 0% 20%, 45%, blue 100%).
2. Open Background and select Layer 1.
3. Inspect the stop rows and track.

**Expected:** Recognize the standalone 45% interpolation hint as a hint, or preserve the complex syntax in a clearly limited editor instead of displaying it as a CSS color.

**Actual:** Chrome normalizes red 0% 20% into two red stops. UI shows four color rows; Stop 3 color contains invalid color token 45%, with a default position around 66.7%. Native gradient remains valid; angle edit/Undo/Reset preserve its actual CSS.

**Probable root cause:** parseGradient treats every remaining argument as a color stop. A lone percentage cannot be distinguished as an interpolation hint and receives an implicit-stop editor. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/editing/rich.ts:parseGradient](C:/Users/alire/Documents/ChatGPT/CSSForge/src/editing/rich.ts), [src/ui/design/RichBackground.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/design/RichBackground.tsx), [src/ui/design/GradientTrack.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/design/GradientTrack.tsx).

**Evidence:** [background.json#background-062](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/background.json), [background-complex-gradient.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/background-complex-gradient.png).

**Recommended next fix:** Rich gradient parser/state presentation; block unsupported hint editing until faithfully represented

### EFF-B-02 — Four valid side colors appear as a single unparseable color token with a black/default picker

**B: Incorrect value/state · Medium · P2.** Affected surface: Border color for nonuniform four-side colors.

1. Select #nonuniform, authored with red/green/blue/yellow side colors.
2. Open Border.
3. Open Border color picker without editing.

**Expected:** Display a clear mixed/per-side state and explain that choosing one color replaces all sides.

**Actual:** Main field contains the four-value rgb shorthand, swatch appears unset, picker defaults to black and says 'Enter a color, or choose a new one to replace this token.' Applying one color and Undo work correctly.

**Probable root cause:** A border-color shorthand containing four valid colors is passed into a parser that expects one CSS color. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/shared/ColorControl.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/shared/ColorControl.tsx), [src/ui/design/LiveDesignView.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/design/LiveDesignView.tsx).

**Evidence:** [color.json#color-070](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/color.json), [color-nonuniform-border.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/color-nonuniform-border.png).

**Recommended next fix:** Border UI mixed-value presentation

### EFF-F-01 — Invalid popup format input omits aria-invalid although CSS is rejected

**F: Accessibility/keyboard bug · Medium · P2.** Affected surface: All six ColorControl format inputs.

1. Open a text/background/border/box-shadow/text-shadow/gradient-stop color picker.
2. Choose HEX, RGB or HSL.
3. Replace its formatted text with an invalid color.

**Expected:** Focused invalid format input exposes aria-invalid=true and an associated error.

**Actual:** CSS remains unchanged and visible error appears, but formatted popup input aria-invalid is null. Closed input exposes aria-invalid=true. Confirmed across all six current control contexts.

**Probable root cause:** The popup formatted input lacks aria-invalid; only the closed color input receives it. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/shared/ColorControl.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/shared/ColorControl.tsx).

**Evidence:** [color.json#color-008](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/color.json), [color.json#color-020](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/color.json), [color.json#color-032](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/color.json), [color.json#color-044](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/color.json), [color.json#color-056](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/color.json), [effects-followup.json#effects-followup-009](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/effects-followup.json), [effects-followup-gradient-invalid-color.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/effects-followup-gradient-invalid-color.png).

**Recommended next fix:** Shared color accessibility

### EFF-G-01 — The same color picker has inconsistent format tabs, swatch shape and input typography across sections

**G: Visual consistency/UI polish · Low · P3.** Affected surface: Color controls across Typography and Effects.

1. Open Text color picker in Typography and select HSL.
2. Open Box shadow color picker and select HSL.
3. Compare selected tabs, closed swatches, captions and fields.

**Expected:** Shared color controls follow consistent visual conventions unless the surface difference has a clear user purpose.

**Actual:** Typography uses underline tabs, square swatch, larger code-styled closed field and a divided heading; Effects uses filled segmented tabs, circular swatch and smaller UI-font closed field.

**Probable root cause:** Typography-only ColorControl CSS overrides deliberately diverge from the shared base color UI. This is an inference from the observed behavior and local source, not a product fix.

**Affected files:** [src/ui/shared/propertyControls.module.css](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/shared/propertyControls.module.css).

**Evidence:** [color-text-color.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/color-text-color.png), [color-box-shadow-color.png](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/effects/color-box-shadow-color.png).

**Recommended next fix:** Later UI consistency pass; no functional redesign during this audit


## 13. Severity and counting

| Findings | Critical | High | Medium | Low | Total |
|---|---:|---:|---:|---:|---:|
| Confirmed defects A–F | 0 | 2 | 11 | 2 | 15 |
| Incomplete/unwired J | 0 | 0 | 4 | 0 | 4 |
| Polish G | 0 | 0 | 0 | 1 | 1 |
| All actionable findings | 0 | 2 | 15 | 3 | 20 |

High means whole-shell access can fail on a host page. Medium means a current interaction/value/state is wrong or inaccessible in a reproducible case. Low here means a safe rejected draft or missing explanation; no unintended committed CSS was observed for those two cases. Shared defects observed in multiple color/menu instances are counted once; H/I limitations and superseded test expectations are not bugs.

## 14. Affected modules/files and preserved foundation

| Fix area | IDs | Modules |
|---|---|---|
| Host/selection layering | UI01–03 | entrypoints/content.tsx; src/picker/overlay.ts; src/ui/ui.module.css; App.tsx; useInspectorDrag.ts |
| Spacing and numeric behavior | DA01–03 | NumericScrubber.tsx; EditControls.tsx; LiveDesignView.tsx; Popover.tsx; values.ts; ui.module.css |
| Shared colors and mixed border presentation | EFF-A-01/02, EFF-B-02, EFF-F-01, EFF-G-01 | ColorControl.tsx; LiveDesignView.tsx; propertyControls.module.css |
| Gradient hint presentation | EFF-B-01 | src/editing/rich.ts; RichBackground.tsx; GradientTrack.tsx |
| Code cancellation/focus | CA61/62 | LiveCodeView.tsx; useEscapePolicy.ts |
| Tree slots and keyboard | CA63/64 | LiveHTMLView.tsx; src/picker/controller.ts; navigation.ts; tree.ts |
| Incomplete dock/review | J01–04 | LiveDock.tsx; LiveInspection.tsx; EditControls.tsx |

Created: this report; four `tests/e2e/current-ui-*-audit.spec.ts` diagnostic specs; `scripts/current-ui-audit-artifacts.mjs`; new `artifacts/diagnostics/current-ui-audit/` evidence. The Vite preview config is the sole existing-file edit, ignoring `.preview`, `test-results` and `artifacts` in its watcher. The audit also repaired selectors/fixture targeting in its new tests; no product code was repaired.

**Final preservation verification passed: 410 locked artifacts restored and byte-verified; 143 protected source and existing test files unchanged.** Production bundle SHA-256 rechecked after the final Chrome run: `9850f20ed7b837e849b2bbcdf707ad1286a98cde960e80d1ac72cf62af962c99`. Manifest remains MV3, permissions `activeTab` + `scripting`, no host_permissions.

## 15. Recommended fix order and verification

1. **P1: UI01–03/DA01.** Correct current viewport anchoring and paint/pointer ordering, then retest hostile transforms, high host overlays, selection feedback and spacing menus at narrow/zoomed sizes.
2. **P1: CA64 and J01–03.** Align existing slot ancestry/traversal/selection; hide/disable the three misleading empty dock tools. Do not add tools or refactor the engine foundation.
3. **P2: EFF-A-01/02, EFF-B-01/02.** Fix the existing color cancellation/token-alpha contract and truthful complex-gradient/mixed-border state. Prefer a safe explicit unavailable state over a semantic guess. Preserve ordinary formats and editing.
4. **P2: CA61–63, DA02/03, EFF-F-01.** Complete existing Code/tree keyboard focus and numeric/color error explanation. Keep the current unit system and transactions intact.
5. **P2: J04.** Describe the existing Changes session summary accurately; retain live count/Undo/Reset. Do not build detailed History/Export here.
6. **P3: EFF-G-01.** Address shared color visual consistency later, after functional fixes. No broad redesign is required by this audit.
7. **Test maintenance separately:** update the obsolete professional em-step expectation in an authorized test-maintenance change and stabilize action/server readiness. Locked tests were preserved in this diagnostic phase.

### Exact verification

- `pnpm.cmd typecheck`: passed, including final diagnostic additions.
- `pnpm.cmd test`: **251/251 tests, 17/17 files passed** (final rerun).
- `pnpm.cmd build`: passed at the start of the audit; that production MV3 bundle was kept stable for all Chrome tests.
- Installed browser: **Chrome 154.0.8037.92**, real MV3 extension with user-visible UI interaction.
- Combined current UI diagnostics: **24/24 groups passed (9.3m)**, with no recorded page errors. Diagnostic passing means actions/evidence completed; reported product defects are stored as observations, not hidden by pass assertions.
- Broader locked/current UI regression batch: **246 passed /8 failed (254 tests,8.2m)**. Five initial-inspector waits and one reactivation wait failed; one native source import failed when the Vite server was unavailable; one obsolete professional em-step assertion failed. No locked mutation/cascade/ownership assertion failed.
- Focused unchanged failed-case rerun: **7 passed /1 failed (29.3s)**. The remaining failure is the obsolete `professional.spec.ts:24` expectation of 60px/3em instead of 42px/2.1em.
- Six recovered activation scenarios repeated three times: **18/18 passed (40.8s)**. This diagnoses the original intermittent setup/activation failures; it does not erase their retained traces or make the original full batch green.

Broad batch command:

```powershell
pnpm.cmd test:e2e tests/e2e/engine-integration.spec.ts tests/e2e/mutation-conflicts.spec.ts tests/e2e/mutation-audit.spec.ts tests/e2e/author-mutation.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/source-index.spec.ts tests/e2e/cascade.spec.ts tests/e2e/selectors.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/editing.spec.ts tests/e2e/code-html.spec.ts tests/e2e/extension.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/rich.spec.ts tests/e2e/typography-polish.spec.ts tests/e2e/background-polish.spec.ts tests/e2e/shadow-polish.spec.ts tests/e2e/filters-polish.spec.ts tests/e2e/units.spec.ts tests/e2e/professional.spec.ts tests/e2e/hierarchy.spec.ts tests/e2e/identity-polish.spec.ts --output=.preview/current-ui-regression-results
```

Focused rerun copied only the original `.last-run.json` into its separate output folder so the first-run traces were preserved:

```powershell
pnpm.cmd test:e2e --last-failed --output=.preview/current-ui-regression-retry-results
node node_modules/@playwright/test/cli.js test tests/e2e/engine-integration.spec.ts tests/e2e/mutation-conflicts.spec.ts tests/e2e/extension.spec.ts --grep 'T1[48] |T29 |F12 |F15 |picker excludes' --repeat-each=3 --output=.preview/current-ui-activation-repeat-results
pnpm.cmd test:e2e tests/e2e/current-ui-code-tree-audit.spec.ts tests/e2e/current-ui-design-audit.spec.ts tests/e2e/current-ui-effects-audit.spec.ts tests/e2e/current-ui-shell-audit.spec.ts --output=.preview/current-ui-final-audit-results
```

Current evidence directory: [artifacts/diagnostics/current-ui-audit/](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/). The [verification record](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/verification.json) records final counts and preservation checks. The [consolidated findings JSON](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-audit/findings.json) retains classifications and modules; scope-specific JSON contains native style, target, focus, geometry and control inventory observations. Accepted cited screenshots were inspected directly. Original regression failures/traces remain in `.preview/current-ui-regression-results`; reruns use separate folders.

**CURRENT UI FUNCTIONAL AUDIT COMPLETE.** No CURRENT UI FUNCTIONAL FIXES, redesign or new product feature work has started.

