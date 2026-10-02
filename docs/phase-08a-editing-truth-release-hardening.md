# Phase 08A — Editing truth and release-contract hardening

Date: 2026-10-02. Workspace: `C:\Users\alire\Documents\ChatGPT\CSSForge`. Branch: `main`. Baseline HEAD, `origin/main` and tag `current-ui-v1`: `4f26023f058cf8825f571336035bf303d0f21eff`. Changes remain in the current working tree; no commit, push, publishing or next-phase implementation occurred.

This report records implementation and verification for the narrow Phase 08A request. The earlier [current project audit](current-project-audit.md) remains an unchanged historical snapshot. The [current support contract](current-support-contract.md) and [local release contract](current-release-contract.md) describe current product and distribution boundaries.

## Outcome

D01 now distinguishes a recorded override from its contribution to the supported cascade. Design and Code show the same stored effectiveness result. D02 gives every current TokenInput consumer grouped preview, rejection feedback and deterministic keyboard/blur behavior. Reproduced replacement defects were fixed by adding the already-existing physical binding generation to the Design subtree key. Documentation and standard Chrome MV3 ZIP packaging were updated without introducing new product features or widening mutation/targeting authority.

The engineering baseline is green within this scope: all 325 selected current cases are verified across the recorded runs, 259 unit tests pass, typecheck/build pass and the ZIP contains the exact tested files. The initial broad-run stale A07 failure and its baseline proof/correction are recorded explicitly below. Public distribution still requires approved icon assets, an evidence-based Chrome support policy and submission/disclosure review. Those are separate from the local engineering baseline.

## Starting state and audit hygiene

The first inspected working tree contained 19 changed tracked diagnostic outputs from the audit, the audit's temporary `.audit-ui-runtime.mjs` helper/profile, and the untracked audit document. Inspection identified generated diagnostic changes and random marker identity drift; no unexpected production changes existed. The exact proven diagnostic paths were restored, and the audit-owned helper/profile were removed using verified absolute paths contained within the workspace. No unrelated file was removed.

The exact post-cleanup starting status, before implementation, was:

```text
?? docs/current-project-audit.md
```

The audit document SHA-256 at this boundary and after implementation is:

```text
8AA41B7E39049442118E91053B5316E71AF34CF136D62802EFD03695AA7AD854
```

The baseline built `content.js` SHA-256 was `D6514209FF43D952DFFD9145018FC04B116347370AD56B6339298B75B9FD9AA5`. Baseline regression reproductions used that original build before the first production rebuild.

New phase tests use the existing real extension harness and `TestInfo.outputPath('profile')`; they create no custom profiles, screenshots or committed evidence tree. Existing relevant diagnostic/screenshot helpers were redirected to ignored `test-results/diagnostics/<existing-name>` directories: 21 literal replacements across thirteen files. Output isolation preserved assertions and behavior. A separate baseline-proven stale A07 assertion was subsequently strengthened as described below. Historical artifacts and reports remain unchanged. No temporary file/profile was placed in Vite's watched source paths.

## D01 reproduction

`tests/e2e/phase-08a-effectiveness.spec.ts` first exercised two ordinary built-extension failures against the original build:

| Case | Accepted session request | Browser result | Existing cascade evidence | Missing original feedback |
| --- | --- | --- | --- | --- |
| Authored ID important | `font-size:32px` | `18px` | Readable authored winner; session loses specificity | No blocked status in Design or Code |
| Flat important layer | `font-size:32px` | `18px` | Readable authored winner; session loses layer order | No blocked status in Design or Code |

The tests proved correct target ownership, a retained `32px` override, null validation error and exactly one Undo transaction before asserting the absent feedback. Both original-build cases failed at that intended status assertion. These were ineffective accepted edits, not invalid CSS, wrong-target writes or replacement failures.

Independent review then exposed a limitation of the engine's explicit inspection contexts: Base can exclude a currently active `:hover` rule, and one chosen media/state branch can exclude another simultaneously active branch. Two additional regressions reproduced false `effective` status against the first implementation build while the browser showed the stronger author result. The final model conservatively reports these combinations unverified; it does not change engine context semantics or force browser states.

A namespaced CSSOM selector also exercises the boundary between stylesheet syntax and DOM matching. The final helper guards native selector errors and treats unsupported active/excluded candidates as unverified. The first namespace fixture incorrectly expected a type selector to beat the session attribute selector; that was a test assertion error. Adding the authored ID made the fixture's expected stronger winner correct. This failure is recorded separately and is not counted as an original-build product reproduction.

## D01 implementation and semantics

`src/editing/effectiveness.ts` derives an `EditEffect` from the session declaration's contribution candidates, cascade confidence and actual context activity. It aggregates affected longhands by declaration identity. It never compares a requested token string to a browser computed-value serialization.

| Internal state | User-visible label | Evidence and meaning |
| --- | --- | --- |
| `effective` | Applied | Every affected contribution wins with resolved evidence within the supported readable-author cascade. The text explicitly says “Wins supported author cascade.” |
| `blocked` | Applied · blocked | Resolved active contribution loses wholly or partly. Feedback includes the loss reason, requested value and separately sampled browser value where available. |
| `pending` | Pending / inactive | Disabled declaration, inactive media query or naturally inactive hover/focus/active state. The stored edit remains reversible. |
| `unknown` | Applied · unverified | Missing/incomplete/unsupported cascade evidence, unverified generated pseudo-element, or active competing state/media evidence outside the selected inspection context. |

Any uncertain affected longhand prevents an effective shorthand claim. Mixed resolved shorthand outcomes are blocked because the whole requested declaration is not proven effective. Unit coverage exercises complete winners, partial longhand losses, uncertainty, equivalent expression serializations, inactive contexts and selector exceptions. Before/after remain unverified even when stylesheet contribution can be modeled; generated-content verification has not been added.

`EditState.effectiveness` stores results for the selected target's session groups. The picker refreshes it after successful editing actions, selection/reconciliation activation and source refresh. Snapshot publication adds no history, author mutation or recursive edit callback. Ordinary status refresh reuses already sampled computed values rather than adding another selected-element computed-style read per edit frame.

`src/ui/shared/EditEffectiveness.tsx` renders plain compact text. Design has a current-context edit summary; Code displays the same stored result beside owned declarations. The requested token remains visible. Status is not a modal, toast, color-only signal or live announcement repeated during scrubbing. Existing Code cascade provenance remains separate and retains its supported-subset qualification.

This phase does not increase selector specificity, create inline author declarations, automatically select safe-author mutation, erase blocked requests, reinterpret unresolved provenance as success or claim complete browser equivalence. Known losing edits remain in history, and Undo/Reset still remove them normally.

Status is a snapshot at documented lifecycle boundaries. Arbitrary stylesheet/state/media changes are not universally observed; explicit Refresh remains available. Pointer hover does not run effectiveness analysis. Layout constraints, browser/user origins, motion and final value substitution remain outside the supported proof.

## D02 TokenInput contract

Five current consumers share the implementation in `src/ui/design/RichControls.tsx`: custom font family, image URL, radial gradient shape/position, background position and background size. Background callbacks now return the controller boolean and forward the gesture ID. Existing font-family wiring already did so. Token callbacks require a boolean result.

Original-build tests reproduced five failures with zero retries: valid previews created duplicate history, rejected size/unsafe URL drafts lacked associated invalid state, Escape failed to restore the accepted focus baseline, and a pending token draft survived physical replacement. The original context key already safely retired drafts on context changes.

The implemented contract is:

- Focus starts a fresh gesture and records the accepted baseline.
- Accepted live previews use one gesture ID; sequential previews form one transaction.
- Rejection leaves the accepted page state/history unchanged and preserves the draft with `aria-invalid` and field-associated error text.
- Enter ends the gesture through blur without an additional write. An invalid draft stays visible with its error.
- Actual Tab blur also ends the gesture. Accepted values stay accepted; rejected drafts/errors remain visible. Refocusing starts an independent history gesture.
- Escape rolls back the matching current controller gesture and restores the accepted focus baseline, clears local invalid state and blurs. An unrelated or already completed gesture is not undone.
- Repick, context change, selected layer change and physical binding replacement retire the relevant local draft boundary. Accepted controller history stays separate from local draft lifetime.

Valid raw expressions such as `calc(100% - 2px) auto`, position expressions and quoted font lists remain intact. `safeImageURL` remains unchanged: image URL inputs accept HTTP(S) resolution and reject unsafe protocols. This does not make arbitrary browser-valid CSS universally network-free. Invalid-only Escape can leave the existing controller-global validation message when no matching transaction exists, matching Numeric/Color behavior; the local field error is cleared.

Six built-extension cases cover Enter, actual Tab blur, false-result rejection, CSS expressions, one-gesture Undo, Escape, font tokens, radial tokens, image protocol safety, repick/context change and replacement.

## Target-replacement draft safety

`tests/e2e/phase-08a-replacement.spec.ts` ran before its production fix. All three tests failed against the original build:

| Physical-owner case | Original behavior | Final requirement |
| --- | --- | --- |
| Focused invalid Numeric draft | A's `11qu` remained after B supplied `27px` | B shows fresh `27`, with no stale Enter/write |
| Accepted but focused Numeric gesture | Escape after migration removed the accepted migrated `23px` edit | Retire A's local Escape baseline; keep explicit Undo available |
| Held filter animation frame | A's queued `blur(9px)` callback wrote B | Cancel the pending callback on the binding boundary; a new B gesture works |

The sole replacement production change is the Design subtree key: logical target ID + binding generation + context. Code already used the binding generation. This recreates local control refs/drafts and invokes the existing NumericScrubber, GradientTrack and FilterSlider unmount cleanup. No broad control rewrite, targeting heuristic, locator authority, reconciliation bound or migration policy changed.

Committed ownership/history still migrates only through existing strong unique proof. The tests retain logical target ID, require increased binding generation and unchanged history, confirm the retired marker is removed and verify explicit Undo restores B's authored baseline. Token replacement coverage additionally confirms pending drafts/errors are retired. Queued-frame evidence uses deterministic delivery, not a timeout-based absence assertion.

## Documentation and release packaging

README now describes the current source/cascade/locator/reconciliation foundation, connected product capabilities, session persistence boundary, bundled fonts, permissions and local load/verification workflow. `docs/current-support-contract.md` separates supported, conservative/partial, unsupported, platform-limited and not-exposed behavior. `docs/current-release-contract.md` records local package mechanics and public distribution requirements. Historical milestone reports were not rewritten.

`package.json` adds only `zip: wxt zip -b chrome --mv3`. The installed WXT 0.20.27 CLI and packaging implementation were inspected: this is its standard production-build-and-ZIP workflow. No dependency, version, CI, publishing or manifest-permission change was introduced. `wxt.config.ts` remains unchanged.

The existing release asset directories contain Geist font files, notices and a font license; no suitable CSSForge release PNG/SVG/ICO icon set exists. Lucide UI artwork is not an approved product icon set. No icons or brand assets were invented. No minimum Chrome manifest field was guessed: Chrome 154 is tested, and the actual runtime/dependency combination has not been validated on lower versions. The CDP extension-loading API used by tests is a separate harness requirement.

Technical source observations: no telemetry/browsing-data backend or durable session storage path was found; UI font data is bundled; toolbar messages carry toggles. Accepted background URLs or resource-bearing supported CSS can cause browser requests. These are technical observations, not privacy, legal, store or dependency certifications.

`pnpm zip` passed. It rebuilt Chrome MV3 and produced `.output/cssforge-0.1.0-chrome.zip`, **448,788 bytes** (WXT reports 448.79 kB). The ZIP has six files and one directory entry:

| File | Bytes |
| --- | ---: |
| `manifest.json` | 467 |
| `background.js` | 1,513 |
| `content-scripts/content.js` | 1,041,244 |
| `content-scripts/content.css` | 88,079 |
| `THIRD-PARTY-NOTICES.txt` | 5,707 |
| `Geist-OFL.txt` | 4,383 |

Every file's SHA-256 and size matches the production build that completed browser verification before ZIP generation. Directory entries were counted separately during comparison. No extra preview, source, diagnostics or profile files are packaged. The ZIP manifest is MV3/version 0.1.0, permissions exactly `activeTab` and `scripting`, no host permissions, no static content scripts, and the existing dynamic-URL content stylesheet resource. There are no icons or `minimum_chrome_version` fields, matching the explicit unresolved release requirements.

```text
ZIP SHA-256: 41632D84F412BD35562A535EA77840D15D6FB2F5209DA12EA01EF0F5460B358A
Tested/packaged content.js SHA-256: EA6165B7523D29A8F41223BF5696120661F3CA1D6278E815CBF9B66DF06DAF34
```

## Verification record

Environment: Windows, Node 24.19.0, pnpm 11.19.0, WXT 0.20.27, Vite 7.3.6, Vitest 3.2.7, installed Chrome channel **154.0.8037.93**. The runtime patch version is independently confirmed in current browser diagnostics and the installed executable; the audit's earlier .92 record remains unchanged.

All executing Playwright commands explicitly use `--retries=0`, one worker and the existing built-extension/native harnesses. No assertion was weakened to hide a product failure. Source fixes prompted explicit rebuilt reruns; these are not Playwright retries.

Baseline and intermediate outcomes:

| Run | Result | Classification |
| --- | --- | --- |
| Original build D01 + Numeric/filter replacement | 5 failed / 5 | Intended product regressions reproduced |
| Original build Token suite | 5 failed / 5 | Intended contract/replacement regressions reproduced |
| First rebuilt phase suite | 13 passed / 13 | Initial implementation verified |
| Active-state/overlapping-media additions on preceding build | 2 failed / 2 | Confirmed missing conservative context guard |
| Namespace fixture's initial run | 1 failed / 1 | Incorrect stronger-winner fixture assertion; corrected by authored ID |
| Phase suite after state/media fix | 16 passed / 16 | Before final selector guard |
| Final phase suite | 17 passed / 17 | D01 8; TokenInput 6; replacement 3 |
| Broad critical set, first run | 228 passed / 229; A07 failed | Stale existing slot-parent assertion, independently reproduced against archived baseline HEAD source |
| A07 against archived baseline | 1 failed / 1 at the same assertion | Baseline implementation already follows composed Parent to assigned slot |
| Strengthened A07 + current CA64 | 2 passed / 2 | Corrected stale assertion; existing current slot contract reconfirmed |

The broad run exposed one stale test, not a new navigation defect. `navigation.ts` is unchanged from HEAD and returns an assigned node's accessible slot. Current CA64 already asserts this behavior and passed. Baseline source was archived under ignored `.preview/phase-08a-baseline`, the unchanged A07 test imported that controller temporarily, and failed identically: expected `slot-host`, received `slot`. The normal source import was restored. A07 now adds the complete upward `slotted → slot → slot-wrap → slot-host` assertions and retains all downward, tree and closed-root checks. No navigation production code was changed. A focused A07/CA64 run closes this specific stale-test failure; the already passing unrelated cases are not rerun merely to hide the initial result.

One initial Token baseline launch failed in the filesystem sandbox before any test ran because Vite/esbuild could not access the parent directory. The authorized run executed all five. One default-sandbox test inventory command could not resolve the Playwright executable; the authorized read-only inventory succeeded. These were environment/command-start failures, not executed browser failures. No auto-review permission rejection remains.

Final ordered browser commands and results:

```powershell
pnpm exec playwright test tests/e2e/phase-08a-effectiveness.spec.ts tests/e2e/phase-08a-token.spec.ts tests/e2e/phase-08a-replacement.spec.ts --retries=0
pnpm exec playwright test tests/e2e/source-index.spec.ts tests/e2e/engine-integration.spec.ts tests/e2e/mutation-conflicts.spec.ts tests/e2e/current-ui-p2.spec.ts --retries=0
pnpm exec playwright test tests/e2e/author-mutation.spec.ts tests/e2e/mutation-audit.spec.ts tests/e2e/cascade.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/selectors.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/selection-audit.spec.ts tests/e2e/current-ui-p1.spec.ts tests/e2e/code-html.spec.ts tests/e2e/editing.spec.ts tests/e2e/rich.spec.ts tests/e2e/units.spec.ts tests/e2e/professional.spec.ts tests/e2e/extension.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/interactions.spec.ts tests/e2e/foundation.spec.ts --grep-invert 'captures five Phase 03|thirteen focused views|capture Phase 02' --retries=0
pnpm exec playwright test tests/e2e/selection-audit.spec.ts tests/e2e/current-ui-p1.spec.ts -g 'A07 |CA64 ' --retries=0
```

The critical current regression set inventories 229 tests in 18 files. It excludes three historical capture cases within the selected files and the unselected older polish/audit/capture-only suites. It retains current behavior tests that happen to produce ignored evidence. This is an explicit relevant regression set, not a claim that every historical Playwright case ran.

| Final check | Result |
| --- | --- |
| Phase regressions | 17/17 passed, 0 retries |
| source-index | 2/2 passed including the previously failed native case |
| engine-integration | 38/38 passed |
| mutation-conflicts | 24/24 passed |
| current-ui-p2 | 15/15 passed |
| Critical current regressions | 229 distinct cases verified: first run 228/229 passed; baseline-proven stale A07 corrected and passed with CA64 in a 2/2 targeted run |
| `pnpm typecheck` | Passed |
| `pnpm test` | 259/259 passed in 18 files; baseline 256, three effectiveness cases added |
| `pnpm build` | Passed; current guarded production build 1.14 MB total, content CSS 88.08 kB |
| `pnpm zip` and exact archive inspection | Passed; six files byte-identical to tested build, plus one directory entry |
| `git diff --check` | Passed |

The final selected coverage totals **325 distinct cases**: 17 phase, 79 required supplementary, and 229 critical/current. This combines built-extension, native-engine and preview interaction regressions; it does not mislabel all cases as packaged-extension tests. Final Playwright retry count is zero. There is no unresolved executed-test failure after the documented fixes/classifications. The temporary baseline source archive was removed after classification with a verified workspace-contained path and contents check.

## Performance and accessibility

Performance refresh is attached to editing/selection/source boundaries. Pointer listeners, overlay frame/geometry paths and render-time status display do not perform effectiveness resolution. The new ordinary-edit status refresh reuses the selected computed-style sample. The final raw-hover and M29/Q42/A12/R21/T32 checks pass: 1,000 pointer events add zero stylesheet scans, cascade resolutions, locator searches, selector generation/validation, reconciliation analysis or author-mutation analysis. M29 and Q42 diagnostics contain zero for every measured engine counter. The native burst also records zero computed inspection/UI publication and one coalesced geometry read. The built filter burst passes its exact one-selected-style-read assertion for 100 coalesced inputs.

Effectiveness is readable property-labeled text with requested/browser values and no color-only or repeated live announcement. Token rejection uses a local unique error ID, `aria-invalid` and `aria-describedby`; the current field error remains reachable after rejected Enter/Tab. Existing controller validation announcements remain; local text avoids duplicating them, while URL-specific rejection has its own alert. No additional modal, focus trap, tab stop or motion was added.

Passing final accessibility evidence includes phase Enter/Escape/Tab/error association, current-ui-p2 Code focus/Cancel and tree keys, menu/modal focus return, narrow layouts and actual Chrome 200% zoom. Critical keyboard and reduced-motion checks also pass. This is focused regression evidence, not a full assistive-technology certification.

## Final git/artifact status and remaining work

Final status contains 22 modified tracked files and 10 untracked intended documents/source/tests. The preserved audit is one of those untracked files and is byte-identical to the starting snapshot. No files are staged; HEAD remains the baseline commit. Generated builds/ZIPs are under ignored `.output`; browser profiles, traces and current test evidence are under ignored `test-results`; no new committed evidence directory is created. Historical artifact diff/status is empty. The exact final `git status --short` is:

```text
 M README.md
 M package.json
 M src/editing/session.ts
 M src/picker/controller.ts
 M src/ui/code/LiveCodeView.tsx
 M src/ui/design/LiveDesignView.tsx
 M src/ui/design/RichBackground.tsx
 M src/ui/design/RichControls.tsx
 M tests/cascade.test.ts
 M tests/e2e/author-mutation.spec.ts
 M tests/e2e/code-html.spec.ts
 M tests/e2e/current-ui-p1.spec.ts
 M tests/e2e/current-ui-p2.spec.ts
 M tests/e2e/editing.spec.ts
 M tests/e2e/engine-integration.spec.ts
 M tests/e2e/mutationHarness.ts
 M tests/e2e/reconciliation.spec.ts
 M tests/e2e/rich.spec.ts
 M tests/e2e/selection-audit.spec.ts
 M tests/e2e/selectors.spec.ts
 M tests/e2e/target-locator.spec.ts
 M tests/e2e/units.spec.ts
?? docs/current-project-audit.md
?? docs/current-release-contract.md
?? docs/current-support-contract.md
?? docs/phase-08a-editing-truth-release-hardening.md
?? src/editing/effectiveness.ts
?? src/ui/shared/EditEffectiveness.tsx
?? src/ui/shared/editEffectiveness.module.css
?? tests/e2e/phase-08a-effectiveness.spec.ts
?? tests/e2e/phase-08a-replacement.spec.ts
?? tests/e2e/phase-08a-token.spec.ts
```

Remaining public release requirements: approved icon set and manifest/action wiring, an evidence-based minimum/supported Chrome policy, and store listing/disclosure/submission review. Conservative cascade/current-context freshness, generated-pseudo verification, unsupported roots/frames, modern CSS limits and dormant custom-property dependent-impact work remain documented support boundaries. Safe-author mode remains unavailable in the normal product UI.

When final checks are green, the recommended next authorized phase is **Detailed Changes + Copy/Export**. This report does not implement it or any other deferred product feature.
