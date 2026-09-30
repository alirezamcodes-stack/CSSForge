# ENGINE 07.4B — mutation conflict and shared-scope fixes

Scope: only Q01–Q04 from the locked 07.4A audit. Q05 remains deferred. No UI redesign, Changes/export, persistence, dependency traversal or 07.4C work was added.

## Corrected behavior

| Defect | Fix | Regression evidence |
| --- | --- | --- |
| Q01 selector-list undercount | `mutation/scope.ts` enumerates a deduplicated union of whole-rule recipients independently of cascade applicability. Supported terminal state/pseudo-element branches use potential originating elements and remain unknown. Unsupported syntax and exhausted bounds remain unknown. Shared/unknown scope requires explicit authorization; unresolved cascade still refuses author mutation even with authorization. | Corrected Q01; F01–F07; whole-rule unit cases |
| Q02 untracked partial write | Failed writes retain a typed partial record when the intended native declaration cannot be cleanly restored. Undo/Reset prove exact native identity and attempted property value/existence/priority before restoring only that property; unrelated page declarations remain untouched. Unproven ownership stays blocked. | Corrected Q02; F08–F12, F21–F22 |
| Q03 deactivation history loss | A content-runtime ledger retains unresolved author records across UI/picker/editor teardown. Reactivation imports each record once in chronological order, preserving logical ownership groups. Safe teardown rolls back and removes records; navigation/context loss or document-root replacement explicitly retires the old capabilities. | Corrected Q03; F12–F15, F19, F23–F24; document-ledger unit cases |
| Q04 stale attribution | Presentation passes the current declaration to exact native binding validation. A live source must match the original native root/sheet/rule/style and the applied property value/existence/priority. Current source IDs are resolved to native objects, preventing recycled presentation identifiers from inheriting ownership. Historical records remain independent of current attribution. | Corrected Q04; F16–F19; replacement-source audit cases |

Cascade selector matching, source indexing, selector generation and reconciliation algorithms are unchanged. `SESSION_OVERRIDE` remains the default; author mutation remains opt-in.

## Transactions and safety

Author records distinguish `kind: applied | partial`, and `state: applied | partial-write | blocked | resolved | retired`. They retain the original source/rule/declaration identity, property, before snapshot, attempted snapshot, observed current snapshot, generation, live-document session and logical editing owner. One attempted user action creates at most one history transaction.

Normal author Undo retains the existing full-declaration-block fingerprint guard. An unrelated external declaration change still blocks ordinary Undo/Reset. Partial-write records use the separate exact-property ownership proof required by Q02; they never become blind session overrides. Restoration is simulated against the current declaration block before writing to reject shorthand collateral effects. Native callbacks during rollback either leave the intended property safely restored, or retain a blocked record when the page changes that property again. No full declaration-block writes are used for recovery.

Undo processes the latest transaction. Reset processes author records in reverse order, removes safe records and session layers, and retains blocked records. Recovered history is session-wide; selecting another element does not erase it, and pending records keep the existing Reset action usable. F21 verifies a successful mutation followed by a partial mutation on the same property: partial Undo preserves the new page color, while the older normal Undo remains blocked until its entire applied snapshot is restored.

## Lifecycle and bounds

- Recovery lives only in the existing content-script runtime for one live document. No extension storage or source-file persistence is used.
- Native identity is revalidated before resumed rollback. A similar selector, replacement rule or equal value does not grant ownership.
- UI teardown removes existing picker/reconciliation observers, listeners and session layers. The ledger itself adds no polling, DOM observer or source observer.
- The existing runtime receives one `pagehide` lifecycle listener, removed on context invalidation. Page loss explicitly retires records and clears retained native capabilities. A changed `document.documentElement` also invalidates the old session, covering `document.open()` even when the Document object survives.
- Up to 256 unresolved author records are admitted. Capacity is checked before native writes; records are never silently evicted. At capacity, safe session fallback remains available where already supported. F20 fills the bound and verifies complete reverse restoration.
- Scope analysis retains the 512-element budget and additionally caps selectors at 8,000 characters / 80 branches. State branches remain conservative without activating fake browser states. Adopted sheets remain unknown because recipients outside the inspected root cannot be proven.

Source/rule identifiers are presentation identities from each source-index instance. Across UI reactivation, the ledger's exact native capability remains authoritative; fresh IDs are accepted for attribution only after they resolve to the same original native objects.

## Verification

| Check | Final result |
| --- | --- |
| `pnpm typecheck` | passed |
| `pnpm test` | 251 passed in 17 files |
| `pnpm build` | passed, Chrome MV3 production bundle, 1.11 MB |
| Actual built-Chrome regressions | 199 passed in 5.3 minutes, no failures or retries |
| Raw pointer performance | 1,000 events; zero mutation analysis, selector generation, reconciliation, source scans, cascade resolutions and locator requests |

Q01–Q04 are fixed, not merely detected. Q05 remains the sole deferred policy counterexample in the retained evidence. Existing safety, editing and zoom regressions passed. The extension still declares only `activeTab` and `scripting`, without host permissions.

The final focused command covers the actual `.output/chrome-mv3` extension:

```text
pnpm test:e2e tests/e2e/mutation-conflicts.spec.ts tests/e2e/mutation-audit.spec.ts tests/e2e/author-mutation.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/source-index.spec.ts tests/e2e/cascade.spec.ts tests/e2e/selectors.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/editing.spec.ts tests/e2e/code-html.spec.ts tests/e2e/extension.spec.ts tests/e2e/picker-performance.spec.ts
```

The run contains 199 cases: 48 corrected audit cases, 24 focused conflict cases, 48 existing author-mutation, 29 reconciliation, 2 source-index, 2 cascade, 18 selector, 14 locator, 2 target-hardening, 4 Design editing, 4 Code/HTML, 3 extension integration and 1 picker-performance case. It includes Undo/Reset, media/pseudo, open-shadow editing and actual 200% Chrome zoom.

Unit additions: `tests/mutation-conflicts.test.ts` (15 cases), covering selector union/deduplication, terminal states, unsupported states, adopted scope, element/branch/string bounds, live ledger reattachment, explicit retirement, same-Document root replacement and cross-document refusal. Native CSSOM semantics and synchronous page callbacks are exercised in actual Chrome rather than fabricated unit CSSOM.

The Q01–Q04 characterization assertions were converted to corrected expectations. M07 and Q34 now explicitly authorize conservative pseudo scope. The existing M44 clean-restoration fallback is preserved, including accurate restored-state messaging. A new large-root fixture uses hidden filler nodes to exercise the traversal budget without introducing unrelated tall-page geometry into the fixture.

Evidence is written to `artifacts/diagnostics/mutation-conflict-fixes/` (`Q01`–`Q48`, `F01`–`F24`). The locked audit report and `artifacts/diagnostics/mutation-audit/` remain unchanged.

## Affected files

Production:

- `src/engine/mutation/index.ts`
- `src/engine/mutation/model.ts`
- `src/engine/mutation/scope.ts` (new)
- `src/engine/mutation/ledger.ts` (new)
- `src/editing/session.ts`
- `src/editing/readable.ts`
- `src/picker/controller.ts`
- `entrypoints/content.tsx`

Tests/docs: `tests/mutation-conflicts.test.ts`, `tests/e2e/mutation-conflicts.spec.ts`, shared test-only `tests/e2e/mutationHarness.ts`, corrected `tests/e2e/mutation-audit.spec.ts`, the narrowly adjusted pseudo case in `tests/e2e/author-mutation.spec.ts`, this report and new evidence files.

## Deferred work and limitations

Q05 is unchanged: token scope still reports direct selector recipients, not inherited/computed dependency impact. Its characterization continues to reproduce the known limit; no `var()` evaluator or dependency traversal was added.

Blocked normal records still require their entire exact applied declaration block to be restored before retry. Unknown/unsupported contexts and unsafe shorthands retain conservative fallback. Permanently replaced native sources remain explicitly retired/unavailable in bounded recovery history; the engine never searches for similar replacements or forces their rollback. Document loss retires the old page's records rather than persisting native references into a new page. Current attribution is checked on explicit source reads/Refresh, without a new automatic source observer.

Recommended 07.4C scope: a focused diagnostic pass on reentrant native callbacks, partial recovery with explicit inline additions/shorthand interference and browser document lifecycle edges. Keep Q05 dependency work separately deferred until explicitly authorized. Do not expand this into Changes/export or a new editing architecture.

ENGINE 07.4B COMPLETE. 07.4C has not started.
