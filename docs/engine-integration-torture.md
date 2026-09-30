# ENGINE 07.4C — final engine integration and torture test

Scope: diagnostics and isolated synchronous transaction fixes. ENGINE 07.4B remains the baseline. No UI, new product features, dependency traversal, persistence, iframe interiors, or changes to the source/locator/reconciliation architecture.

## Confirmed defects and fixes

The first five cases ran against the existing built extension before production edits: T01, T02, T04, and T05 failed; T03 passed. Original observations are retained in `artifacts/diagnostics/engine-integration/reproductions/`.

| Reproduction | Root cause and observed result | Isolated fix |
| --- | --- | --- |
| T01 | A real native custom-element style callback synchronously entered a second author edit before the first committed history. The inner 24→30 record preceded the outer blocked 18→24 partial record. Undo order could not recover normally. | Exclude synchronous overlapping editor transactions; nested Boolean editing methods return false. |
| T02 | A native callback invoked Reset during apply, clearing selection/ownership and advancing generation before verification. A requested successful edit instead aborted. | Keep Reset/Undo/context changes out of an in-flight editing transaction. |
| T04 | Reset reentered while reversing the same author chain. Native values returned to 18px but one 24→30 record remained blocked. | One synchronous edit-session transaction covers rollback and history removal. |
| T05 | Direct engine reentry during the native capability probe accepted an inner mutation, leaving the outer transaction unverified. | Guard native author apply/rollback independently of editor callers. Reentrant engine writes reject with unsafe fallback disabled. |

Both guards use local synchronous flags and `finally`; no timers, polling, observers, queue, or new editing model. Teardown requested during a write is drained as that stack unwinds, restoring exact owned declarations or retaining existing conflicts. T12 verifies teardown and subsequent real extension action reactivation.

The first guard version also blocked legitimate synchronous reconciliation in the editor's post-write notification. T08 reproduced that regression, retained in `reproductions/T08-guard-regression.json`. The guard was narrowed: migration can run after native verification and history commit within the existing notification path, while its staging still excludes nested editing and cannot enter an active native author write. T08 and T11 cover both paths.

Production files changed in this phase: `src/editing/session.ts` and `src/engine/mutation/index.ts`. Other modified production files in the working tree belong to locked ENGINE 07.4B.

## Integration coverage

Each new case runs the actual `.output/chrome-mv3` extension through Chrome's extension action and reads its built controller in the extension isolated world. Native customized built-in button reactions are real browser callbacks. A test-only DOM event bridge allows those callbacks to synchronously invoke the built editor; it is not a production page API. Source replacement during a native CSSOM setter uses a one-shot test-only isolated-world wrapper, restored before the replacement operation. Ordinary external CSSOM changes and framework-style `outerHTML` replacement are also exercised without that wrapper.

| Area | New cases and required existing regressions | Result |
| --- | --- | --- |
| Synchronous apply, capability verification, Undo, Reset, session marker, migration and teardown | T01–T06, T10–T12; F08–F11, R28–R29 | Nested edits excluded; real page reactions preserved. |
| Partial recovery and mixed session/author ordering | T07–T09, T28; Q18, F08–F12, F21–F22 | Exact attempted property required for partial recovery; unrelated changes survive; conflicting records retained. Detached inline recovery only touches the original native object. |
| History bound | T13; F20 | 256 records retained. A callback at the final slot cannot insert another record. The next ordinary edit safely uses a session override; Undo/Reset restore the baseline without eviction. |
| Source replacement during apply verification, Undo and Reset | T14–T25, T33–T38; Q20–Q25, Q43–Q48 | Style text, delete/insert rule, adopted sheet replacement, replaceSync, owner node replacement and deletion refuse stale identity. New page values remain unchanged and current attribution is authored. Original native objects survive index-only insertion as covered by Q24/Q48. |
| Open Shadow DOM with adopted sheets and A→B→C migration | T26; Q38–Q41, F24 | Logical history retained, fresh source/cascade/selector binding used. External source conflicts block rollback until exact ownership is restored. |
| Multiple selected targets sharing a native rule | T27; Q12–Q17 | Explicit shared authorization, honest shared scope, one source identity, reverse Undo from another target, no exclusive target ownership claim. |
| Deactivate/reactivate, repick, loss, document replacement and delayed delivery | T12, T28–T29, T31; F13–F15, F23; reconciliation suite | Clean teardown drains edits; blocked partial history survives repeated toggles without duplication; document replacement retires the old ledger; late replacement after Reset does not migrate or revive styling. |
| Native hover/focus, pseudo and media switches | T30; author mutation contextual cases, Q33–Q37, Code/Design suites | Four independent native source records survive context/activation changes and restore in order. No fake-state mechanism. |
| Shorthands | Q26–Q30 and author mutation regressions | Margin, padding, border, background and font longhand edits conservatively fall back without rewriting author shorthands. |
| Q05 | Q05, Q31–Q32 | Direct scope remains internally consistent. Dependent impact is still deferred. |
| Pointer hot path | T32, Q42 and picker performance | 1,000 raw events add zero mutation analyses, reconciliation work, selector generation, source scans, cascade resolutions or locator work; tested both initially and after mixed-history recovery. |
| Design/Code, narrow layouts, targeting and zoom | Full focused set below | Pass, including real Chrome 200% tab zoom. |

## Verification

Final verification:

- `pnpm typecheck`: pass.
- `pnpm test`: 251 tests in 17 files pass.
- `pnpm build`: Chrome MV3 production build passes; 1.11 MB total, 1.03 MB content script.
- `pnpm test:e2e tests/e2e/engine-integration.spec.ts`: 38 pass, 59.6 seconds.

Final combined command:

```text
pnpm test:e2e tests/e2e/engine-integration.spec.ts tests/e2e/mutation-conflicts.spec.ts tests/e2e/mutation-audit.spec.ts tests/e2e/author-mutation.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/source-index.spec.ts tests/e2e/cascade.spec.ts tests/e2e/selectors.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/editing.spec.ts tests/e2e/code-html.spec.ts tests/e2e/extension.spec.ts tests/e2e/picker-performance.spec.ts
```

Windows uses `pnpm.cmd`. Final combined result: **237 passed (6.5 minutes), zero failures or retries**. This includes the 199 existing focused cases and all 38 new torture cases. Installed actual Chrome version: **154.0.8037.92**; test harness channel is `chrome`, not bundled Playwright Chromium. Manifest permissions remain `activeTab` and `scripting`, with no host permissions.

Evidence: 38 case JSON files, original reproductions, and `verification.json` under `artifacts/diagnostics/engine-integration/`. The 365 pre-existing artifact files were snapshotted from the current working tree, including uncommitted locked 07.4B evidence, before testing. All 365 were restored and byte-verified after the final run; earlier phase evidence is preserved.

## Remaining limits and freeze decision

- Q05 custom-property dependent-impact traversal remains deferred; local/direct scope is not a claim about indirect dependents.
- Existing conservative limits remain: 256 unresolved author records, bounded scope scans, unsupported/uncertain contextual or inherited author writes use safe fallback, and exact native identity is mandatory.
- Unavailable native source identities stay retained/retired rather than being relocated by selector text or force-restored. Replacing the document retires that ownership.
- Nested synchronous editing requests are excluded, not queued or replayed. Subsequent explicit actions work normally. No new scheduling behavior.
- The deterministic source-setter races use test-only instrumentation; they are not evidence that page-world prototype wrappers cross Chrome isolated worlds. Native custom-element reactions and ordinary CSSOM/replacement/lifecycle cases cover real browser behavior separately.

The current engine foundation is **ready to freeze within its documented conservative scope**. No unresolved new defect remains in the tested integration matrix. **ENGINE 07.4C COMPLETE.** No subsequent phase started.
