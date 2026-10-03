# CSSForge current state

Audited **2026-10-03**, Europe/Berlin. This dashboard and [the detailed audit](post-10a-full-project-audit.md) are the current project health references. Earlier phase reports remain historical evidence.

## Baseline and health

- Initial baseline verified clean: `main`, HEAD and `origin/main` **`ad32eedf81f051a7f5ac3508e2d6a7c243f37b1e`**, exact tag **`phase-10a`**.
- Commit: `feat: add native eyedropper and optimize edit performance`.
- The selected-element editing foundation works in its supported scope. Five important product defects and three minor UX/accessibility defects remain. No P0 or P1 finding was established in this audit.
- The full report inventories **21 findings: P0 0 / P1 0 / P2 9 / P3 12**. This includes release gaps, debt and unverified risks; it is not a count of 21 confirmed product bugs.
- Audit only: no fixes, dependency updates, commits, pushes, tag changes or next feature phase.

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

## Confirmed current product defects

| ID | Severity | Current defect |
| --- | --- | --- |
| F01 | P2 | A page stylesheet carrying the internal layer attribute is excluded from source analysis, allowing false “Applied” feedback despite a stronger author rule. |
| F02 | P2 | A host clone carrying that attribute bypasses marker containment and temporarily inherits the original target’s CSS override. |
| F03 | P2 | Duplicate’s raw `url(` check misses an escaped CSS URL function; the browser accepts the URL and the supposedly resource-safe subtree is duplicated. |
| F04 | P2 | Color-slider arrow keys reach popup button navigation and move focus away from the slider. |
| F05 | P2 | A stale structure action is safely refused, but its explanation disappears when invoked from HTML. |
| F06 | P3 | No-selection Code/HTML guidance falsely says connected features are not connected. |
| F07 | P3 | Code add-declaration validation lacks field-associated error semantics and precise property/value feedback. |
| F08 | P3 | Repeated same-class tree nodes can have identical accessible names despite distinct visible text. |

These are fresh runtime observations, with source causes documented in the detailed report. F01–F03 also exist in the earlier 09B source; this audit does not attribute them to 10A. No fix has been applied.

## Performance, memory and remaining uncertainty

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

**Local engineering verification passed within tested scope, with known defects. Public distribution is not ready:** bundled dependency notices are incomplete, approved release icons are missing, and minimum/support Chrome policy, compatibility and store/disclosure checks remain open. Version is `0.1.0`; nothing was published.

## Dependency-ordered next work

1. Fix internal stylesheet/node identity classification and escaped-resource duplication checks with scoped regressions; preserve mutation/rollback safety.
2. Fix color-slider keyboard ownership and visible HTML action refusals; correct the three smaller UX/accessibility defects.
3. Repair stale test contracts and distinguish assertion gates from diagnostic collectors; keep first-failure history and separate generated evidence from historical captures.
4. Complete release notices, icons, current support documentation and a tested compatibility/store policy before public distribution.
5. Obtain a representative real-page hang reproduction and heap-retainer attribution before choosing performance/memory fixes. Consider broad render/open-positioning work only against an observed user cost.
6. Scope later tools against verified product needs. Keep safe-author UI dormant; do not treat missing tools as already implemented.

The audit created only the two report documents intentionally. Legacy tests also regenerated tracked historical artifacts; those outputs are preserved and listed in the detailed report’s final Git record. Production source, tests, configuration and dependency files are unchanged.
