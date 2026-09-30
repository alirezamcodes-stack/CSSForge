# ENGINE 07.4A — mutation conflict and shared-scope audit

Production behavior is unchanged. This audit adds built-extension diagnostic fixtures, characterization tests and evidence only. Engine 07.4B has not started.

## Findings

Four defects and one scope-metadata limitation were reproduced in actual Chrome with the production `.output/chrome-mv3` extension. The assertions for Q01–Q05 deliberately characterize current behavior; their passing status is evidence of the findings, not evidence that those defects were fixed.

| Issue | Reproduction | Root cause | Severity | Recommended phase |
| --- | --- | --- | --- | --- |
| Q01: selector-list scope undercount | Edit `#target, .other:hover` in base context without shared authorization; hovering another recipient shows the new value despite local/count=1 metadata | Mutation scope reuses cascade matching for the selected context, excluding other authored selector branches | high | 07.4B fix |
| Q02: rejected partial write has no recovery record | A native custom-element style callback changes color during an inline font-size write; API rejects, font-size remains changed, Undo/Reset cannot recover it | Recovery refuses when unrelated declarations differ; the rejection path creates no `AuthorChange` or session history | high | 07.4B fix |
| Q03: deactivation discards blocked history | Author edit, external color change, blocked Undo, deactivate/reactivate: authored edit remains, history becomes empty | Engine destruction clears active changes after failed rollback; session destruction unconditionally clears history | high | 07.4B fix |
| Q04: fresh external value still attributed to CSSForge | Author font-size=24px, page changes it to 21px, explicit source/cascade refresh reads 21px but declaration remains `cssforge-mutated-author` | Attribution checks declaration ID in active history only | medium | 07.4B fix |
| Q05: direct token match count understates computed impact | One parent `--token` edit changes six inheriting `color:var(--token)` descendants; scope remains local/count=1 | Scope describes direct selector recipients, without an inherited/dependent-impact qualifier | medium | later hardening |

### Q01 — authorization misses other selector-list states

Classification: **shared-scope**. Outcome **F** (broader affected scope than represented/authorized).

Fixture: `#target, .other:hover { font-size:18px; color:purple }`, one selected target and five `.other` buttons. Explicit safe author editing to 24px succeeds without `allowShared`. Metadata is `{kind:'target-specific', matchedCount:1, bounded:true, risk:'local'}`. Native hover on an `.other` button computes 24px; the rule has six potential recipients across its branches. Undo safely restores 18px.

Affected modules:

- `src/engine/mutation/index.ts:31` — `scope()`, especially context-bound matching at line 37 and authorization at line 73.
- `src/engine/cascade/matching.ts:6` — `selectorMatch()` intentionally answers applicability in the selected edit context. Its line 17 state filter is appropriate for cascade resolution, but insufficient for a whole-rule impact count.

Recommended fix: conservatively union potential recipients of every supported authored selector-list branch, deduplicated by element, within the existing scan budget. Keep cascade context matching unchanged. Unsupported branches and exhausted bounds must produce unknown scope, requiring explicit authorization. Add state-list and pseudo-element-list regression fixtures; do not weaken the current adopted-sheet unknown-scope rule.

Evidence: `artifacts/diagnostics/mutation-audit/Q01.json`.

### Q02 — synchronous page reaction strands CSSForge's own write

Classification: **transaction/history**, with a synchronous mutation conflict. Outcomes **D, H** (missing ownership history and inconsistent page/session state). This does not rely on monkeypatched CSSOM.

Fixture: a customized native button observes its `style` attribute. Its initial inline declaration is `font-size:18px;color:purple`. On the first native transition to font-size=24px, `attributeChangedCallback()` changes color to green. The author API returns false, `lastMutation.state='rejected'`, `undoCount=0`, active changes empty and successful-write counter zero. Native style is nevertheless `font-size:24px;color:green`. Undo and Reset leave 24px behind.

Affected modules:

- `src/engine/mutation/index.ts:116` — `restoreOwnDeclaration()` refuses restoration when any unrelated declaration differs.
- `src/engine/mutation/index.ts:136` — failed post-write verification rejects without a recoverable change record; active/history registration only happens after successful verification.
- `src/editing/session.ts:167` — only the `mutated` result creates author history.

Recommended fix: model attempted writes that changed native state but could not be safely restored as recoverable conflict records. Preserve before/attempted/current property snapshots and exact native identity. Restore only the intended property when ownership can be proven, preserving the page's color change; otherwise retain an understandable pending record. Never force a full declaration-block rewrite or turn this rejection into an unsafe session fallback. Include synchronous page reactions during apply and rollback in the subsequent fix tests.

Evidence: `artifacts/diagnostics/mutation-audit/Q02.json`.

### Q03 — blocked rollback becomes unrecoverable across toggle

Classification: **transaction/history**, **rollback conflict**. Outcomes **B, D, H**.

Steps: author font-size 18px→24px; externally change the same rule's color purple→green; Undo correctly refuses and retains one transaction. Toggle CSSForge off: the rule remains 24px/green. Toggle on and pick the target again: history and active changes are empty; Reset leaves 24px/green with no pending rollback information.

Affected modules:

- `src/engine/mutation/index.ts:163` — `destroy()` tries rollback, then clears active records regardless of the result.
- `src/editing/session.ts:304` — `destroy()` clears history unconditionally at line 309.
- `src/picker/controller.ts:242` — picker teardown invokes that destructive session lifecycle.

Recommended fix: retain unresolved author ownership/conflict records at a tab/session lifecycle boundary that survives deactivation, or implement an explicit deliberate-discard policy with accurate remaining-state reporting. A routine toggle must not silently erase the recovery ledger. Do not serialize stale native references as if valid after navigation; revalidate exact identity before any resumed rollback. Preserve the current refusal to overwrite newer page changes.

Evidence: `artifacts/diagnostics/mutation-audit/Q03.json`.

### Q04 — historical ownership mislabels current provenance

Classification: **stale provenance** (attribution, not a stale cascade winner). Outcomes **B, G**.

Steps: author font-size 24px, externally change to 21px, explicitly refresh sources and resolve cascade. Both source declaration and winner are correctly 21px; the declaration is still labelled `cssforge-mutated-author`. Undo correctly refuses and retains the historical edit.

Affected modules:

- `src/engine/mutation/index.ts:160` — `declarationState()` tests only active declaration ID.
- `src/editing/readable.ts:10` — `presentSource()` carries that state into the current declaration.
- `src/ui/code/LiveCodeView.tsx:51` — the resulting state/tooltip claims current CSSForge author mutation.

Recommended fix: distinguish current declaration attribution from retained transaction ownership/conflict. At explicit reads, verify the live declaration's identity, value and priority against the applied snapshot before marking it as currently CSSForge-mutated. Retain blocked history separately. No permanent source observer or pointer-path checks are required.

Evidence: `artifacts/diagnostics/mutation-audit/Q04.json`.

### Q05 — direct match scope is not computed dependency scope

Classification: **shorthand/custom-property**, **shared-scope metadata limit**. Outcomes **A, F**. The direct selector count is correct; this is not a wrong-source mutation or a broken token Undo.

Fixture: `#target { --token:green }` on a section with six `.dependent` descendants using `color:var(--token)`. Picking the section itself and author-editing the token to purple succeeds with direct count=1/local metadata. All six descendants become purple. Undo restores the token and all descendants to green.

Affected modules: `src/engine/mutation/index.ts:31` and the scope contract in `src/engine/mutation/model.ts:7`. The count only covers elements matched by the declaration's selector. It does not bound inherited/custom-property dependent effects.

Recommended later hardening: explicitly identify scope as direct selector scope and mark computed dependency impact as unknown for custom properties/inherited effects. Apply a conservative authorization policy if local risk is intended to guarantee no other computed recipients. Do not introduce a full `var()` evaluator, token-definition search or unbounded dependency traversal.

Evidence: `artifacts/diagnostics/mutation-audit/Q05.json`.

## Conflict policy and safe outcomes

- **A — safe rollback:** unchanged exact sources, repeated same-property edits, several declarations on one rule, shared edits from different selected targets, explicit shared authorization, supported contexts, insertRule order changes and reconciled replacement histories restore correctly in the tested cases.
- **B — detected conflict/refusal:** external values, unrelated declaration changes, removed declarations, changed priority, external shorthands, deleted sources and replaced native rules/sheets preserve page state and retain history during the active session. Partial Reset restores independent edits and removes session layers; a blocked record can be retried after the exact applied native state is restored.
- **C — newer page state incorrectly overwritten:** no confirmed case in this audit.
- **D — lost/missing history:** Q02 and Q03.
- **E — wrong native rule/declaration:** no confirmed case. Prepared and previously applied bindings refuse similar replacement sources rather than searching for a matching selector.
- **F — scope mismatch:** Q01; Q05's distinct computed-impact limitation.
- **G — stale provenance:** Q04 attribution. Fresh cascade values and replacement source association otherwise remained correct in these fixtures.
- **H — inconsistent state:** Q02 and Q03.

The rollback policy is intentionally conservative: it compares the entire declaration block plus the edited property's value/priority and validates exact native membership. A page-only color change therefore blocks rollback of CSSForge's font-size edit. This is an intentional safety limit, not evidence of a wrong overwrite. This audit does not recommend relaxing that guard generally.

CSSOM object identity remains decisive. Q20–Q23 exercise invalidation between prepare and apply; Q43–Q47 exercise invalidation after a successful mutation and before Undo/Reset. `insertRule` index shifts preserving the exact native object are accepted (Q24, Q48). Chrome's style-owner DOM reorder recreates the native sheet in Q25, so fallback is correct. No similar-rule relocation was observed.

Reconciliation preserves logical history without assuming the same source winner: Q38 replaces a target with a different important winning rule, refreshes source/cascade/selector association and writes/undoes the new exact rule independently. Q39 preserves an external change after migration. Q40 records two migrations and three selector generations for A→B→C. Q41's synchronous native replacement restores the detached original and leaves the replacement's 21px untouched.

Intentionally unsupported: mutation of an inherited token definition through a child selection (Q32), container contexts and unresolved anonymous layers (Q36–Q37), and destructive authored shorthand rewrites (Q26–Q30). Session fallback remains conservative where supported. These do not warrant new product functionality in 07.4B.

## Requested-category coverage

| Category | Diagnostic cases |
| --- | --- |
| 1. External mutation after author edit | Q03–Q11, Q17–Q19, Q31, Q39, Q43–Q47 |
| 2. External mutation before Undo | Q03–Q11, Q19, Q31, Q39, Q43–Q47 |
| 3. External mutation before Reset | Q06–Q11, Q17–Q18, Q31, Q43–Q47 |
| 4. Same declaration twice | Q16, Q19 |
| 5. Same declaration from two selected elements | Q15 |
| 6. One/several/many selector matches | Q12–Q14 (1, 4, 50) |
| 7. Explicit shared authorization | Q12–Q15, Q17 |
| 8. Shared edit followed by Undo | Q12–Q15 |
| 9. Shared edit then external change | Q17 |
| 10. Rule object replaced after provenance capture | Q20–Q22, Q43–Q45 |
| 11. Stylesheet object replaced | Q21, Q23, Q44, Q46 |
| 12. Rule moved/reordered | Q24–Q25, Q48 (index shift and owner reorder; native survival recorded) |
| 13. Declaration removed | Q08; source deletion Q47 |
| 14. Declaration value externally changed | Q04, Q06, Q17, Q19, Q31, Q39 |
| 15. Important added/removed | Q09–Q10 |
| 16. Shorthand/longhand interactions | Q11, Q26–Q30 |
| 17. Custom property/dependents/inheritance | Q05, Q31–Q32 |
| 18. Media activation changes | Q33 |
| 19. Pseudo context | Q01, Q34 |
| 20. Layer/supports/container | Q35–Q37 |
| 21. Replacement during/after author write | Q38–Q41 |
| 22. Reconciliation followed by Undo | Q38–Q40 |
| 23. A→B→C replacement | Q40 |
| 24. Multiple transactions on one source rule | Q15–Q16, Q19 |
| 25. Reset after partial rollback conflict | Q18; lifecycle loss Q03 |

Additional Q02 tests native synchronous write reactions; Q42 tests 1,000 raw pointer moves. No permanent diagnostic listeners, production hooks or hot-path instrumentation were added.

## Verification

| Check | Result |
| --- | --- |
| `pnpm typecheck` | passed, including final diagnostic additions |
| `pnpm test` | 236 tests passed in 16 files |
| `pnpm build` | passed; actual Chrome MV3 production extension, 1.11 MB total |
| Focused actual Chrome run | 162 passed in 3.4 minutes |
| Production source diff | none |

Focused run breakdown: 48 new mutation-audit cases, 48 existing author-mutation cases, 29 reconciliation, 2 source-index, 2 cascade, 18 selector, 14 locator and 1 picker-performance case.

```text
pnpm test:e2e tests/e2e/mutation-audit.spec.ts tests/e2e/author-mutation.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/source-index.spec.ts tests/e2e/cascade.spec.ts tests/e2e/selectors.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/picker-performance.spec.ts
```

Diagnostic JSON files Q01–Q48 contain actual outcomes, expectations and state snapshots. Q42's 1,000 raw pointer moves perform zero mutation analyses, selector generations, reconciliation starts, source scans, cascade resolutions and locator requests. Existing picker performance checks also pass. No production hooks were added. The evidence `defect` flag marks policy counterexamples in Q01–Q05; this report separates Q05's metadata limit from the four recommended immediate defects.

Initial diagnostic-test failures were corrected by waiting for the reactivated inspector before retrieving its picker and clicking the parent section's padding rather than its child. The final complete run had no failures or retries. Existing locked-phase diagnostic outputs generated by regression tests were restored byte-for-byte; only the new mutation-audit evidence is retained.

Changed files: `tests/e2e/mutation-audit.spec.ts`, `tests/e2e/fixtures/mutation-audit.html`, this report, and `artifacts/diagnostics/mutation-audit/Q01.json` through `Q48.json`. All affected production modules identified above remain unchanged.

## Recommended 07.4B scope

1. Fix whole-selector-list authorization in Q01 while retaining bounded scans and unknown-scope fallbacks.
2. Retain and verify recovery records for unverified partial writes (Q02).
3. Preserve or explicitly resolve blocked author history across deactivation (Q03).
4. Separate current provenance attribution from historical author transactions (Q04).

Keep Q05 dependency-scope modelling as later hardening. Preserve exact native identity, current external-change refusal, shorthand fallback, supported context boundaries, lazy source invalidation and zero pointer-path engine analysis. Convert characterization expectations to corrected regression expectations only during the authorized fix phase.

ENGINE 07.4A AUDIT COMPLETE. Engine 07.4B has not started.
