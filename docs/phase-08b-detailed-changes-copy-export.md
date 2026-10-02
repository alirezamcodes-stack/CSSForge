# Phase 08B — Detailed Changes, Copy and Export

Date: 2026-10-02. Workspace: `C:\Users\alire\Documents\ChatGPT\CSSForge`.

**Complete.** The final package passes 339/339 selected browser cases with zero Playwright retries, 273/273 unit tests, typecheck, production build and ZIP verification. Changes, target/all Copy and local Export are implemented within the documented boundaries. No next-phase work, commit or push occurred.

## Baseline and scope

The initial working tree was clean. The requested safety checks confirmed branch `main`; HEAD and `origin/main` both `f8255bf5d247b7d6fdc2223a43f2468867543f6d`; exact tag `phase-08a`; commit `fix: complete phase 08A editing truth and release hardening`. No baseline cleanup, reset, branch/worktree creation, commit, push or publishing was performed. No subagents were used in this phase.

Only the current audit/support/release contracts, Phase 08A implementation report, and relevant source/test paths were consulted. Historical screenshots/artifacts were not reread. Historical reports and tracked diagnostic outputs remain unchanged.

This phase adds current Changes review and session CSS output. It does not introduce persistence, Redo, row revert, safe-author controls, a second edit history, responsive simulation, eyedropper, measurement tools, asset/animation tooling, arbitrary CSS editing or release branding. Dependencies, package version, WXT configuration and permissions are unchanged.

## Controller/history analysis and source of truth

`createEditSession` remains the sole editing owner. Its target map retains logical `targetId`, physical identity/root and `bindingGeneration`; scopes own enabled/disabled declarations by media/pseudo context; transactions retain previous override/disabled states and gesture grouping. Batch edits still produce atomic shared transactions. The existing guarded author engine and recovery ledger remain dormant in ordinary product editing.

The new `EditState.changes` is a read-only projection rebuilt during the existing publication boundary. `src/editing/changes.ts` receives the current owned scopes and transaction records; it creates no write controller or independent event list. `changeBindings()` exposes only safe edited identity handles for explicit controller preparation. React consumes the published snapshot through the existing `useSyncExternalStore` adapter. DOM handles are not persisted or placed in UI state.

Transactions gain a small optional `baseline` field on each accepted property change. Before the style layer is rendered, the pre-write Design snapshot supplies a known inline-authored token or a browser-computed Base value. No additional computed-style read is added to ordinary accepted editing. Media/state/pseudo originals remain unknown because a current browser value does not prove the original value of an inactive or separately scoped declaration. Failed writes create no baseline history record. Gesture merging retains the first property's original baseline. Undo removes the relevant transaction metadata, so a new first edit after a complete rollback can capture a fresh baseline.

Projection chooses the earliest retained transaction baseline for each logical target/context/property, then reads the current value and enabled state from its owned scope. Later post-edit samples cannot replace an unknown original. Repeated `18 → 20 → 24 → 22` edits display one `18 → 22` row. This is a review of current owned declarations: an explicit override matching its captured baseline remains meaningful because the owned declaration/priority still exists. It is not an event timeline or proof of reconstructed original stylesheet source.

Dormant author records are grouped separately by provenance within the same logical target/context. They retain the earliest authored before value and current record value/priority, remain Undo/Reset-owned, and are explicitly excluded from session CSS. Their value is labeled `Recorded current`, distinguishing a recovery observation from a requested session token. Safe author-only owners remain available; recovered records without a newly bound owner remain unavailable. Initial recovery history is projected before any selection. Partial/unresolved records do not create a safe-author UI or widen mutation authority.

## Grouping and detailed UI

`LiveChangesSurface` replaces only the live lightweight Changes body; fixture preview behavior remains separate. The existing Surface modal, focus manager, Escape close and return-focus mechanism are retained.

- Groups use logical target IDs and the existing `identityOf` human label captured on initial ownership. Migration preserves one group. Duplicate human labels receive a target number in the heading and accessible action name.
- Context sections preserve full nested media query text/order and the supported Base/hover/focus/active/before/after context. Inactive contexts remain visible. Context ordering matches the existing renderer's stable ordering by media depth; ties retain scope insertion order.
- Each compact property row shows captured original provenance/value or `Unknown`, current requested token, actual priority, enabled/disabled state, session/author-recovery provenance and the shared effect evidence. Browser-computed values are separate when available and different from the request.
- Element and declaration counts describe current ownership. The original edited-element count remains available alongside the new current-declaration count. Undo/Reset actions remain authoritative; no per-row revert primitive was added.
- Empty review contains no fixtures or stale inspection values. Global output controls are disabled when no enabled declarations exist. Target copy is disabled for unavailable/shadow targets and groups lacking active session declarations.
- Output feedback is a polite text status. Warnings and omissions have readable reasons; there are no toast queues or color-only results. Action feedback clears on meaningful current declaration/ownership changes.

## Shared Phase 08A effectiveness

The existing `editEffect` and `hasActiveOutsideContext` remain the only effectiveness calculation. The picker refactors the existing selected-target refresh into a reusable target calculation. On opening Changes, and on explicit copy/export preparation, readable sources/cascade are refreshed for safe edited bindings. While review is open, meaningful edit/Undo/Reset boundaries refresh its edited targets. Pointer/geometry paths do not refresh Changes.

The session retains the most recently derived per-target shared evidence; ordinary editing invalidates other cached review evidence conservatively. Missing evidence appears unverified. The selected Design/Code effect array and Changes rows receive the same `EditEffect` objects and labels. A focused regression covers switching from a blocked target to a winning target and back when the returning target's evidence is cached. Selected status is published even when the target cache already holds the identical result.

Effective means winning the supported readable-author cascade, not complete browser equivalence. Blocked requests remain stored and reversible. Inactive media/state and disabled declarations remain pending; generated pseudos and unsupported evidence remain unverified. Requests are never replaced with their computed serialization to claim success.

## Copy representation and selector/shadow safety

`picker.prepareChanges(targetId?)` is an explicit output boundary. It refreshes shared effects, obtains current safe identity handles, and invokes the existing bounded selector engine with fresh validation. Only unique selectors whose native validation matches the current physical target are accepted. The generated result is presentation/output data; it cannot authorize edits or migration. No generation, validation or serialization occurs during row rendering or pointer hover.

`src/export/css.ts` is a pure serializer of the prepared projection. It reconstructs current CSS rather than dumping the internal session sheet. Internal random edit marker selectors, layer markers, identity handles, source IDs, page URL/text and diagnostics are never added. Output contains requested supported CSS values, including any resource references deliberately entered as CSS values.

The deterministic representation preserves target creation order, the renderer's stable context order, current declaration insertion order, nested media ancestry, supported pseudo suffixes, and actual session `!important`. No alphabetical reorder is introduced. Equivalent terminal pseudos are not doubled; escaped ID text ending in `\:hover` is correctly distinguished from an actual `:hover` suffix. Escaping and uniqueness use the existing selector engine, not a new selector implementation.

Structural/generated-ID/attribute/class risks are reported in readable metadata. Changed selector specificity and later DOM changes can alter cascade results after copying; no identical rendered result is promised. Blocked/unverified declarations remain in usable CSS with effect warnings in the action result. Pending declarations remain in their conditional contexts. Disabled declarations are omitted from normal output and remain visible in review.

Flat v1 CSS explicitly excludes open-shadow target declarations because document selectors cannot enter a shadow root. Target copy is disabled with an explanation; all-copy/export report included and not-representable counts/reasons. No piercing syntax, `::part` fiction or host-descendant substitute is invented. Unavailable targets or selector failures are also excluded. A stale descriptive selector is not reused after identity loss. Existing loss/reconciliation semantics determine whether a scope is retained pending recovery or cleared; export never manufactures a new owner.

## Clipboard and local export

Copy target CSS filters the current projection by logical target ID; Copy all CSS serializes every current target. Both call native `navigator.clipboard.writeText` synchronously from preparation inside the actual trusted button gesture, then await completion. The UI prevents duplicate pending actions and announces success/failure. No `clipboardRead`/`clipboardWrite` extension permission, background clipboard service, offscreen document or production test hook was added. Unavailable/rejected clipboard contexts produce explicit failure.

Native clipboard writes can use user activation without broadening extension permission; API availability/security rules still depend on the page/browser. See the primary [MDN Clipboard API documentation](https://developer.mozilla.org/en-US/docs/Web/API/Clipboard_API) and [extension clipboard documentation](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Interact_with_the_clipboard). Verification uses the installed Chrome runtime rather than treating those documents as compatibility certification.

Export creates one UTF-8 `text/css` Blob, clicks one transient local download anchor, removes the anchor and schedules object URL revocation after 1 second. Filename is `cssforge-changes.css`. There is no timestamp/header, keeping content deterministic. The action displays explicit declaration accounting and omission warnings. No filesystem picker, backend, `downloads` permission or stored session data is introduced. A built test observes native object URL creation/revocation and exactly one browser download, then checks exact file contents.

## Undo, Reset, migration and loss

Neither review nor output preparation adds a transaction. Undo immediately projects the remaining current declarations and removes fully rolled-back rows/groups. Reset removes all session rows across targets/contexts, except genuinely retained unresolved author recovery records under the existing conflict rules. Selection changes retain session ownership; replacement retains the logical ID, baseline, scopes and history only through the existing strong unique same-root proof. Target loss does not authorize selector or locator guessing. Migration/Undo tests confirm the replacement's own authored value returns after rollback while the review retains the pre-edit original as historical baseline evidence.

## Accessibility and performance

The existing modal focus trap and return focus are preserved. Headings identify target/context groups; actions have explicit names; status/provenance/disabled/effect states use text; all output controls are keyboard reachable. Focused browser cases verify Tab containment, keyboard activation, Undo followed by Escape and opener focus restoration.

Review fits 320×480 and 390×540 CSS viewports and actual Chrome 200% zoom at a 1440×900 configured viewport. Native `chrome.tabs.getZoom` confirms the factor. Long requested values wrap and remain fully available, including a 2,500-character family token; copied escaped selectors preserve their full text. Tests check modal bounds and horizontal overflow, not only viewport emulation screenshots.

Projection runs only at meaningful session publications. Source/cascade refresh runs at selection/edit/source/review or explicit output boundaries. Selector preparation and serialization run only on explicit output actions. The dedicated 1,000-pointer-event test compares source, cascade, locator, selector, reconciliation, author-analysis and Changes preparation/serialization counters before/after: all remain unchanged. Existing raw-hover, rich control batching and engine hot-path regressions are included in the critical run. Ordinary history and aggregate review remain proportional to the activation's current owned/history data; introducing history limits or persistence remains outside scope.

## Verification record

Environment: Node 24.19.0, pnpm 11.19.0, WXT 0.20.27, Vite 7.3.6, Vitest 3.2.7, Chrome 154.0.8037.93. All Playwright commands explicitly use `--retries=0` and one worker. Changes to fixtures or source prompted visible new runs; no hidden retries occurred.

| Run | Exact result / classification |
| --- | --- |
| Test-first projection/serializer | 1 suite failed to import the not-yet-created domain modules; no tests executed |
| Initial pure domain implementation | 8/8 passed |
| Expanded pure selector/order coverage | 10/10 passed |
| Initial focused built run | 6/9 passed; 3 failed from fixture/observation setup |
| Clipboard investigation | 1/1 failed at exact text comparison after proving a successful ordinary gesture write; Windows CRLF normalization was missing |
| Corrected focused run | 9/9 passed |
| Expanded focused run | 12/12 passed |
| Focused run after cached-effect correction | 13/13 passed |
| Existing critical/current regression set before final author metadata correction | 325/325 passed (12.5 minutes) |
| Author-only/recovered review reproductions | 2/2 failed at intended metadata assertions |
| Launch raced a still-running rebuild | 6/14 passed; 8 failed before browser setup with missing generated manifest |
| Focused rerun after confirmed rebuild completion | 14/14 passed |
| Final `pnpm typecheck` | Passed |
| Final `pnpm test` | 273/273 passed in 19 files, including 14 new domain tests |
| Final `pnpm build` | Passed |
| Final `pnpm zip` | Passed; archive contents match build bytes |
| Final combined focused and critical/current set | 339/339 passed (10.9 minutes), zero retries |

The initial clipboard setup granted read permission *before* the trusted write. In this Chrome test context, that permission override denied ordinary writes. Removing the override before Copy demonstrated successful gesture writes without any production permission change. Tests grant read permission only after Copy, read exact native text, then clear the test permission override before the next action. They normalize only CRLF to LF. The shadow fixture initially tried to attach its root from the document head before the host existed; it now attaches at DOMContentLoaded. These are test setup corrections, not suppressed production failures. The failure-feedback case deliberately substitutes a rejecting clipboard method only within its isolated test context.

Final review reproduced two dormant-author projection defects: a live author-only group used an unavailable fallback and retained the first priority after later writes; recovery rows were absent immediately after reactivation until another edit/selection publication. The narrow correction derives availability/binding generation from a real current owner, projects the latest recorded priority and publishes initial recovery state after constructor initialization. The new recovery test keeps a conflicting record through Reset and then proves an exact safe retry clears it. No mutation, rollback, conflict, ledger or targeting rule changes.

One follow-up test run was launched while WXT still had an ongoing build session. Its first eight setups could not open `.output/chrome-mv3/manifest.json`; six later cases passed after the build completed. This was an orchestration error, not a product assertion failure. The build's successful completion was observed before the explicit rerun. It is included in the exact run counts and does not represent a Playwright retry.

Focused cases cover net collapse, captured Base originals, unknown conditional originals, atomic properties, multiple targets, disabled declarations, blocked/pending/generated-pseudo evidence, exact target/all clipboard contents and repeated determinism, download name/bytes/count/URL cleanup, logical migration and unavailable output, shadow partial output accounting, keyboard/narrow/native zoom, zero hover output work, long tokens, escaped selectors/pseudo suffixes, structural risk metadata, duplicate labels, dormant author classification/Reset and shared cached-effect handoff.

The existing critical set contains 325 tests: the 17 Phase 08A cases; 79 source-index/engine-integration/mutation-conflicts/current-ui-p2 cases; and 229 current critical engine/product cases. The final combined run adds the 14 Phase 08B cases, totaling 339 selected cases against the final package. The three historical capture cases are excluded with the same explicit grep-invert filter as Phase 08A. Existing J04 now asserts detailed current review and an enabled Export action while preserving its real count, Undo/Reset and focus assertions. No historical report is rewritten to match the new capability.

Required final verification order after the focused phase cases:

```powershell
pnpm typecheck
pnpm test
pnpm build
pnpm zip
pnpm exec playwright test tests/e2e/phase-08b-changes.spec.ts tests/e2e/phase-08a-effectiveness.spec.ts tests/e2e/phase-08a-token.spec.ts tests/e2e/phase-08a-replacement.spec.ts tests/e2e/source-index.spec.ts tests/e2e/engine-integration.spec.ts tests/e2e/mutation-conflicts.spec.ts tests/e2e/current-ui-p2.spec.ts tests/e2e/author-mutation.spec.ts tests/e2e/mutation-audit.spec.ts tests/e2e/cascade.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/selectors.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/selection-audit.spec.ts tests/e2e/current-ui-p1.spec.ts tests/e2e/code-html.spec.ts tests/e2e/editing.spec.ts tests/e2e/rich.spec.ts tests/e2e/units.spec.ts tests/e2e/professional.spec.ts tests/e2e/extension.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/interactions.spec.ts tests/e2e/foundation.spec.ts --grep-invert 'captures five Phase 03|thirteen focused views|capture Phase 02' --retries=0
```

## Package and artifact status

The generated Chrome MV3 ZIP contains six files and one directory entry. Every file's SHA-256 and size is compared with `.output/chrome-mv3` after ZIP's standard rebuild. The final focused/critical run uses that exact output, and post-run fingerprints confirm it remains unchanged.

| Packaged file | Bytes |
| --- | ---: |
| manifest.json | 467 |
| background.js | 1,513 |
| content-scripts/content.js | 1,051,177 |
| content-scripts/content.css | 89,877 |
| THIRD-PARTY-NOTICES.txt | 5,707 |
| Geist-OFL.txt | 4,383 |

Manifest remains MV3, version 0.1.0, permissions exactly `activeTab` and `scripting`, no host permissions and no static content scripts. Existing dynamic-URL content CSS resources remain. No minimum Chrome or release icons are invented. The generated ZIP, profiles, downloads and diagnostics are ignored output, not tracked deliverables.

```text
content.js SHA-256: 9604D8C49524088F6D67449402355A330B56E9855C5FCFEDE65A0A706D109B9A
content.css SHA-256: C7D5C67DD18CB31BAD6F93FB5DE451DDAFEC8A38D0BF017AC2932CB25D7BE9FD
ZIP bytes: 452,382
ZIP SHA-256: 71A2360E696CA5D2D9A31954B110C2BAD9B5F65B6C5817A5042942E78C483F81
```

## Final git classification

- **PRODUCTION:** `src/editing/changes.ts`, `src/editing/session.ts`, `src/picker/controller.ts`, `src/export/css.ts`, `src/export/actions.ts`, `src/ui/changes/LiveChangesSurface.tsx`, `src/ui/changes/liveChanges.module.css`, `src/ui/inspector/LiveInspection.tsx`.
- **TEST:** `tests/changes.test.ts`, `tests/e2e/phase-08b-changes.spec.ts`, current-capability assertion in `tests/e2e/current-ui-p2.spec.ts`.
- **DOC:** README, current support contract and this report.
- **GENERATED:** ignored `.output` build/ZIP and `test-results` browser profiles, downloaded CSS, traces and diagnostics. No historical tracked evidence is regenerated.

The final diff contains 14 files: eight production, three test and three documentation files. Six tracked files are modified and eight new files are untracked. No files are staged. `git diff --check` passes. HEAD remains `f8255bf5d247b7d6fdc2223a43f2468867543f6d` on `main`, with tag `phase-08a`. Historical audit/report/artifact paths and package/lock/config paths have no diff. No commit or push is authorized or performed. The exact final `git status --short --untracked-files=all` is:

```text
 M README.md
 M docs/current-support-contract.md
 M src/editing/session.ts
 M src/picker/controller.ts
 M src/ui/inspector/LiveInspection.tsx
 M tests/e2e/current-ui-p2.spec.ts
?? docs/phase-08b-detailed-changes-copy-export.md
?? src/editing/changes.ts
?? src/export/actions.ts
?? src/export/css.ts
?? src/ui/changes/LiveChangesSurface.tsx
?? src/ui/changes/liveChanges.module.css
?? tests/changes.test.ts
?? tests/e2e/phase-08b-changes.spec.ts
```

The historical audit SHA-256 remains `8AA41B7E39049442118E91053B5316E71AF34CF136D62802EFD03695AA7AD854`; the Phase 08A report remains `A10D8992CE7F4E19CBF7139056E9A69EDC79778F7031C00D7C05F58684900D29`. No new helper/profile directory was placed in a watched source path.

## Remaining limitations and next-phase options

Review/export remains an activation-local current-state workflow, without persistent history or Redo. Flat CSS cannot represent shadow-root edits or dormant source-aware author recovery. Original conditional values remain unknown; computed Base baselines do not reconstruct source rules. Selector specificity/stability and conservative cascade evidence limit portability; clipboard security/availability can prevent copying. Existing unbounded ordinary history remains separate debt.

For the next reviewed phase, the strongest options are: a narrowly scoped Responsive workflow using the existing context foundation; a native page eyedropper/color-sampling workflow; or public-release branding/icon assets plus an evidence-based browser policy and distribution review. No next option is chosen or implemented here.
