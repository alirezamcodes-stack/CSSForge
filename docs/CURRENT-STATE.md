# CSSForge current state

Audited **2026-10-03**, Europe/Berlin; updated **2026-10-04** for Phase 10B.4. This dashboard records current status; [the detailed audit](post-10a-full-project-audit.md) remains the unchanged pre-fix record. Earlier phase reports remain historical evidence.

## Baseline and health

- Phase 10B.4 baseline verified clean: `fix/phase-10b-ux-a11y`, HEAD/main/`origin/main` **`dfc3c406ee89777b8f855183c74dbe753504d710`**, `fix: harden interaction and refusal feedback`. F01–F05 hardening is merged in this baseline; Phase 10B.4 changes remain uncommitted on this branch.
- Protected `phase-10a` remains **`ad32eedf81f051a7f5ac3508e2d6a7c243f37b1e`**; `pre-phase-10b` remains **`c6638691b9972081f0ddfc559e4515d327404276`**.
- The selected-element editing foundation works in its supported scope. F01–F08 are fixed in the current working tree. Phase 10B is not declared complete: Phase 10B.5 test/docs maintenance remains pending. No P0 or P1 finding was established in the audit.
- The pre-fix report inventories **21 findings: P0 0 / P1 0 / P2 9 / P3 12**. This includes release gaps, debt and unverified risks; it is not a count of 21 confirmed product bugs.
- Phase 10B.4 changes only Code/HTML no-selection copy, Add Declaration validation/accessibility, shared tree accessible naming, focused tests and this dashboard. Existing mutation guards, history, targeting, ownership, resource policy and native sampler code remain unchanged. No dependency/configuration or release change was made.

## Implemented foundation

Phase 07.x source/cascade/targeting/reconciliation and guarded author-engine foundations; current UI fixes; 08A editing truth and draft safety; 08B detailed Changes and CSS copy/export; 09A exact native text editing; 09B bounded native structure operations; 10A native EyeDropper ownership and property-scoped effectiveness/performance work are present in current source.

The live extension provides explicit toolbar activation, picking, Design controls for 39 supported properties, readable Code inspection/editing, HTML/Navigator trees, media/pseudo inspection contexts, detailed Changes, Copy target/all CSS and CSS export. CSS, accepted native samples, text, Insert, Duplicate, Delete and Reorder share one ordered Undo/Reset history. Accessible open ShadowRoot interiors support eligible edits within the same safety bounds.

## Supported limits

- Chrome MV3, explicit top-document HTTP(S) activation; permissions are `activeTab` and `scripting`. No automatic all-site content scripts or host permissions.
- Conservative readable-author cascade, not the complete browser cascade. Requested overrides, computed values, blocked/pending/unverified effects are separate. Inaccessible sources and unsupported semantics restrict certainty.
- Closed ShadowRoot interiors and iframe interiors are unsupported. Slot navigation does not grant cross-root mutation authority. Shadow changes cannot be represented by flat document CSS export.
- Text edits require one exact direct Text node on an eligible HTML element. Structure operations use allowlisted native elements, bounded subtrees and exact parent/sibling authority. Unsafe rollback preserves host changes and retains recovery records.
- Media/state context selection does not force browser state or simulate viewport size. Export contains representable enabled session CSS; DOM operations, unavailable/shadow targets and source-recovery records are explicitly omitted.
- No durable sessions, reload persistence or Redo. Ordinary transaction history has no size cap.

## Audit product findings and current status

| ID | Audit severity | Current status / defect |
| --- | --- | --- |
| F01 | P2 | **Fixed by Phase 10B.1.** Attribute-only stylesheet exclusion caused false “Applied” feedback despite a stronger author rule; exact live layer identity now retains page-owned lookalike author CSS and truthful effects. |
| F02 | P2 | **Fixed by Phase 10B.1.** A marked host clone bypassed containment and inherited the original override; exact live layer identity now permits copied-marker sanitation on page-owned clones and wrappers. |
| F03 | P2 | **Fixed by Phase 10B.2.** Raw spelling missed browser-valid escaped URL functions; accepted inline URL-function tokens now receive consistent whole-Duplicate refusal, including custom values and fallbacks. |
| F04 | P2 | **Fixed by Phase 10B.3.** Popover respects consumed events and interactive descendants; repeated slider arrows retain focus, and unhandled Home/End no longer move it to popup buttons. |
| F05 | P2 | **Fixed by Phase 10B.3.** HTML/tree renders the existing session refusal after menu closure; stale exact-gap moves preserve host order/history and fresh valid actions clear the error normally. |
| F06 | P3 | **Fixed by Phase 10B.4.** Code/HTML identify selection as the prerequisite; public selection, native Delete deselection and selection recovery show the correct surface without reactivation. |
| F07 | P3 | **Fixed by Phase 10B.4.** Unsupported properties and invalid values have separate field errors, stable unique descriptions and invalid-state semantics; correction clears obsolete associations and valid Apply/Undo retains the existing transaction path. |
| F08 | P3 | **Fixed by Phase 10B.4.** HTML/Navigator names include the bounded visible tag/ID/classes, boundary and normalized direct-text preview; visible distinctions survive without hidden identity or descendant traversal. |

The detailed report preserves the original runtime findings and source causes. F01–F03 also existed in the earlier 09B source and were not attributed to 10A. F06–F08 are now fixed in the current working tree; the historical report remains unchanged. Phase 10B.1 shares the existing WeakSet across ownership consumers and revokes layer identity on replacement, Reset, teardown and failed insertion; layer attributes remain metadata.

Phase 10B.2 uses detached native CSSOM for accepted declarations, the existing CSS parser for function tokens, and a native grammar probe for escaped names. No source style is rewritten. The existing conservative refusal includes unused custom-property URL tokens and inline `var()` fallbacks; quoted text/comments and browser-ignored declarations are inert. Referenced variables, stylesheet/inherited resources and other resource-function policies are not newly inspected. No computed-style/layout reads, network feature, new observers/subscriptions/RAF loops or persistent caches were added.

Phase 10B.3 keeps react-colorful's existing keyboard semantics: spectrum changes on all arrows; hue/alpha consume vertical arrows without changing their value; Home/End are unhandled and leave slider focus/value intact. Generic popup button navigation, caret keys, Tab, pointer/formats/alpha/recent colors, popup Escape/focus return and sampling Escape priority passed runtime checks. Refusal presentation reuses LiveDOMTree's existing editor snapshot and alert pattern, with a narrow menu-open boolean selector to avoid duplicate HTML/menu alerts. It adds no error store, editor subscription, mutation authority, retry, global listener, observer or RAF loop.

## Performance, memory and remaining uncertainty

Phase 10B.4 reuses the existing property whitelist, value normalizer/validator and native CSS.supports before the unchanged applyBatch authority. CSS-valid execution refusals remain form errors rather than invalid CSS fields. Field errors retain the existing alert pattern and drafts, with stable useId descriptions that clear on correction. Tree naming reads only existing row fields: ID/classes are already bounded to 100 characters each and direct text to 80; genuine identical rows keep identical names. Shared HTML/Navigator selection and keyboard behavior passed real-extension checks. No new observer, scan, polling, RAF, store, global listener, computed-style work or editable property was introduced.

The measurements below remain pre-fix audit evidence. Phase 10B.1 adds constant-time identity lookup without new scans, observers, persistent subscriptions or RAF loops. Current scoped-cascade, hot-path and eight-cycle teardown guards passed; listener/context-observer counts stayed flat. This does not resolve the audit's hang or heap uncertainty.

Fresh simple/heavy edit workloads completed with correct final values and ordinary Undo. Heavy p95 input-to-second-RAF proxies ranged **36.0–73.2 ms**, with a **92.3 ms** maximum; no corroborated multi-second stall. These are paint-opportunity proxies, not pixel-presentation measurements. The original real-page hang remains **unreproduced and unresolved**.

Current diagnostics confirm property-scoped cascade correctness and no unrelated-property effectiveness analysis. Broad Design render/subscriber work remains measurable. During 120 geometry updates, an open color popup caused **11,400 computed-style calls / 67,800 property reads**; closed positioning work was zero. Optimization is not justified solely by these counts.

Across **32 fresh lifecycle cycles**, active/inactive listener and DOM counts stayed flat; post-GC heap grew **1,510,716 / 1,551,296 bytes**, slowing to **122,312 / 105,124 bytes** over the final eight cycles. Fresh diagnostic cycles released editor/picker/observer/RAF/timer ownership. Heap growth remains unattributed; a memory leak or plateau has not been established.

Native sampler ownership/cancellation tests pass. The current walkthrough exercised trusted native request/busy state and browser-dispatched Escape cancellation. Fresh OS-native pixel selection/Escape could not be performed because the Windows helper did not expose the disposable audit window; prior actual Windows evidence remains historical. Lower Chrome versions, other browser/platform behavior, assistive technology and IME behavior are not certified.

## Dormant, disconnected and missing

- **DORMANT BY DESIGN:** safe-author mutation policy/engine; ordinary UI stays in session-override mode. Preview demonstration components/state are connected to the preview rather than exposed as live tools.
- **ORPHANED / DEAD consumption:** `activeDockTool` is written but has no production reader; low-value cleanup.
- **PARTIAL:** Measurement tools currently show selected dimensions. Full rulers/distances are missing. Source-derived media contexts are connected; a responsive tool is missing.
- **MISSING:** persistence/Redo, viewport/device tooling, pseudo-state forcing, asset management and animation authoring. Read-only keyframe inspection and background URL editing do not provide those tools.

## Verification and release

Phase 10B.4 added nine real-extension cases: two truthful Code/HTML empty-state and native deselection/recovery workflows, five property/value/accessibility/keyboard/normalization/refusal workflows, and two shared HTML/Navigator naming/selection workflows. These include third-class and long-ID distinctions, bounded direct text, whitespace, identical rows, deterministic refresh and click/Enter/Space target alignment. F04/F05, 09B, 10A, ownership and resource-policy guards passed in the final relevant gate with zero retries.

| Phase 10B.4 check | Passed / failed / skipped; duration |
| --- | --- |
| Final focused plus directly related browser / existing units | 16/0/0, 39.9 s (9 new plus 7 existing); 72/0/0 across 4 files, 1.77 s |
| Final `pnpm typecheck`, `pnpm test`, `pnpm build` | Typecheck passed (7.678 s command); 415/0/0 across 25 files, 3.32 s; build passed, 5.197 s |
| Final relevant browser gate | 175/0/0, 6.8 min (411.598 s command) |
| Current critical gate plus F06/F07/F08 cases | **537/2/0, 18.1 min (1084.512 s command)**; same 3 historical screenshot-only cases deselected |
| Single unchanged UI03 raster diagnostic | 1/0/0, 6.1 s (7.195 s command); separate from the failed critical gate |
| Single unchanged preview modal-focus diagnostic | 1/0/0, 4.0 s (5.037 s command); separate from the failed critical gate |

Pre-fix controls reproduced all three expected **PRODUCT DEFECTS** (0/3/0; case durations 6.4/6.6/6.3 s). The initial focused run passed 9/0/0 in 20.0 s and the initial relevant gate passed 175/0/0 in 6.6 min. Source review then strengthened F08 coverage for extra visible classes/long IDs: its first run reproduced one **PRODUCT DEFECT** (0/1/0; 6.8 s case), because the interim compact identity still dropped a visible third class. Expectations were retained; the shared UI name builder now uses the actual bounded visible ID/class fields. The final focused/direct and relevant runs above include this stronger coverage. All first logs/traces are preserved separately under `.preview/phase-10b-ux-a11y/`; no test expectation was loosened. Accessible names/descriptions and keyboard behavior were verified in real Chrome, without actual screen-reader/IME/older-browser certification. Existing hang, heap, native OS sampling and raster uncertainties remain as described below.

Both critical failures are classified **FLAKE**, with their causes unresolved. UI03-normal's Changes comparison has the exact same two PNG hashes and 15 gray text-pixel differences (maximum channel delta 46 versus limit 1, alpha unchanged) as the Phase 10B.1/10B.2 UI03 and Phase 10B.3 P2 failures; narrow/zoom200 and P2 passed in this gate, and the unchanged isolated UI03 diagnostic passed. The second failure was the existing preview menu-to-Changes Tab-containment assertion at `interactions.spec.ts:132` (824 ms case): the immediate ShadowRoot activeElement containment check returned false before any Navigator steps. That unchanged case passed the final relevant run, prior B1/B2/B3 critical gates, and one isolated diagnostic. Surface/FloatingFocusManager and fixture Changes code are untouched; no timing fix or test rewrite was made. First traces/error contexts/logs, raster PNG/JSON and all four phases' hash comparison are preserved. The full critical gate remains **failed**, irrespective of the diagnostics. All nine F06–F08 cases, eight F04/F05 cases, 22 ownership cases and 18 resource-policy cases passed in it; lifecycle/performance guards also passed.

Phase 10B.3 added eight real-extension cases: five keyboard/shared-color checks and three HTML/Design/Code stale-Move workflows. Refused operations add zero structural writes/history; fresh Move succeeds and Undo restores the exact host order. All new cases and relevant guards passed with zero browser retries.

| Phase 10B.3 check | Passed / failed / skipped; duration |
| --- | --- |
| Focused browser / existing units | 8/0/0, 17.7 s; 56/0/0 across 3 files, 1.09 s |
| `pnpm typecheck`, `pnpm test`, `pnpm build` | Typecheck passed (6.877 s command); 415/0/0 across 25 files, 2.58 s; build passed, 5.487 s |
| Relevant browser gate | 166/0/0, 6.8 min |
| Current critical gate plus F04/F05 cases | **529/1/0, 22.0 min**; same 3 historical screenshot-only cases deselected |
| Single unchanged P2 raster diagnostic | 1/0/0, 8.7 s; separate from the failed critical gate |

Pre-fix controls reproduced both expected **PRODUCT DEFECTS** (0/2/0; case durations 6.8/6.4 s). First patched focused run was 6/2/0 in 17.1 s: **TEST DEFECT**, the new Design/Code Undo locator matched existing menu and panel controls after refusal/success assertions had passed. Only that new locator was scoped to the menu; the corrected run passed. First logs/traces are preserved under `.preview/phase-10b-interaction/`.

The sole critical failure is the known shared Changes raster **FLAKE**, this time in `current-ui-p2`'s opaque-UI comparison. Its 15 gray text-pixel differences (maximum channel delta 46 versus limit 1) and both PNG hashes exactly match prior Phase 10B.1/10B.2 UI03 failures. UI03-normal/narrow/zoom200 passed in this gate; the P2 comparison passed both the relevant run and one unchanged isolated diagnostic. The suite-context/raster cause remains unresolved and the full gate remains failed. First PNG/JSON/trace/logs and hash comparison are preserved; no tolerance/rendering change was made. All eight new cases, 22 ownership cases and 18 resource-policy cases passed in the critical gate; eight lifecycle cycles retained flat listener/context-observer counts.

Phase 10B.2 added 18 unit regressions and 18 real-extension cases. All 18 new browser cases and all 22 Phase 10B.1 ownership cases passed in focused/relevant coverage as applicable and in the critical gate. Browser retries were zero.

| Phase 10B.2 check | Passed / failed / skipped; duration |
| --- | --- |
| Focused units / browser cases | 54/0/0 across 3 files, 775 ms; 18/0/0, 35.4 s |
| `pnpm typecheck`, `pnpm test`, `pnpm build` | Typecheck passed; 415/0/0 across 25 files, 2.40 s; build passed, 5.463 s |
| Relevant browser gate | 177/0/0, 5.4 min |
| Current critical gate plus F03 cases | **521/1/0, 21.8 min**; same 3 historical screenshot-only cases deselected |
| Single unchanged UI03 diagnostic | 1/0/0, 6.0 s; separate from the failed critical gate |

Pre-fix controls produced 2/1/0 in 13.7 s: expected **PRODUCT DEFECT**, the native accepted audit escape left Duplicate enabled while ordinary/unused-custom URLs were refused. The only patched critical failure is the known UI03-normal **FLAKE**: its 15 gray text-pixel differences and both PNGs exactly match Phase 10B.1; the unchanged diagnostic passed. Its suite-context/raster cause remains unresolved, and the critical gate remains recorded as failed. First logs/traces/PNG/JSON are preserved under `.preview/phase-10b-resource-policy/`; no UI tolerance or rendering change was made.

Historical Phase 10B.1 verification used zero browser retries. Three unit regressions and 22 real-extension ownership cases were added; the new cases passed in both relevant and critical runs.

| Phase 10B.1 check | Result |
| --- | --- |
| Focused unit / corrected shadow checks | 32/0/0 in 677 ms; 3/0/0 in 9.5 s (passed/failed/skipped) |
| `pnpm typecheck`, `pnpm test`, `pnpm build` | Typecheck passed; 397/0/0 across 24 files in 2.23 s; production build passed in 5.025 s |
| Relevant browser gate | 180/0/0 in 5.7 min |
| Full audit critical gate plus new cases | **503/1/0 in 21.5 min**; same 3 historical screenshot-only cases deselected |
| Single unchanged UI03 diagnostic | 1/0/0 in 9.8 s; separate from the failed critical gate |

The critical failure is classified **FLAKE**: UI03-normal's Changes comparison differed in 15 gray text pixels (maximum channel delta 46 versus limit 1), without visible red feedback bleed; its unchanged diagnostic passed. The full gate remains recorded as failed. First focused browser attempt was 19/3/0 in 1.1 min: **TEST DEFECT**, new shadow assertions demanded blocked certainty where ordinary and marked controls correctly returned existing unverified evidence. Only those new assertions were corrected. Pre-fix characterization reproduced two expected product failures (0/2/0); an initial sandboxed unit command hit executable-shim resolution (**ENVIRONMENT**), then the installed CLI passed. First logs/traces are preserved under `.preview/phase-10b-ownership/`. No UI tolerance or rendering change was made.

The following release/package checks are the **historical pre-fix audit results**, not a new Phase 10B.1 package certification:

| Check | Fresh result |
| --- | --- |
| `pnpm typecheck` | Passed |
| `pnpm test` | 394 passed / 24 files; 0 failed, 0 skipped |
| `pnpm build`, then `pnpm zip` | Both passed |
| Critical current browser run, retries 0 | 482 passed; 0 failed, 0 skipped; 3 historical screenshot-only cases deselected |
| Supplemental legacy functional run, retries 0 | 8 passed / 1 failed / 0 skipped; **TEST DEFECT / contract drift**: font-popup assertion expects dismissal on first Escape; the current two-Escape workflow was verified |
| Legacy shell/structural run, retries 0 | 8 passed / 1 failed / 0 skipped; **TEST DEFECT / stale-label contract drift**: SH04 waits for “Review changes,” currently named “Session edit controls”; structural case passed |
| Private observation probes | 8 completed; findings recorded rather than treated as correctness passes |
| Extended lifecycle / diagnostic ownership | One 32-cycle case and one 8-cycle case passed separately |
| Package integrity | All 6 file entries matched unpacked output; ZIP 462,814 bytes |

The earlier interrupted supplemental attempt is preserved separately; it is not merged into a clean run. The detailed report provides logs, first-failure evidence, workload measurements and hashes.

**Focused, unit, build and relevant checks pass; the current critical gate remains failed and unresolved risks remain recorded. Public distribution is not ready:** bundled dependency notices are incomplete, approved release icons are missing, and minimum/support Chrome policy, compatibility and store/disclosure checks remain open. Version is `0.1.0`; nothing was published.

## Dependency-ordered next work

1. Review the uncommitted Phase 10B.4 F06/F07/F08 correction; F01–F05 are already merged in the current baseline. Preserve existing mutation/rollback safety.
2. Phase 10B.5 remains pending separately authorized work: repair stale test contracts and distinguish assertion gates from diagnostic collectors; keep first-failure history and separate generated evidence from historical captures. Phase 10B is not complete.
3. Complete release notices, icons, current support documentation and a tested compatibility/store policy before public distribution.
4. Obtain a representative real-page hang reproduction and heap-retainer attribution before choosing performance/memory fixes. Consider broad render/open-positioning work only against an observed user cost.
5. Scope later tools against verified product needs. Keep safe-author UI dormant; do not treat missing tools as already implemented.

The historical audit's side effects remain documented in its final Git record. Phase 10B.4 changes four production files, four browser-test files (three necessary assertion updates and one new focused suite) and this dashboard. No tracked historical PNG/JSON, historical report, F01–F05 implementation behavior, dependency or configuration file changed; nothing is staged or committed. Phase 10B.5/later work was not started; no commit, push, merge, tag or branch switch occurred.
