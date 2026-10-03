# CSSForge — post-Phase-10A full project health audit

Audit date: 3 October 2026, Europe/Berlin. This report and [CURRENT-STATE.md](CURRENT-STATE.md) supersede older documents that describe themselves as a current project audit. Historical phase reports retain their original checkpoint meaning.

## Baseline, scope and conclusion

Before repository work, the audit verified a clean `main` at `ad32eedf81f051a7f5ac3508e2d6a7c243f37b1e`, equal to `origin/main`, with exact tag `phase-10a` and subject `feat: add native eyedropper and optimize edit performance`. The recorded baseline is in `.preview/post-10a-audit/baseline.json`.

This was an audit, not a development phase. No production source, dependencies, configuration, manifests or repository tests were intentionally edited. No reset, clean, checkout, restore, stash, commit, push or tag mutation was performed. Fresh verification and private diagnostic helpers used ignored audit directories. Some existing supplemental browser tests write tracked screenshot/inventory artifacts; those execution side effects were preserved, rather than discarded. The final Git inventory is recorded below.

The current product is a functioning, conservatively scoped local inspector/editor. It has connected Design, Code, HTML, Navigator, Changes, CSS output, native color sampling, bounded native text/structure mutation and one history. The fresh main critical browser run passed all 482 executed cases. That result does not erase the eight current product defects reproduced by additional targeted audit probes: five P2 and three P3. Three of the P2 defects are narrow ownership/resource-policy gaps that predate Phase 10A; two are interaction/feedback issues. No P0 or P1 was established in the audited scope.

The 21 numbered findings comprise **P0: 0; P1: 0; P2: 9; P3: 12**. These totals include defects, release gaps, debt and explicitly unverified risks; they are not 21 confirmed runtime bugs. Local engineering verification is strong. Public distribution is not ready: notices, icons and compatibility/store closure remain incomplete. The original multi-second real-page hang remains unverified, and approximately 1.5 MB of post-GC heap growth remains unattributed. Neither is declared fixed or proved to be a leak.

### Evidence rules

The evidence order was current production source, executed current tests, current configuration, freshly built runtime, current documentation and then historical reports. The labels below mean:

| Label | Meaning |
| --- | --- |
| SOURCE VERIFIED | Inspected current production source/configuration and its actual caller/ownership boundary. |
| TEST VERIFIED | Current executed test evidence with the stated pass/fail outcome; test existence alone does not qualify. A failed or observational case is never relabeled as a passing correctness assertion. |
| RUNTIME VERIFIED | The stated behavior was observed in the freshly built extension or its browser/native measurements. |
| DOCUMENTATION ONLY | A document records a claim; it is not independently established by this audit. |
| INFERRED / UNVERIFIED | A risk, compatibility boundary or causal explanation lacks sufficient current execution/retainer evidence. |

Passed private recorder cases mean the collection completed. Their recorded observations, including defects, were reviewed separately. A second-RAF timestamp is a **paint-opportunity proxy**, not proof of the actual instant a pixel reached the display. Instrumented-readable-build timings are not production latency measurements. Absence of an observed security failure is not a universal safety certification.

## Current architecture and ownership

| Responsibility | Current owner | Ownership boundary and assessment |
| --- | --- | --- |
| Toolbar activation/deactivation | `entrypoints/background.ts:3–29`, `src/picker/supportedPage.ts` | `activeTab`/`scripting`, top document, per-tab pending guard; toggle existing runtime before injection; rejected pages get action badge/title feedback. |
| ShadowRoot UI and document lifetime | `entrypoints/content.tsx:13–64`, WXT UI registration, `src/ui/App.tsx` | One manually shown top-layer UI host and React mount. Author/DOM recovery ledgers are document-local and can outlive a UI activation for unresolved recovery; pagehide/context invalidation retires them. |
| Picker and physical selection | `src/picker/controller.ts`, `targetLifecycle.ts`, `candidates.ts`, `navigation.ts` | Exact native Element, document/root and physical binding generation; handles stay outside Zustand. Hover is frame-gated outside React. UI and unsupported interiors are excluded. |
| Geometry and overlay | `src/picker/frame.ts`, `overlay.ts`, controller selected ResizeObserver | Coalesced frame/geometry publishers, selected dimensions and noninteractive feedback. Geometry-only work avoids source/effect analysis. |
| Display identity | `src/picker/identity.ts:5–15` | A bounded human label; it grants no selector, native-object or mutation authority. |
| Locator and reconciliation | `src/engine/locator/*`, `src/engine/reconciliation/*`, controller migration callback, `session.ts:378–403` | Strong unique bounded same-root replacement proof. Logical CSS history can migrate only after revalidation; native text/structure authority never follows a label or same-ID replacement. |
| Selector generation | `src/engine/selectors/*`, controller `prepareChanges` | Current root-local native uniqueness is checked on explicit output. Output selectors describe a current target; they do not authorize reconciliation or original-source writes. |
| Source provenance | `src/engine/sources/*`, `src/editing/readable.ts` | Readable bounded CSSOM identities, priorities/context/source notices and explicit refresh. Original files, comments and complete inaccessible CSS are not reconstructed. F01 identifies an incorrect marker-lookalike exclusion. |
| Cascade/effectiveness | `src/engine/cascade/*`, `src/editing/effectiveness.ts`, controller `effectsFor` | Conservative author evidence. Full inspection and property-scoped contribution reads share semantic checks. Requested/stored/computed/effect states remain distinct. |
| CSS session editing | `src/editing/session.ts`, `properties.ts`, `values.ts`, `contexts.ts` | Owned session layers/markers, synchronous transaction guards, scope/context and physical target authority. Ordinary product policy is `SESSION_OVERRIDE`. |
| Native author mutation | `src/engine/mutation/*`, session `applyAuthor`/policy methods | Guarded issued bindings, scope/freshness and rollback/conflict recovery. Engine foundation exists, but ordinary product UI has no policy setter. |
| DOM text/structure | `src/editing/dom/*`, session native-operation methods, `src/ui/text/*` | Native objects and immutable exact plans/root/parent/sibling/content evidence. No arbitrary HTML string parser or framework component authority. |
| Unified history | `session.ts:31/42/454–521` | One ordered `Transaction[]` contains CSS, accepted sample, text, structure and conditional author records. Document ledgers retain ownership/recovery, not a second public Undo stack. |
| Changes | Session current-state projection, `src/editing/changes.ts`, `LiveChangesSurface.tsx` | Net owned state grouped by logical target. Repeated edits collapse review rows while accepted transaction order remains available to Undo. |
| Copy/export | Controller `prepareChanges`, `src/export/css.ts`, `actions.ts` | Fresh selectors, deterministic enabled CSS-only output and explicit omissions. Download Blob URL is revoked. No DOM serialization or sampled-screen metadata. |
| EyeDropper | `src/platform/eyedropper.ts`, shared `ColorControl.tsx`, exact rich-color consumers | Module request lease and control/target/generation/context/layer/stop/value/format ownership. Pending-only subscribers; accepted sample becomes one ordinary CSS gesture. |
| React/presentation state | `src/picker/context.tsx`, `src/state/ui.ts` | `useSyncExternalStore` controller snapshots; Zustand surface/popover/presentation flags. F12 identifies one write-only derived field. |
| Popover/focus/Escape | `Popover.tsx`, `Tooltip.tsx`, `Surface.tsx`, `focus.ts`, `useEscapePolicy.ts`, drag interactions | Surface/popover/gesture ownership and focus return; native sampling receives Escape priority. F04 identifies a child-key handling collision. |
| Teardown | Content deactivate, controller/editor/engine destroy methods | Abort native requests, unmount React, remove UI/session layers, disconnect owned work. Retained unresolved document recovery is deliberate and separate from durable persistence. |

**SOURCE VERIFIED:** the static import graph inspected 111 TS/TSX/CSS source/entrypoint modules. All were reachable from live or preview roots; live graph 109, preview graph 107. Import reachability does not prove every branch is exposed. Preview-only branches and safe-author policy branches were inspected separately. No accidental second product history or duplicate source of physical selection authority was established. Display identity, locator evidence and export selectors deliberately answer different questions. Presentation import cycles were observed, but no correctness defect was attributed to them.

### Supported limits that determine current scope

The registry exposes **39 editable properties**. The 43 values in a diagnostic computed read include aliases/readouts and must not be presented as 43 editable properties. The source index is bounded per scope to 50 stylesheets, 2,000 rules, 12 nested groups and 10,000 declarations; inaccessible sheets and nonexpanded imports constrain proof. Tree presentation is bounded to 180 rows/depth 16, with lazy child chunks of 32. Native text requires one exact direct Text child in an eligible HTML owner and is limited to 65,536 UTF-16 code units.

Native structure insertion allows `div`, `span`, `p`, `button` with `type=button`, and `section`, plus literal text. Whole-subtree safety bounds are 128 nodes, depth 8, 32,768 text characters, 256 attributes, 16,384 attribute-text characters and ancestry depth 64. Platform/form/editable/custom/SVG/resource-sensitive subtrees are conservatively refused. Eligible ordinary HTML interiors in the current document **and accessible open ShadowRoots** are supported within these bounds; closed roots, custom/shadow hosts as structural owners and slot/platform semantics are not a general mutation capability (`dom/resolve.ts:12`, `dom/structure.ts:43–54`).

Closed shadow interiors and iframe interiors remain unavailable; the outer host/frame can be selected. Source-derived media and terminal hover/focus/active/before/after contexts do not force media/state or simulate a viewport. Complex gradients/shadows/filter syntax are preserved as unsupported tokens rather than guessed into a simple editor. Original-source-file save, arbitrary HTML building, Redo and durable persistence are absent.

## Verification, browser scope and evidence preservation

The required command order was respected for typecheck, unit test, build, ZIP and then the main critical browser run. All listed browser invocations used `--retries=0`. No hidden automatic rerun was used to replace a failure.

| Current invocation | Exact outcome | Evidence / interpretation |
| --- | --- | --- |
| `pnpm typecheck` | Passed | `.preview/post-10a-audit/typecheck.log` |
| `pnpm test` | **394 passed, 0 failed, 0 skipped; 24 files; 5.05 s** | `unit.log`; current unit assertions, not universal browser proof. |
| `pnpm build` | Passed; **10.4 s** | `build.log`; final unpacked production build. |
| `pnpm zip` | Passed; **5.084 s** | `zip.log`; final production package, verified against unpacked file hashes. |
| Main critical browser run, 35 suites | **482 passed, 0 failed, 0 skipped; 21.9 min** | `critical.log`, `critical-results`, `run-critical.ps1`; three historical screenshot-only cases explicitly grep-deselected, not reported as skips. |
| Supplemental functional run, 8 files / 9 cases | **8 passed, 1 failed, 0 skipped; 1.5 min** | `supplement.log`, `supplement-final-results`; identity-polish Font family Escape assertion failed (F19). The first failure trace/context were preserved. |
| Earlier premature supplemental attempt | **4 completed passes, fifth case interrupted** | `supplement-premature.log`, `supplement-results`; stopped because it overlapped the tail of the main run. **ENVIRONMENT / interrupted audit sequencing**, not a product failure or clean completed invocation. |
| Private audit recorder cases | **8 completed, 0 collection failures, 0 skipped; 18.6 s** | `probes.log`, `probe-results`; these collected the eight defects F01–F08. Their completion is not correctness certification. |
| Fresh production 32-cycle ownership/memory case | **1 passed, 0 failed, 0 skipped; 3.4 min** | `memory.log`, `memory-results`, `post-10a-audit-memory-32.json`. |
| Fresh isolated instrumented build | Passed; **11.1 s** | `diagnostic-build.log`; ignored copy only, not the final release artifact. |
| Single-edit / five-edit / geometry / parity diagnostics | Collection completed, no recorder errors | `current-diagnostic.json`, `diagnostic.log`; instrumented cost/ownership observation. |
| Fresh instrumented 8-cycle ownership case | **1 passed, 0 failed, 0 skipped; 55 s** | `diagnostic-cycles.log`, `diagnostic-cycle-results`; ignored diagnostic build only. |
| Additional shell/structural invocation, 9 cases | **8 passed, 1 failed, 0 skipped; 1.1 min** | `legacy-diagnostic.log`, `legacy-diagnostic-results`; shell SH04 waits for the stale “Review changes” dock label (F19). The structural comparison passed using its tracked historical baseline (F18). Mixed collectors are not independent certification of every recorded row. |
| Bounded built-product walkthrough | **Completed on ordinary, hostile/top-layer, heavy and open-root fixtures** | `walkthrough.json`, `walkthrough-export.css`; actual public controls plus current build. See walkthrough section for precise bounds. |
| Fresh actual OS-native pixel/OS Escape check | **INFERRED / UNVERIFIED in this audit** | The Windows task-window helper did not expose the disposable audit Chrome window. Public native request entered busy and browser-CDP Escape cancelled; this is not actual OS pixel selection or OS-key evidence. Historical Phase 10A real Windows evidence remains separate. |

The 35 main suites included Phase 08A truth/TokenInput/replacement, Phase 08B Changes/output, Phase 09A text/domain history, Phase 09B structure, all Phase 10A request/platform/performance suites, source/cascade/scoped cascade performance, editing/author mutation/conflicts, locator/selectors/reconciliation/targeting, Changes, Code/HTML/Navigator, current UI P1/P2, rich controls/units/professional interactions, focus/keyboard/native zoom, picker performance and edit-time performance. All **52 Phase 10A cases** and all **24 edit-time performance/watchdog/cycle cases** in that invocation passed. Full/scoped native CSSOM comparison passed its 14-stage browser case and associated unit checks. The old raster-only flake was not reproduced in this fresh critical invocation.

Runtime tools were Node 24.19.0, pnpm 11.19.0, WXT 0.20.27, Vite 7.3.6, Vitest 3.2.7 and Playwright 1.63.0; the browser was Chrome 154.0.8037.93. Temporary walkthrough REPL initialization encountered an ESM/CommonJS import mismatch and a missing `ProgramFiles` environment variable during automatic Chrome discovery. These were **ENVIRONMENT** tool setup failures, recovered with CommonJS loading and the verified installed executable path. No browser/dependency installation or production change was made. The Windows helper's failure to expose the disposable task window remains a current manual native-check limitation rather than a recovered OS verification.

Supplemental functional files were background-polish, current-ui-freeze (two cases), current-ui-visual-polish, filters-polish, hierarchy, identity-polish, shadow-polish and typography-polish. They assert current behavior and were not dismissed as screenshot-only. Diagnostic collector suites can catch and record action errors without failing their enclosing Playwright case; F17 explains the resulting gate limitation.

The fresh shell recorder output was also inspected rather than treated as correct merely because its cases completed. SH01/SH02/SH03/SH05/SH06/SH07/SH08 JSON timestamps were current (3 October, 10:42:41–10:43:35 UTC); their recorded errors/caught interaction errors were empty, panel/dock bounds passed and overlap was absent. All 21 SH05 popover observations fit without horizontal overflow; short-view vertical scrolling was intentional. SH02's first-font-Escape popup/focus observation is the same local TokenInput contract described in F19. SH01's row labeled “iframe border selection” actually clicked at a padding-box-relative point inside the fixture's 4px border and left selection unchanged; this is a fixture-coordinate/label TEST DEFECT, not evidence that supported frame-border picking failed. SH08 used actual viewport border points and selected both frame exteriors correctly. The pre-existing SH04 JSON is dated 1 October and is excluded from current runtime evidence; the current failed invocation is supported by its preserved fresh trace, log and error context.

Practical current automated coverage exercised normal desktop, 320/390 CSS viewports, Chrome native 200% zoom, long tokens, viewport-edge popovers, Changes, deeper tree navigation, text/structure modals, color controls and pending/disabled sampler states. Tabs/tree keyboard navigation, modal containment, Enter/Space, Escape priority, gesture cancellation and focus return have passing coverage in the stated supported workflows. F04/F07/F08 show remaining a11y defects. No full screen-reader, IME, complete contrast/forced-colors sweep or WCAG certification was performed. The source has reduced-motion/forced-colors support; that is narrower than certification.

## Important findings

### F01 — page-owned marker-looking stylesheet causes false effectiveness certainty

- **Category:** BUG; editing truth / source provenance.
- **Severity:** P2.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED.
- **Affected workflow:** Design color edits, Code source presentation and Changes on a page whose author stylesheet carries `data-cssforge-edit-layer`.
- **Reproduction/source:** `.preview/post-10a-audit/marker-sheet-probe/evidence.json`; `src/engine/sources/index.ts:48`, `src/editing/session.ts:413`. A page-owned marked sheet applies `#marked { color: rgb(0,128,0) !important }`; the public Text color control requests red.
- **Expected behavior:** Page-owned strong author CSS remains indexed or is explicitly incomplete; effect feedback reflects blocked/unknown evidence consistently.
- **Actual behavior:** Computed color stays green, but Design/Changes report “Applied / Wins supported author cascade,” and Code omits the sheet. An otherwise equivalent unmarked sheet is correctly reported blocked. Page CSSOM remained unchanged and Reset restored the original appearance.
- **Probable cause:** Attribute presence is treated as proof of CSSForge stylesheet ownership instead of exact owned-node identity. The exclusion suppresses evidence without an uncertainty notice.
- **Recommended next action:** A scoped ownership/truth fix using proven internal stylesheet identity, with marked-page stylesheet and ordinary control regressions. Preserve property-scoped cascade semantics. This behavior was also present in the Phase 09B source; it is not established as a Phase 10A regression.

### F02 — marker-looking host clone retains an unowned session target marker

- **Category:** BUG; target ownership / clone containment.
- **Severity:** P2.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED.
- **Affected workflow:** A host clones an edited native Element and adds a marker-looking layer attribute.
- **Reproduction/source:** `marker-clone-probe/evidence.json`; `src/editing/markerContainment.ts:31`. Font size 18 → 32 is applied to the original. Ordinary and marked host clones are then inserted.
- **Expected behavior:** Both new native copies lose copied session authority metadata and retain their page-owned 18px font.
- **Actual behavior:** The ordinary clone is sanitized and stays 18px. The clone marked `data-cssforge-edit-layer="host"` retains the copied target marker and becomes 32px; selection remains the original. Undo removes the style effect, but that does not make the containment contract correct.
- **Probable cause:** Added nodes with the layer attribute are skipped before marker-copy removal; related attribute-only invalidation/reconciliation exclusions warrant the same scoped review.
- **Recommended next action:** Address proven ownership predicates alongside F01; add marked-clone and marked-wrapper containment regressions. This narrow temporary override bleed predates Phase 10A. No destructive source mutation, privilege escalation or cross-document vulnerability was demonstrated.

### F03 — CSS-escaped URL bypasses Duplicate's resource-style refusal

- **Category:** BUG; native structure safety-contract gap.
- **Severity:** P2.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED.
- **Affected workflow:** Duplicate an otherwise eligible idless element with an inline resource-bearing background style.
- **Reproduction/source:** `duplicate-url-probe/evidence.json`; `src/editing/dom/structure.ts:76`. Ordinary `url(...)` is refused, while raw `u\72l(...)` is accepted by Chrome and normalized to the same URL in CSSOM/computed style.
- **Expected behavior:** Semantically equivalent resource-bearing inline styles receive the same explicit Duplicate refusal.
- **Actual behavior:** Escaped spelling enables Duplicate; a native clone is created with the same normalized resource style, Changes records one DOM duplicate and Undo restores the exact 1 → 2 → 1 count.
- **Probable cause:** The safety predicate checks raw attribute text with `/url\s*\(/i`, which does not recognize CSS escapes.
- **Recommended next action:** A parser/normalized-CSS resource-policy fix and equivalent-spelling regression. Preserve whole-operation refusal. The local pixel route produced one cached request; no new clone-triggered request or exfiltration was established. The predicate predates Phase 10A.

### F04 — color-slider adjustment keys move focus to popup buttons

- **Category:** ACCESSIBILITY / BUG.
- **Severity:** P2.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED.
- **Affected workflow:** Keyboard editing of spectrum, hue and alpha in a color popover.
- **Reproduction/source:** `ui-probe-evidence/color-slider-keyboard.json`; `src/ui/popovers/Popover.tsx:27`, shared `ColorControl.tsx`. Focus Color slider at `#336699ff`; press ArrowDown.
- **Expected behavior:** A consumed slider adjustment key preserves slider focus for subsequent adjustment.
- **Actual behavior:** Color changes to `#2f5e8cff`, but focus moves to Sample. ArrowUp restores color while moving focus to a format button. Home/End also move focus to buttons; vertical/end keys affect hue/alpha focus similarly.
- **Probable cause:** Generic popup navigation skips HTML inputs but does not respect a child slider role or `defaultPrevented`; react-colorful handles the key without stopping propagation.
- **Recommended next action:** Scoped interactive-child key ownership/focus regression. Preserve existing popup Escape and native sampling ownership rather than replacing the shared popover system.

### F05 — refused stale structure action loses visible HTML feedback

- **Category:** UX / BUG.
- **Severity:** P2.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED.
- **Affected workflow:** HTML → Inspector menu → Move down, while the host changes the prepared exact sibling gap.
- **Reproduction/source:** `ui-probe-evidence/structure-stale-feedback.json`; `src/ui/text/StructureEditor.tsx:22`, session refusal publishing, `LiveHTMLView.tsx` and `SessionActions` presentation.
- **Expected behavior:** Exact-anchor conflict refusal preserves host DOM and tells the user why the operation did not occur.
- **Actual behavior:** Move down stays enabled from the prepared menu, then correctly refuses without changing host order. The menu closes and HTML displays no refusal. Switching to Design reveals “The parent or exact insertion anchors changed.”
- **Probable cause:** Immediate structure action ignores its result and closes the transient menu; error presentation is mounted in the menu/Design/Code, not the owning HTML workflow.
- **Recommended next action:** Visible durable action-refusal feedback and a host-gap-change public workflow regression. Keep exact-native conflict guards unchanged.

### F06 — no-selection Code/HTML guidance says connected tools are unconnected

- **Category:** UX / BUG.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED.
- **Affected workflow:** Open Code/HTML before selection or after selection loss/intentional Delete.
- **Reproduction/source:** `ui-probe-evidence/no-selection-guidance.json`; `src/ui/inspector/LiveInspection.tsx:28`, `InspectorShell.tsx:35`.
- **Expected behavior:** Explain that a page element must be selected.
- **Actual behavior:** Empty states say authored CSS inspection/editing and the document tree are “not connected yet,” although selected targets route to live views.
- **Probable cause:** Historical empty-state copy survived feature wiring.
- **Recommended next action:** Small current-state copy regression, including after target loss/Delete; no engine expansion.

### F07 — Code declaration validation is not associated with the invalid fields

- **Category:** ACCESSIBILITY / UX.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED.
- **Affected workflow:** Code → Add session declaration → unsupported property or invalid value → Apply.
- **Reproduction/source:** `ui-probe-evidence/code-add-validation.json`; `src/ui/code/LiveCodeView.tsx:94–95`.
- **Expected behavior:** Invalid property/value entry is programmatically identifiable, with the relevant explanation associated to the field.
- **Actual behavior:** Alerts appear, but CSS property/New CSS value lack `aria-invalid`, `aria-describedby` and `aria-errormessage`; focus remains Apply. An unsupported property produces “Enter a valid unknown-property value,” conflating property and value causes.
- **Probable cause:** Code form-local validation does not use the stronger shared field/error contract.
- **Recommended next action:** Scoped property/value error semantics and association coverage; preserve explicit Apply/Cancel/draft authority. Screen-reader outcome was not certified.

### F08 — repeated DOM tree rows have indistinguishable accessible names

- **Category:** ACCESSIBILITY / PARTIAL.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED.
- **Affected workflow:** HTML/Navigator with repeated idless same-class elements.
- **Reproduction/source:** `ui-probe-evidence/tree-accessible-labels.json`; `src/ui/html/LiveHTMLView.tsx:26/39`, `src/picker/identity.ts:10`, `tree.ts:29`.
- **Expected behavior:** Accessible node descriptions include enough visible text/boundary/position information to distinguish repeated rows.
- **Actual behavior:** Visible First/Second repeated buttons both receive `aria-label="button.audit-repeat"`; level 5 is present, but the compact name overrides visible text/boundary descendants.
- **Probable cause:** A deliberately compact identity label is reused as the complete accessible name.
- **Recommended next action:** Bounded text/boundary/position naming coverage without changing selector or mutation authority. No claim about untested screen-reader navigation is made.

### F09 — bundled dependency notice inventory is incomplete

- **Category:** RELEASE.
- **Severity:** P2.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED (fresh package contents).
- **Affected workflow:** Public distribution of the current ZIP.
- **Reproduction/source:** `public/THIRD-PARTY-NOTICES.txt`; actual React/ReactDOM, CodeMirror/Lezer, Floating UI and Zustand imports; their installed local LICENSE files; `package.json` audit evidence.
- **Expected behavior:** Actual bundled direct/transitive dependency closure has a reviewed notice inventory preserved in the release artifact.
- **Actual behavior:** Public notices cover Geist, Lucide/Feather, react-colorful and culori, but omit notice text for the listed additional bundled libraries. Inspected JS does not supply the omitted copyright/permission text.
- **Probable cause:** Manual incremental notices without a complete bundled-dependency closure review.
- **Recommended next action:** Release packaging notice inventory and repeatable ZIP verification. This is an identified inventory gap, not legal advice or a complete license-compliance certification; no dependency update is required by this audit.

### F10 — release icons are absent from source and manifest

- **Category:** RELEASE / MISSING FEATURE.
- **Severity:** P2.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED (fresh manifest/package).
- **Affected workflow:** Installed-extension recognition and public store candidate preparation.
- **Reproduction/source:** `wxt.config.ts:12–17`, `public`, `.output/chrome-mv3/manifest.json`, current release contract.
- **Expected behavior:** Approved icon assets are included and wired to manifest/action entries.
- **Actual behavior:** No release icon source or `icons`/`action.default_icon` references ship; Lucide in-product icons and font files are not release artwork.
- **Probable cause:** Explicitly deferred distribution asset requirement.
- **Recommended next action:** Approved asset preparation and manifest/ZIP verification during release closure. Local unpacked operation is functional; no invented branding asset was added in this audit.

### F11 — current support text contradicts implemented structure editing

- **Category:** DOCS.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED; DOCUMENTATION ONLY (contradictory sentence).
- **Affected workflow:** Determine supported text/native structure capabilities from the current contract.
- **Reproduction/source:** `docs/current-support-contract.md:38` says “There is no DOM text rebinding or structure editing”; the same document and connected `StructureEditor.tsx`/session implement bounded structure operations.
- **Expected behavior:** Distinguish no automatic native text rebinding from supported safe structure editing.
- **Actual behavior:** A leftover negative sentence contradicts the current Phase 09B support section.
- **Probable cause:** Phase 09A text-scope copy not fully amended later.
- **Recommended next action:** Correct current contract wording/navigation in a later documentation task; preserve historical phase reports. Only the two requested audit documents were intentionally created here.

### F12 — activeDockTool has no production reader

- **Category:** DISCONNECTED / DEBT.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED.
- **Affected workflow:** Presentation-store maintenance/tests, not a reproduced broken tool action.
- **Reproduction/source:** `src/state/ui.ts:8–10/22/39–55`, `entrypoints/content.tsx:38`, `tests/ui.test.ts:34–40`; production caller search.
- **Expected behavior:** Stored presentation state has a consumer or explicit dormant purpose.
- **Actual behavior:** `activeDockTool`, `DockTool` and `dockToolFor` are written/derived, but rendered product reads surface/activePopover instead. The test asserts the stored bookkeeping itself.
- **Probable cause:** Earlier dock derivation retained after authoritative UI flags changed.
- **Recommended next action:** LOW-value isolated cleanup later after contract review; do not infer a hidden or broken dock feature from this field.

### F13 — ordinary history and its projection have no session-size bound

- **Category:** ARCHITECTURE / DEBT.
- **Severity:** P3; long-session scaling risk, not a reproduced hang/leak.
- **Evidence level:** SOURCE VERIFIED; INFERRED / UNVERIFIED scaling impact.
- **Affected workflow:** Very long activations with many discrete accepted edits and Changes publications.
- **Reproduction/source:** `src/editing/session.ts:42/95–143/251–255/346/361/441`, `src/editing/changes.ts`.
- **Expected behavior:** Practical long-session review/Undo cost remains predictable under a defined supported workload.
- **Actual behavior:** Ordinary transactions accumulate until Undo/Reset/teardown; publications scan history/targets to derive current rows. Author recovery alone has a 256-record limit. Gesture batching is useful but is not an ordinary history cap.
- **Probable cause:** Deliberate in-memory ordered Undo design with full current-state projection.
- **Recommended next action:** Measure representative long-session scaling before deciding bounds/incremental projection. Never silently evict recovery ownership. No causal connection to the old real-page stall or heap trend was established.

### F14 — broad presentation and open-popover positioning remain measurable overhead

- **Category:** PERFORMANCE / DEBT.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED (isolated diagnostic copy).
- **Affected workflow:** Warm edits, geometry notifications and an active positioned color popover on the heavy fixture.
- **Reproduction/source:** `current-diagnostic.json`; editor/picker subscriptions, mounted Design controls and Floating UI; fresh diagnostic input hashes.
- **Expected behavior:** Cost is understood and work respects ownership/idle boundaries before optimization is proposed.
- **Actual behavior:** One warm Width edit produced 3 editor publications/282 deliveries, one picker publication/8 deliveries, one React commit and 191 named render calls. 120 open-popover geometry notifications produced 11,400 computed-style calls/67,800 property reads, versus zero Floating positioning/computed style in the closed positioning case.
- **Probable cause:** Broad subscribed presentation and mounted controls fan out on snapshots; Floating UI's browser geometry/containing-block calculations account for the open-only style work. Counts are diagnostic instrumentation, not a claim every render is a costly DOM update.
- **Recommended next action:** Establish representative user-visible budgets and comparative repeated measurement before changing architecture. Keep existing pending/idle cleanup and scoped cascade correctness. No new confirmed performance bug was established from these counts alone.

### F15 — post-GC heap growth remains unattributed

- **Category:** MEMORY.
- **Severity:** P3; unresolved observation.
- **Evidence level:** RUNTIME VERIFIED growth; INFERRED / UNVERIFIED attribution.
- **Affected workflow:** Repeated heavy ownership/edit/deactivate/reactivate cycles.
- **Reproduction/source:** `post-10a-audit-memory-32.json`, per-round memory JSON; one persistent browser and 32 post-GC checkpoints.
- **Expected behavior:** Report retained owners and heap trend separately; establish retainers before calling a leak.
- **Actual behavior:** Active heap grew 1,510,716 bytes and inactive heap 1,551,296 bytes. Listener/DOM/browser ownership counts stayed flat; final-eight growth fell to 122,312/105,124 bytes. Growth decelerated, but a plateau was not proved.
- **Probable cause:** Unknown. Bounded harness references and known last-opener lifetime do not attribute this cumulative trend. Stable listener/node counts do not prove absence of all retained data.
- **Recommended next action:** Retainer/heap-snapshot comparison in a dedicated investigation if the observation materially affects supported sessions. Do not label it a leak or apply speculative cleanup.

### F16 — original real-page multi-second hang is still unverified

- **Category:** PERFORMANCE.
- **Severity:** P2 reliability risk; **not a confirmed current bug**.
- **Evidence level:** DOCUMENTATION ONLY for the original report; INFERRED / UNVERIFIED current reproduction/cause.
- **Affected workflow:** The user's original real-page multi-second edit stall.
- **Reproduction/source:** Phase 10A historical investigation and current heavy edit-time/watchdog evidence.
- **Expected behavior:** Closure requires the exact scenario or equivalent evidence that identifies the cause and verifies its repair.
- **Actual behavior:** Fresh synthetic/heavy probes completed without acknowledged multi-second stalls or watchdog timeouts; the original real page was not exactly reproduced. Passing synthetic tests does not prove the report fixed.
- **Probable cause:** Unknown. Property-scoped cascade improvement is verified, but it is not causal proof for that specific hang.
- **Recommended next action:** Capture the original page/action/profile under representative conditions before broad performance refactors. Keep this open as a risk and avoid inventing a fix.

### F17 — diagnostic collector passes can contain recorded mismatches

- **Category:** TEST / DEBT.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED.
- **Affected workflow:** Interpreting default browser-suite totals as complete correctness certification.
- **Reproduction/source:** `current-ui-design-audit.spec.ts:5/11–16`, `current-ui-effects-audit.spec.ts:8/25–30`, `current-ui-code-tree-audit.spec.ts:89–91`; mixed shell collector.
- **Expected behavior:** Assertive regressions and observational collectors are distinguishable, with recorded failures reviewed.
- **Actual behavior:** Intentional collectors catch action/mismatch errors and keep collecting without an aggregate product-failure assertion; some cases also have real local assertions. The fresh shell JSON review found no caught interaction errors or new product issue, but exposed an SH01 fixture-coordinate/label mismatch: a padding-box-relative `(2,2)` iframe click is labeled a border click despite the 4px border. SH08 actual viewport border clicks verify supported exterior selection. The old SH04 JSON was not regenerated after the current stale-label timeout and cannot be used as fresh evidence.
- **Probable cause:** Historical audit evidence collection prioritizes completing observations.
- **Recommended next action:** Separate/document collector and assertive gate commands, preserve useful diagnostics and inspect their JSON. Do not delete collectors or declare every completed step correct.

### F18 — structural milestone comparison is coupled to a historical artifact

- **Category:** TEST / DEBT.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED; TEST VERIFIED (fresh comparison passed).
- **Affected workflow:** Run structural presentation checks in a clean checkout/default discovery.
- **Reproduction/source:** `tests/e2e/current-ui-structural.spec.ts:5/69–73`; tracked `artifacts/diagnostics/current-ui-visual-polish/structural-semantic/before/density.json`, recording Chrome 154.0.8037.92. `git ls-files` verified that the baseline is tracked; it is not an absent or ignored fresh-checkout dependency.
- **Expected behavior:** A portable current functional gate relies on checked-in fixtures/invariants or explicitly provisioned historical inputs.
- **Actual behavior:** Default `final` stage combines useful current assertions with original declaration/order and density-improvement comparisons against an older tracked baseline. The fresh case passed in Chrome 154.0.8037.93. Its contrast check compares selected token colors against the base surface, not all rendered color pairs or full accessibility.
- **Probable cause:** A milestone comparison remains in general test discovery.
- **Recommended next action:** Separate historical improvement comparison from portable current invariants in a future test-maintenance task. Preserve the historical baseline and its version provenance; do not synthesize replacement data from current output to manufacture a pass.

### F19 — two supplemental assertions drift from current interaction contracts

- **Category:** TEST.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED; TEST VERIFIED (both initial failures preserved); RUNTIME VERIFIED current two-Escape workflow.
- **Affected workflow:** Supplemental font-family popup keyboard regression and legacy shell dock-navigation collection.
- **Reproduction/source:** `tests/e2e/identity-polish.spec.ts:81`; preserved `supplement-final-results/identity-polish-Phase-06-5-fa577-seven-views-narrow-and-zoom/trace.zip` and `error-context.md`; `RichControls.tsx:27–31`, `useEscapePolicy.ts:14`, passing Phase 08A token coverage. Shell SH04 at `tests/e2e/current-ui-shell-audit.spec.ts:112`; preserved `legacy-diagnostic-results/current-ui-shell-audit-SH0-c4d1d-tions-and-focus-containment/trace.zip` and `error-context.md`, `legacy-diagnostic.log` and `legacy-sh04-classification.json`; current `src/ui/dock/LiveDock.tsx:12`.
- **Expected behavior:** Current first Escape cancels/blurs a local token draft; second global Escape closes its popup and returns focus. Dock navigation uses the current “Session edit controls” label.
- **Actual behavior:** Identity-polish expects trigger focus after only the first Escape and fails with the popup still open. The fresh bounded public walkthrough records the popup remaining open after first Escape and closing with trigger focus after the second; local blur follows the inspected source contract. Separately, SH04 successfully closed Changes and opened More tools, then waited for the removed “Review changes” button until its 30-second global timeout. Current button is “Session edit controls”; prior Undo/Reset steps completed.
- **Probable cause:** Historical one-Escape-close assumption and stale dock label survived later interaction/copy contracts.
- **Recommended next action:** Two narrow contract-aligned test corrections in authorized maintenance, preserving both initial failures and the complete current workflow. Classification: **TEST DEFECT** for both. Neither failure demonstrated a broken product close, Undo/Reset or current popup focus-return action; no tests were changed in this audit.

### F20 — compatibility and public-store requirements are not closed

- **Category:** RELEASE.
- **Severity:** P2 public distribution gap.
- **Evidence level:** SOURCE VERIFIED current configuration; INFERRED / UNVERIFIED browser/store closure.
- **Affected workflow:** Claim supported minimum Chrome versions/platforms or ship a public store candidate.
- **Reproduction/source:** `package.json`, `wxt.config.ts`, current release contract, fresh Chrome 154.0.8037.93 browser evidence.
- **Expected behavior:** Candidate has a stated tested browser/platform range and completed applicable store/distribution materials/review.
- **Actual behavior:** Current-browser local checks are strong, but no minimum Chrome policy, lower-version matrix, full cross-platform native sampler validation or public-store/privacy/distribution closure was established.
- **Probable cause:** Local engineering phases precede distribution acceptance.
- **Recommended next action:** Define compatibility support, execute that matrix and close store/distribution requirements after scoped bugs and package gaps. Do not convert local pass totals into store readiness.

### F21 — preview demonstration branches remain in the production bundle

- **Category:** DEBT.
- **Severity:** P3.
- **Evidence level:** SOURCE VERIFIED; RUNTIME VERIFIED compiled strings.
- **Affected workflow:** Bundle size and preview/live presentation maintenance.
- **Reproduction/source:** Shared App/InspectorShell/BottomDock imports; `.output/chrome-mv3/content-scripts/content.js` contains “Fixture review” and “Example diff · no webpage edits.”
- **Expected behavior:** Preview purpose is explicit; unnecessary release bytes are measured before isolation work is justified.
- **Actual behavior:** Production `preview=false` makes demonstration branches unreachable to normal users, but shared imports preserve preview content in the 1,087,846-byte JS artifact.
- **Probable cause:** Shared runtime preview prop rather than separate presentation entrypoint graph.
- **Recommended next action:** MEDIUM optional bundle-maintenance value; quantify removable bytes and maintenance impact before entrypoint isolation. No unused-byte estimate or broken live behavior is asserted.

## Editing truth, history, output and safety assessment

**SOURCE VERIFIED; TEST VERIFIED:** ordinary writes distinguish requested value, stored override, browser computed value and conservative effectiveness. Current tests cover stronger author `!important`, supported layers, shorthands, custom/inherited properties, media and natural pseudo states, pseudo elements, open roots, disabled declarations, replacement migration, loss, Undo and Reset. Pending inactive context and incomplete evidence are not silently upgraded to certainty. F01 is a concrete exception caused by an omitted page sheet; it does not justify expanding the engine to all browser CSS semantics.

One ordered history was verified across CSS/text/structure/conditional author records. Tests cover exact mixed Undo/Reset order, host conflict retention, safe independent reset, native authority after replacement, intentional Delete avoiding reconciliation, ancestor removal/restoration and deactivation/recovery. Retained author and DOM ledgers preserve unresolved native ownership; they do not create a second public event stack. F13 documents the uncapped ordinary-history limitation.

Changes is a factual current-state view, not a durable timeline. Repeated edits, disabled/blocked/pending rows, logical migrated/unavailable targets, text/structure and recovery provenance are represented distinctly. Copy target/all and Export share deterministic enabled-session-CSS output with fresh validated selectors, nested media and pseudo suffixes, actual priority and explicit DOM/shadow/unavailable/disabled/recovery omission counts. Passing Phase 08B/09A/09B/10A coverage verifies no internal target marker, sampling metadata or DOM serialization enters CSS output. Output selector specificity/portability may differ from the active session marker; the product does not promise a page-source rewrite.

The EyeDropper is connected through shared color controls and real native platform detection, with one trusted request, unsupported/busy explanations, abort/cancel and stale result guards for target/generation/context/property/model layer/stop/value/format/lifetime. A result is one ordinary CSS gesture, including Undo/Reset/recent color/Changes/output behavior. Current deterministic platform-result and ownership cases passed. The fresh public-control walkthrough entered real native busy state and cancelled via browser-CDP Escape. Actual OS pixel selection and OS-native Escape remained **INFERRED / UNVERIFIED** for this audit because the Windows helper did not expose its disposable task Chrome; historical Phase 10A real Windows evidence is not silently promoted to current evidence.

**SOURCE VERIFIED:** no production `eval`/`Function`, unsafe HTML injection API, telemetry/analytics collection client, durable session storage or automatic DOM-upload path was found in inspected `src`/`entrypoints`. Text/structure use native methods with exact authority; CSS validation/priority separation and selector escaping constrain injection; author mutation is guarded and normal-mode dormant. CSS image URLs can cause ordinary host-browser resource requests, so this is not a blanket network-free claim. F03 is a bounded Duplicate policy discrepancy, not demonstrated arbitrary execution or exfiltration. No P0/P1 destructive/security failure was established.

## Fresh performance and lifecycle results

The heavy fixture contains 878 elements (852 light + 26 shadow), 292 CSS rules, nested layout, gradients/shadows/filters, four SVGs, two same-width targets and a 7,140px page. A particular harness census includes CSSForge hosts and uses a different active enumeration; these counts must not be conflated. Each production gesture case scheduled 240 trusted moves over four seconds, then 500ms settling at 1440 × 1100/zoom 1. The current native browser was Chrome 154.0.8037.93.

### Production edit-time observations

| Property | Simple second-RAF proxy p95 (ms) | Heavy second-RAF proxy p95 (ms) |
| --- | ---: | ---: |
| Width | 34.8 | 64.2 |
| Padding | 34.0 | 55.0 |
| Margin | 33.2 | 53.1 |
| Font size | 48.6 | 72.6 |
| Line height | 34.3 | 59.0 |
| Radius | 35.3 | 64.8 |
| Box shadow | 51.5 | 72.0 |
| Text shadow | 46.7 | 69.1 |
| Filter | 41.6 | 61.3 |
| Color | 29.3 | 36.0 |
| Gradient | 46.9 | 73.2 |

All 22 simple/heavy gesture cases passed exact final value, one transaction and ordinary Undo checks. Heavy maximum proxy was 92.3ms (font size), maximum queue 32.8ms and maximum post-gesture tail 9.2ms. Two long-task entries occurred (56ms text shadow, approximately 50ms filter); one 55.2ms slow frame occurred for text shadow. No corroborated watchdog stall or edit-acknowledgment timeout was observed. These are measured costs, not an arbitrary newly invented latency acceptance budget.

This run is less favorable than earlier Phase 10A synthetic measurements even though the fresh production JS hash matches that artifact. It does not establish a causal code regression or prove a particular environment explanation. Repeated comparable runs would be needed for a trend claim. Browser layout/paint/property-specific cost remains real; F14 separates measured architectural overhead from a confirmed product performance bug. F16 preserves the original real-page unknown.

### Scoped cascade and subscription diagnostics

The fresh ignored diagnostic copy retained current source hashes and instrumented observation only. One warm Width edit analyzed six target/ancestor properties and 133 candidates, with 4,226 expansion attempts (4,225 hits/one miss), 1,680 fresh selector matches and 1,684 specificity calls across 246 unique selector texts. The final target read used one computed-style call/43 values, four rectangles and two RAFs. One warm React commit produced 191 named render calls, including 34 numeric and four color controls. Three editor publications delivered 282 callbacks to 94 listeners; one picker publication delivered eight callbacks to eight listeners. Five warm edits yielded 30 property contributions/665 candidates and five commits, rather than a full unrelated-property cascade on every effect refresh.

Nine fresh scoped/full native CSSOM requests compared width, border, padding, font, background image, box/text shadow, filter and custom-property contributions with zero property/global-issue differences. This supplements passing current unit and 14-stage browser parity coverage. Full Code provenance inspection intentionally remains a full read.

For 120 geometry notifications with positioning closed: no computed-style/cascade/editor work, 239 rectangles, 119 picker publications/952 deliveries, 120 React commits and 32,908 named render calls. With Text color positioning open: 120 Floating updates, 11,400 computed-style calls/67,800 property reads, 840 rectangles, 120 picker publications/960 deliveries and 121 commits/33,241 named render calls. Caller attribution of computed-style calls/property reads was containing block 6,600/59,400; clipping ancestors 1,440/120; overflow 1,440/5,760; clipping viewport rectangle 720/1,080; offset parent 480/480; RTL 480/480; dimensions 240/480. Closed positioning work was zero. These observations deliberately change geometry; they are not idle-cost measurements. They support bounded ownership and a real future overhead investigation, not speculative subscription rewrites.

Current pointer-idle and pending-sampling probes passed their asserted windows: closed/nonpending paths did not accumulate RAF, resize or focus/positioning ownership. Timers and observer cleanup were separately exercised through lifecycle cases. A diagnostic run can identify where work occurs; it cannot by itself prove a user-visible slowdown.

### Memory and ownership

| Cycle | Active post-GC heap (bytes) | Inactive post-GC heap (bytes) | Cycle duration |
| --- | ---: | ---: | ---: |
| 1 | 12,382,060 | 8,777,828 | 6.408 s |
| 8 | 13,322,100 | 9,660,668 | 5.505 s |
| 16 | 13,653,804 | 10,085,564 | 5.420 s |
| 24 | 13,726,064 | 10,231,140 | 5.473 s |
| 32 | 13,892,776 | 10,329,124 | 5.492 s |

All 32 active samples reported **811 listeners/11,460 DOM nodes**; all inactive samples reported **451 listeners/7,784 nodes**. Documents, frames, resources and layout objects remained constant. Warm cycle durations stayed between 5.263 and 5.818s. Final-eight growth was much smaller than total growth, but no plateau or retained-object cause was proved. F15 therefore remains an unattributed memory observation, not a diagnosed leak.

Eight additional diagnostic ownership cycles passed, with identical owner counts in every active/inactive checkpoint. Settled active: editor one owner/94 listeners; picker one/eight; UI one/249; MutationObserver one instance/30 targets; ResizeObserver two/25; RAF/timer/Floating/Tooltip zero. Inactive: editor/picker zero owners/listeners; observers zero instances/targets; pending RAF/timer/Floating/Tooltip zero; UI one owner/one intentionally retained diagnostic meter listener. The broad diagnostic event count was 92 active/25 inactive, distinct from the browser's total listener census. This eight-cycle instrumented run also grew heap by 1,121,552 active/1,076,904 inactive bytes without attribution. Production post-GC checkpoints and isolated observer/subscriber measurements answer different questions; stable bounded ownership does not prove a heap plateau or leak absence.

## MV3, documentation and packaging

The fresh manifest is version 0.1.0/MV3 with only `activeTab` and `scripting`, a background service worker and an empty `content_scripts` list. It has no host permissions or automatic all-site injection. Dynamic UI CSS is listed as a web-accessible resource for HTTP(S); this does not grant host permission. Toolbar action/repeated activation/toggle/reinjection and unsupported-page behavior were covered by current source and fresh critical execution; recovery is document-local rather than reload persistence. No duplicate current activation ownership was established.

README and current support material generally describe Phase 08A truth, Phase 08B output, Phase 09A text, Phase 09B structure, native EyeDropper, scoped cascade optimization and unresolved hang/heap candidly. F11 is the concrete current support contradiction. The current release contract remains candid about local permissions/version/ZIP, missing icons and distribution requirements; its older verification links should later point to this audit/dashboard. `docs/current-project-audit.md` is visibly anchored to 1 October/current-ui-v1/`4f26023`; its old effect-feedback blockers were superseded, not re-confirmed. Phase 08A/08B/09A/09B/10A reports retain historical baseline and chronology. The historical Phase 10A NOT ACCEPTED paragraph is explicitly superseded within that report; chronology alone is not a new contradiction.

The freshly built ZIP is **462,814 bytes**, SHA-256 `8E7BD919B82F35D52DF7B5ED453143C7152A8679270AC9035FDBACA0980F40BE`. Its six file entries (directory entry excluded) matched the unpacked artifacts by hash:

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `background.js` | 1,513 | `ABC68F0FD71CCA82BA241A4CCEE1A10E23BE589D7FA9EF0410224F61B3FFED13` |
| `manifest.json` | 467 | `1CD2918FBFE545E25583EC26F7E12E356FB8B5BBAB9D60837BF2594D133E486F` |
| `content-scripts/content.js` | 1,087,846 | `9E6A2D8230F86C46A43762350A6BC5FFA532E41E5F6DB7284392F421B4FBBB65` |
| `content-scripts/content.css` | 91,996 | `4E54F3F57C0433F177012DD822108ED8DA6657783D815F67BEDAAEDE9C2CB8B3` |
| `THIRD-PARTY-NOTICES.txt` | 5,707 | `A3E984704F1E44E4B80EA9F3D2564F6FA94EFA030F92DEEB840D5EA557C66842` |
| `Geist-OFL.txt` | 4,383 | `C683BFBCC7E087F5D37A54EF628F10387C451A83DDC459B151403A164AC46C90` |

The production JS matches the earlier Phase 10A artifact; ZIP hashes can change with archive timestamps. Fresh package equality establishes artifact provenance, not license/store/browser certification. F09/F10/F20 remain release closure work. Nothing was published.

## Final matrices

### A. Product capability matrix — all 46 requested areas

“COMPLETE WITHIN SUPPORTED SCOPE” means the bounded exposed capability is connected and current tests cover its intended behavior, not that all CSS/browser semantics are implemented or every defect is absent. Defects and narrower boundaries are explicit in the final column.

| Area | Status | Evidence | Main remaining gap / precise boundary |
| --- | --- | --- | --- |
| Activation | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | HTTP(S) toolbar activation/top document; restricted/browser-rejected pages get feedback. Lower-version compatibility unverified. |
| Picker | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Composed picking/open roots and idle frame ownership; no closed/frame interiors or universal DevTools behavior. |
| Selection | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Native object/root/generation authority and navigation; labels are not selectors. |
| Target ownership | PARTIAL | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Intended exact authority is connected, but F02 marker-looking clone escapes containment. Cross-root/document writes remain refused. |
| Locator | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Bounded strong evidence; ambiguous/weak/wrong-root candidates refused rather than fuzzy-bound. |
| Selector generation | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Fresh escaped root-local unique output; no cross-shadow flat selector guarantee or future DOM stability promise. |
| Reconciliation | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Unique supported same-root CSS migration; text/structure authority does not rebind; late/weak replacements unavailable. |
| Design | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | 39 supported properties/shared history; F01 truth and F04 slider interaction exceptions; not all CSS/layout tooling. |
| Code | PARTIAL | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Readable CSSOM and supported session declarations/value editing/refresh; read-only keyframes; author policy dormant; F06/F07. No arbitrary source-file editor. |
| HTML | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Bounded lazy live tree/navigation, native actions and explicit refresh; no HTML source parser/editor; F05/F06/F08. |
| Navigator | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Same bounded tree/native selection in modal; F08 repeated accessible names; no unlimited page tree. |
| Changes | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Current owned net state and omission/provenance/context/effect distinctions; F01 omitted-sheet certainty; not saved event timeline. |
| Copy | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Fresh deterministic enabled target/all CSS; rejects clipboard failure and explicitly omits DOM/shadow/unavailable/author recovery. |
| Export | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Same CSS-only local Blob output/revocation; no DOM serialization, source-file save or persistence. |
| Undo | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | One latest-first domain history; conflict ownership retained, gesture grouping; no Redo. |
| Reset | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Reverse owned rollback, host changes preserved/pending recovery; cannot promise restoration after foreign authority changes. |
| Contexts/media/state | PARTIAL | SOURCE VERIFIED; TEST VERIFIED | Base/discovered media and terminal hover/focus/active/before/after; no forcing, viewport simulation or arbitrary complex context proof. |
| Typography | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Supported family/weight/size/line-height/color/alignment/spacing/decoration/case; no variable-axis/OpenType/font-assets toolkit. |
| Spacing | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Margin/padding sides and provable conversions; unsupported expressions preserved; no gap/grid/flex constraint editor. |
| Geometry | PARTIAL | SOURCE VERIFIED; TEST VERIFIED | X/Y/dimension readouts and supported width/height/radius edits; no transforms/rotation/canvas resize/layout solver. |
| Backgrounds | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Color and supported multiple image layers/type/position/size/repeat/presets; HTTP(S) URL field; no asset manager. |
| Gradients | PARTIAL | SOURCE VERIFIED; TEST VERIFIED | Supported simple linear/radial stops/colors/direction/shape/reordering; advanced hints/double stops/interpolation/unparsed shapes stay token/read-only. |
| Borders | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Shared width/style/color/radius and mixed-color replacement; no exhaustive per-side geometry toolkit. |
| Position | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Position modes/top/right/bottom/left/z-index; no anchor positioning, transform drag or automatic layout solving. |
| Shadows | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Supported box/text layers/parameters/colors/order/visibility/presets; complex unparsed syntax preserved; exact native sample layer. |
| Filters | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Blur/brightness/contrast/grayscale/hue-rotate/invert/saturate/sepia; not full SVG/drop-shadow/backdrop-filter tooling. |
| Color system | PARTIAL | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Concrete HEX/RGB/HSL/alpha/token/mixed/recent/shared consumers; F04 keyboard focus defect; no palette extraction or assets tool. |
| EyeDropper | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Native request/busy/unsupported/cancel/ownership/result gesture; actual browser/OS support varies; fresh manual native outcome recorded separately. |
| Inline text editing | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | One direct Text/eligible HTML within document/open roots, literal Apply/Cancel/Ctrl-Enter, 65,536 units; no nested/form/editable/custom/SVG or replacement rebinding. |
| DOM Insert | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Five allowlisted tags/literal text/exact gaps/shared history/bounds; no arbitrary attributes/HTML/component builder. |
| DOM Duplicate | PARTIAL | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Exact bounded native clone/history and unsafe IDs/handlers/resources refusal; F03 escaped resource spelling gap. |
| DOM Delete | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | Exact supported native owner parked/restored at safe gap; intentional loss suppresses reconciliation; unsupported/conflicted subtree refused. |
| DOM Reorder | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Same exact parent/gap, host order preserved; F05 stale-action feedback; no cross-parent drag/drop or guessed child-index restoration. |
| Safe-author engine | DORMANT | SOURCE VERIFIED; TEST VERIFIED | Guarded CSSOM inline/rule/adopted/same-origin mutation/recovery foundation; no normal policy toggle or source-file persistence. |
| Source provenance | PARTIAL | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Bounded readable CSSOM identities/context/priority/notices; F01 lookalike exclusion; no original formatting/comments/files or full imports/inaccessible sheets. |
| Cascade/effectiveness | PARTIAL | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Supported author proof/scoped contribution parity; F01; UA/user/imports/advanced logical/layer/state/shadow/container/scope/motion/substitution conservatively unresolved. |
| Shadow DOM | PARTIAL | SOURCE VERIFIED; TEST VERIFIED | Accessible open roots support picking/local CSS and eligible native HTML operations within bounds; closed interiors unavailable, host/slotted/encapsulation cascade/export incomplete. |
| Slots | PARTIAL | SOURCE VERIFIED; TEST VERIFIED | Assigned/composed navigation with correct physical roots; no full slotted cascade proof or slot structure manipulation/cross-root authority. |
| Iframe handling | PARTIAL | SOURCE VERIFIED; TEST VERIFIED | Outer frame selectable/boundary visible; no frame-interior injection/picker/edit/source/recovery bridge. |
| History | COMPLETE WITHIN SUPPORTED SCOPE | SOURCE VERIFIED; TEST VERIFIED | One ordered in-memory domain history/recovery; F13 uncapped growth; no Redo/durable timeline. |
| Persistence | MISSING | SOURCE VERIFIED | No disk saved session/reload/restart recovery. Same-document conflict ledgers and in-memory colors/flags are not durable persistence. |
| Responsive tooling | MISSING | SOURCE VERIFIED | Existing media editing is connected; no device/viewport simulator, breakpoint manager or dedicated responsive controller. |
| Measurement/rulers | PARTIAL | SOURCE VERIFIED; TEST VERIFIED | Real dimension readout/overlay; no ruler/distance/guides/interactive measurement controller. |
| Pseudo-state forcing | MISSING | SOURCE VERIFIED | Existing natural-state contexts do not force browser state/create pseudo content; no shipped forcing controller. |
| Assets | MISSING | SOURCE VERIFIED | URL entry/presets and app assets exist; no user inventory/upload/library/search/extraction/storage flow. |
| Animation tooling | MISSING | SOURCE VERIFIED | Referenced keyframes are readable only; no timeline/keyframe authoring/playback/scrub/interpolation tool. |

### B. Confirmed current product defect list

Release gaps and unverified risks are deliberately excluded from this runtime defect matrix; they remain in the 21-finding inventory.

| ID | Severity | Area | Short description | Recommended phase |
| --- | --- | --- | --- | --- |
| F01 | P2 | Sources/effectiveness | Page-marked author sheet omitted, giving false “applied/wins” certainty. | Scoped ownership/truth correction first. |
| F02 | P2 | Target containment | Marker-looking host clone retains original override marker. | Same proven-ownership predicate correction. |
| F03 | P2 | Duplicate policy | Escaped CSS URL bypasses resource-style refusal. | Scoped native structure policy correction. |
| F04 | P2 | Keyboard color | Consumed slider keys move focus to popup buttons. | Current workflow/a11y correction. |
| F05 | P2 | Structure feedback | Exact-gap refusal is silent on HTML after menu closes. | Current workflow/feedback correction. |
| F06 | P3 | Empty states | Code/HTML incorrectly say unconnected before selection. | Scoped copy correction. |
| F07 | P3 | Code validation | Invalid fields lack association; unsupported property message conflates causes. | Field accessibility correction. |
| F08 | P3 | Tree naming | Repeated tree rows have identical compact accessible names. | Bounded tree a11y correction. |

### C. Disconnected/dormant implementation list

| Feature/code | Current state | Why not normally reachable / actual caller | Keep / remove / future candidate |
| --- | --- | --- | --- |
| Safe-author policy and author edit branches | DORMANT BY DESIGN | SESSION_OVERRIDE default; no normal production policy setter. Guarded test/programmatic policy activates branches. | Keep foundation; separate future authorization/provenance UX before exposure. |
| Author recovery/source rows | CONNECTED, conditional | Retained records can be reviewed/rolled back; ordinary UI cannot initiate author writes. | Keep safety; exclude from CSS output. |
| `activeDockTool` derivation | ORPHANED / DEAD consumption | Production writes but no reader; current UI uses surface/activePopover. | LOW-value later cleanup, F12. |
| Fixture Design/Code/HTML/Navigator/Changes/BottomDock | DORMANT BY DESIGN in extension; CONNECTED preview | Content mounts `preview=false`; `src/preview.tsx` explicitly mounts preview. | Keep demonstration; optional measured entrypoint isolation, F21. |
| Fixture palette/background/eyedropper dock text | HISTORICAL demonstration | FixtureDock only; live sampler is in actual color controls. | Refresh preview copy later; no live disconnection. |
| selectedFixture* / previewPaused | DORMANT BY DESIGN live; CONNECTED preview | Demonstration consumers only, no durable storage. | Keep/isolate later; LOW priority. |
| Picker stats/native getters/diagnostic wrappers | TEST-ONLY-facing APIs; core CONNECTED | Harness observation/validation; no shipped global controller bridge. | Keep bounded observability or narrow later; not dead engines. |
| Selector/locator public validation wrappers | TEST-ONLY-facing | Tests call wrappers; underlying production engine used by output/reconciliation. | Keep or narrow later; LOW value. |
| Navigator/Changes/Text/Insert surface variants | CONNECTED | Actual live buttons/menu and surface dispatch. | Keep; no unreachable dialog established. |
| Measurement dock info | PARTIALLY CONNECTED | Real dimension information; no richer interactive backend. | Keep honest readout; richer toolkit is missing. |
| Context model | CONNECTED within partial scope | Existing media/state discovery and edit controller; no simulator/forcing backend. | Keep limits; future tooling needs implementation. |
| Native EyeDropper | CONNECTED | Shared color popup request and ordinary history. | Keep; no dock/custom fallback needed. |
| Helpers externally imported only by tests | CONNECTED internally | Several exported helpers execute inside their own live modules. | Do not delete solely from external caller search. |
| Internal phase-06/Phase01/fixtureNote naming | HISTORICAL nomenclature in connected code | Old names, not feature flags. | Ignore or LOW cosmetic cleanup later. |
| Phase reports/reference screenshots | HISTORICAL | Outside production release entrypoints/assets. | Preserve; prioritize new current dashboard. |

No unreachable production module, abandoned full measurement engine, dormant persistence system, responsive controller, asset manager or animation authoring backend was established. Import reachability is not branch reachability; the explicit classifications above retain that distinction.

### D. Technical debt list

| Item | Risk | Evidence | Fix now / later / ignore |
| --- | --- | --- | --- |
| Attribute-only internal ownership predicates (F01/F02) | Narrow real truth/containment defects. | SOURCE VERIFIED; RUNTIME VERIFIED | Next correctness phase; HIGH value. |
| Raw CSS resource spelling predicate (F03) | Real Duplicate safety-policy mismatch. | SOURCE VERIFIED; RUNTIME VERIFIED | Same scoped correctness work; HIGH value. |
| Ordinary history/projection growth (F13) | Unbounded retained events/scans; impact unmeasured. | SOURCE VERIFIED; INFERRED / UNVERIFIED | Measure long sessions first; later. |
| Broad subscribed mounted controls (F14) | Measured architectural fanout; user impact not proved. | RUNTIME VERIFIED | Budget/compare first; later, no blanket rewrite. |
| Preview imports in release (F21) | Bundle/maintenance overhead, removable bytes unknown. | SOURCE VERIFIED; RUNTIME VERIFIED | Optional MEDIUM measured cleanup later. |
| Write-only dock state (F12) | Redundant bookkeeping/test maintenance. | SOURCE VERIFIED | LOW cleanup later. |
| Collector/gate separation (F17) | Green execution can conceal recorded mismatches. | SOURCE VERIFIED | HIGH test clarity value; scoped maintenance. |
| Historical comparison coupling (F18) | Current gate depends on old tracked improvement/declaration baseline semantics. | SOURCE VERIFIED; TEST VERIFIED | Separate historical comparisons/current invariants. |
| Font Escape / dock-label assertion drift (F19) | Two preserved failed supplemental cases. | SOURCE VERIFIED; TEST VERIFIED; RUNTIME VERIFIED | Narrow contract-aligned test maintenance. |
| Stale current contract/navigation (F11) | Users read contradictory support/current evidence links. | SOURCE VERIFIED; DOCUMENTATION ONLY | Small docs correction after audit. |
| Old internal naming/cycles | No current correctness consequence established. | SOURCE VERIFIED | Ignore/LOW cleanup; no mass deletion/refactor. |

No global dead-CSS certificate is claimed; dynamically composed selectors and preview/live branches require more than a text search. No source cleanup was performed.

### E. UX/accessibility list

| Surface | Issue / current protection | Severity | Evidence |
| --- | --- | --- | --- |
| Color popover | F04 repeated slider-key focus loss. | P2 | SOURCE VERIFIED; RUNTIME VERIFIED |
| HTML structure menu | F05 invisible exact-gap conflict refusal. | P2 | SOURCE VERIFIED; RUNTIME VERIFIED |
| No-selection Code/HTML | F06 misleading disconnected copy. | P3 | SOURCE VERIFIED; RUNTIME VERIFIED |
| Code declaration form | F07 invalid/error associations and cause wording. | P3 | SOURCE VERIFIED; RUNTIME VERIFIED |
| HTML/Navigator | F08 compact repeated accessible names omit visible distinction. | P3 | SOURCE VERIFIED; RUNTIME VERIFIED |
| Tabs/tree/modal/popover/drag | Passing current keyboard/focus/viewport contracts; no general certification. | Supported protection | SOURCE VERIFIED; TEST VERIFIED |
| Native sample button/status | Busy/unsupported/cancel/result ownership tested; actual OS separate. | Supported protection | SOURCE VERIFIED; TEST VERIFIED |
| IME / screen reader / status announcement experience | Some local composition-handler asymmetry and non-live effect text are source observations; practical outcome not tested. | Unnumbered coverage boundary, no confirmed defect | SOURCE VERIFIED; INFERRED / UNVERIFIED |
| Full contrast/forced-colors certification | Reduced motion/forced-color rules present; complete certification not performed. | Coverage boundary | SOURCE VERIFIED; INFERRED / UNVERIFIED |

### F. Performance/memory list

| Finding | Classification | Measured evidence | Action |
| --- | --- | --- | --- |
| Property-scoped effectiveness | PROPERTY-SPECIFIC COST; verified improvement boundary | Six properties/133 candidates per warm Width, scoped/full parity zero differences; current native/unit assertions pass. | Preserve semantic equivalence and fresh matching; do not regress to unrelated full property analysis. |
| Heavy edit latency | EXPECTED BROWSER COST / PROPERTY-SPECIFIC COST | Heavy p95 proxy 36.0–73.2ms across properties, max 92.3ms; exact final values/one gesture/Undo pass, no stall timeout. | Repeat comparable measurements before trend/budget conclusions. |
| Broad control/subscription fanout (F14) | ARCHITECTURAL OVERHEAD | 191 named renders/one warm commit; 282 editor deliveries; geometry-only broad renders. | Measure user-visible impact before refactor. |
| Open Floating calculations (F14) | EXPECTED BROWSER COST plus architectural positioning overhead | 11,400 computed-style calls/67,800 reads over 120 open geometry updates; zero closed positioning. | Profile representative popover behavior; preserve closed/pending cleanup. |
| Original multi-second stall (F16) | UNVERIFIED | Exact real-page scenario absent; fresh watchdog/synthetic cases pass. | Capture original scenario/profile, do not claim fixed. |
| 32-cycle heap growth (F15) | UNVERIFIED attribution; observed growth | +1.51/+1.55MB; final-eight +122/105KB; stable listeners/nodes/browser ownership. | Retainer snapshots if materially relevant; no leak label yet. |
| Lifecycle counters | Supported cleanup verified | 32 production cycles pass; eight diagnostic ownership cycles pass; constant active/inactive node/listener census. | Maintain current assertions; counts do not prove all data lifetime. |
| Ordinary history (F13) | ARCHITECTURAL OVERHEAD risk | Source uncapped array/full current projection; scaling not measured. | Representative long-session measurement before caps/incremental work. |
| Confirmed new performance bug | None established | Some measured costs remain, but no current bounded case identifies a new stall/incorrect final edit. | No speculative optimization in audit. |

### G. Release readiness

| Area | Current state | Evidence / closure required |
| --- | --- | --- |
| Engineering | **LOCAL ENGINEERING READY, with known scoped P2/P3 defects** | Fresh typecheck/unit/build/ZIP/main 482-case gate pass; two failed stale supplemental assertions preserved; eight audit defects require scoped corrections. This is not bug-free or public acceptance. |
| Documentation | **PARTIAL** | New dashboard/audit establish current facts; F11 contradiction and older verification-navigation remain for later maintenance; historical reports preserved. |
| Packaging | **LOCAL ZIP VERIFIED; PUBLIC PACKAGE INCOMPLETE** | Six artifact hash matches, minimal permissions/version0.1.0; F09 notices and F10 approved icons missing. |
| Compatibility | **NOT VERIFIED beyond executed current environment** | Chrome154/Windows local current suite evidence; minimum/lower versions/platform/native matrices, IME/SR certification not established. |
| Store/distribution | **NOT PUBLIC STORE READY** | F09/F10/F20 closure and scoped defects precede public candidate; no publication, review or legal/privacy certification claimed. |

### H. Dependency-ordered next work roadmap

| Order | Concrete work | Dependency / product value | Acceptance evidence needed |
| --- | --- | --- | --- |
| 1 | Scoped proven-ownership/resource-policy correction for F01/F02/F03. | Actual current truth/containment/safety-policy defects; preserve existing conservative authority. | Public marked-sheet/marked-clone/escaped-URL regressions plus current truth/target/09B/parity/history gates. |
| 2 | Current workflow/a11y correction for F04/F05, then F06/F07/F08. | Makes existing supported controls operable and refusals visible before new tools. | Repeated slider-key focus, stale structure feedback, empty state, field association, bounded tree naming plus focus/narrow/zoom tests. |
| 3 | Scoped test/documentation maintenance F17/F18/F19/F11. | Trustworthy portable gates/current contract before distribution claims. | Separate collector outputs, portable current invariants, complete Escape contract and accurate supported boundaries; preserve first failure/history. |
| 4 | Release closure F09/F10/F20. | Needed to turn verified local build into a reviewable public candidate. | Actual bundled license-notice inventory, approved icons in ZIP, stated tested browser/platform policy and store/privacy/distribution review. |
| 5 | Targeted residual investigations F16/F15/F13/F14. | Exact stall capture/retainers/long-session budgets must precede broad refactors or caps. | Original-page profile, comparative retainers, representative long-history/active-popover budget evidence and preserved correctness. |
| 6 | Optional measured cleanup F21/F12. | Maintenance/bundle value after defects/gates/release; LOW/MEDIUM, no user workflow dependency. | Quantified bundle impact and verified absence of consumers; no mass cleanup. |
| 7 | Product planning for currently missing tooling. | Responsive/measurement/pseudo/assets/animation/persistence require actual implementation and a user-priority decision; source does not contain hidden finished tools. | Define supported user workflow and authority/measurement/performance dependencies before choosing a phase. No taste-based ranking or feature work is authorized by this audit. |

## Walkthrough and final repository accounting

The bounded walkthrough used the fresh extension in disposable Chrome 154.0.8037.93 and actual public controls. Evidence is in `.preview/post-10a-audit/walkthrough.json` and the captured CSS-only `walkthrough-export.css`:

| Fixture / state | Current walkthrough observation |
| --- | --- |
| Ordinary fixture | Activate/pick, Design font size 24px, Code radius20px, HTML/text Apply, literal button Insert, Duplicate, Reorder, Delete, Changes, Copy/Export, Undo/Reset, inspector hide/show and deactivate/reactivate completed. Output contained only the two enabled CSS declarations for `#checkout`, with priority; DOM text/new buttons were omitted. |
| Target replacement | A uniquely supported `button#checkout.primary` replacement remained selected and computed font size22px; no authority was inferred from an unsupported native draft. |
| Keyboard font popup | The recorded popup remained open after first Escape; second closed it and restored trigger focus. Source verifies local token cancellation/blur ownership. F19 is test contract drift. |
| Open ShadowRoot | Actual eligible direct Text edit through public UI yielded “Open shadow audited”; Undo restored it. This confirms the supported open-root native text boundary, not all shadow semantics. |
| Hostile/top-layer fixture | Transformed/high-z host allowed Measurement popover interaction; 268×85.59375 box stayed within 1440×900 with no recorded overflow. The separate current shell SH06 assertions passed. |
| Heavy fixture | Selected actual `p.feature-copy` descendant received six public CSS edits; narrow Changes showed six enabled owned declarations and zero DOM rows, with truthful unverified-context explanations where applicable. Undo/Reset completed. |
| 390/320 CSS widths | Color popup268×401 fit with recorded overflow0; 320 text dialog281×454.875, structure dialog281×588.28125, Navigator281×750 and heavy Changes281×805 fit. Bounded fitting is not certification of every possible long document/value. |
| Native Chrome200% zoom | CSS viewport720×450; color popup268×230.5 fit with overflow0. Automated critical coverage separately exercises native zoom. |
| Native sampler | Trusted public Sample entered native busy state; browser-CDP Escape cancelled. Fresh OS-native pixel choice/Escape unverified: Windows task helper did not expose this disposable audit Chrome. No user-owned Chrome was acted on. Historical real Windows pixel/Escape evidence remains historical. |

The live walkthrough found no additional P0/P1 or new numbered issue beyond the separately recorded probes. F01–F08 remain current defects despite ordinary-fixture success. No cosmetic screenshot was used as proof of functional correctness.

The authoritative starting tree was clean. Final audit Git state is **68 modified tracked historical PNG/JSON artifacts plus the two new untracked requested documents**, all on the unchanged `main`/`phase-10a` HEAD. These are test-output side effects: current-ui-visual-polish22, hierarchy6, typography3, background5, shadow6, filters3, identity7, shell14 and structural2. Their exact paths are recorded in `.preview/post-10a-audit/measurement-closure.json`; `git status --short` was inspected. The existing supplemental suites hardcode these output locations. User instructions prohibited restore/discard, so no artifact was reset or removed to fabricate a clean final tree.

Intentional document changes are only `docs/post-10a-full-project-audit.md` and `docs/CURRENT-STATE.md`. Production source, dependency manifests/lockfile, configuration and repository test source remain unchanged. Ignored evidence remains under `.preview/post-10a-audit`; fresh edit-time harness output is under `.preview/edit-time-performance`. No fixes, feature development, commit, push, tag mutation or publication occurred.

Final read-only checks confirmed unchanged HEAD/origin/tag, empty source/test/config/current-contract/README diffs and unchanged final ZIP/JS/CSS hashes. `git diff --check` returned zero (line-ending warnings only). The audit-owned disposable browser context was closed and the audit-owned fixture server was stopped; user-owned browser windows were left alone. The audit stops here.
