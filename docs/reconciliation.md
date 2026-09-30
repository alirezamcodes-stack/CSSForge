# Engine 07.3A — Target reconciliation and safe session migration

## State and authority

`src/engine/reconciliation` coordinates target loss outside React. Its typed result distinguishes active-original, waiting-for-replacement, replacement-resolved, migrated, ambiguous, missing, root-mismatch, unsupported, migration-rejected and retired. Resolution and ownership transfer are separate operations. The result retains the generation, attempt count, reason and original locator proof for diagnostics.

07.2A remains the only authority for replacement identity. Its implementation is unchanged. No generated selector, marker, tag/index, class-only evidence or text can authorize migration. The selector engine is unchanged and remains on demand. An unedited selection still follows the existing read-only locator/lost-target behavior; reconciliation retains state only for the currently selected session target with enabled or disabled overrides.

## Loss and bounded observation

Loss removes the old CSSForge layer, marker, marker guard and active editing ownership immediately. The pending record retains the existing override scopes, disabled declarations and history under the same logical target ID, guarded by a private session ticket. Design/Code may show the existing lost-target state while waiting.

The coordinator observes before its loss-time locator attempt. It chooses the nearest still-connected recorded ancestor inside the captured root, from at most eight selection-time ancestor references. Its temporary observer watches relevant child-list changes and a small identity-attribute filter in that region. Fallback Document/ShadowRoot observations watch direct child lists; shadow host parent child lists detect boundary loss without subscribing to their whole subtrees.

Only a bounded added subtree containing a plausible namespace/tag target, a relevant identity attribute change, or lost region/host triggers another locator attempt. Unrelated additions do not cause resolution. No CSS sources, cascade, selectors or geometry are read by candidate retries. There are no polling intervals, permanent observers or permanent frame loops.

Bounds: 1,200 ms; six locator attempts including the loss-time attempt; 64 records and 64 candidate nodes per delivery; 192 records and nodes across the window; eight recorded region ancestors; and 16 successful migrations per logical target. A successful migration performs one additional 07.2A proof check before committing ownership. Existing locator query/candidate bounds also apply. Deadlines are checked after resolution and around final authorization. Browser-native query duration itself is not preemptible.

Ambiguous, unsafe, truncated, document/root mismatch and unsupported resolution results stop the generation immediately. Missing results wait only for plausible bounded mutation opportunities. Expiration, budgets and cancellation disconnect observers/timers. Late insertions never reactivate an expired generation.

## Authorization and atomic ownership

Migration requires a current generation and pending session ticket; a strong resolved-unique locator result; one exact connected candidate; the same Document and exact supported root; compatible namespace/tag; no existing editing owner; and a session that has not been reset or deactivated. A shared editing-owner WeakMap prevents two editing targets/factory instances from claiming one DOM object. This is an ownership lock, not another identity system.

The old owner is already inactive. The session stages one new CSSForge layer and a fresh marker attribute for the replacement. It then checks the lifecycle/marker again and revalidates identity through 07.2A before committing. A native custom-element callback that creates ambiguity during marker assignment is rejected and the staged layer is removed. Style staging failure also leaves the session disconnected. No author inline attribute or stylesheet is copied or rewritten.

The new Target record replaces the old record under the same target ID, preserving scope maps, enabled/disabled states, media/pseudo context and transactions. The original lifecycle identity is forgotten, the original marker owner is retired, and the replacement receives the new binding. Old observer/guard callbacks check their exact Target record and become inert. Only bounded retired marker names are retained for later cleanup; old DOM objects are not accumulated by migration.

Reset removes current and retired marker copies, layers, ownership and history. Selecting another element, beginning an explicit repick, reset and deactivation cancel pending reconciliation. Each subsequent loss uses a new session ticket/coordinator generation, supporting A → B → C without stale A results changing B/C.

## History and engine/UI rebinding

Migration does not create a synthetic transaction. Undo addresses the new owner through the same logical target ID and restores previous CSSForge override/disabled state. Reset removes all session state. Undo during an unresolved pending transaction does not discard that transaction.

Sources and cascade invalidate the target, its bounded inherited chain and associated roots, rather than resetting all engine caches. Source discovery occurs after successful migration or explicit consumer requests. Old selectors are invalidated without generating a new selector. The next explicit selector request builds for the new identity.

Design reads the replacement's computed and authored values. The snapshot includes a scalar binding generation, and Code uses it to remount its source/editor association even when React batches the lost/recovered states together. This prevents stale authored source views and stale value editors while retaining the logical transaction ID. There are no layout, styling, new dialog, banner or export UI changes.

## B1 and limitations

The known same-task `cloneNode(true)` plus synchronous `getComputedStyle` interval remains: R16 observed 32px on the copied marker before observer delivery. After delivery/before paint the weak clone is unstyled, its marker is removed and it is never an authorized owner. A clone with independently strong unique ID evidence may migrate because of that locator proof, using a fresh marker; the copied marker contributes no authorization.

Closed roots, iframe interiors, changed/replaced ShadowRoots or hosts, cross-root moves and late replacements require explicit repicking. Weak/ambiguous/truncated replacements never receive the retained overrides. A reinserted original object that was already quarantined is not automatically restored under replacement-only authorization. Automatic migration stops after 16 successes for a logical target. Temporary original styling is quarantined while waiting, so a gap can be visible during delayed rerenders. Marker cleanup uses the existing root-scoped CSSForge marker queries; native DOM/query costs depend on page size.

07.3B author/source mutation, inline rewriting, stylesheet persistence, source maps, Changes/export, iframe transport, DOM editing, Animation/GSAP and AI remain deferred.

## Tests and diagnostic evidence

`tests/reconciliation.test.ts` covers active-original no-work behavior, resolution/transfer separation, observer retirement before transfer, hard rejection states, plausible-only retries, expiry, stale generation cancellation, record/retry bounds, changed roots, failed transfer, teardown and deadlines consumed by resolution.

`tests/e2e/reconciliation.spec.ts` loads the actual production extension in Chrome; test-only isolated-world inspection reaches the built picker without adding production globals:

- R01–R06: ID/data/strong semantic migration; class-only, duplicate ID and duplicate data rejection; new authored inline values; Design/Code and undo.
- R07: stable card ancestor, DOM reordering and refreshed source/cascade/selector association.
- R08–R11: same/next microtask, delayed task, expiry, irrelevant mutations and zero source/cascade work while waiting.
- R12–R15: A → B → C, preserved disabled/context/history, undo/reset, open/nested same-root migration, replaced host and cross-root rejection.
- R16–R20: B1 observation, weak marker clone, reset/repick/other-selection/deactivation cancellation.
- R21–R27: 1,000-event hot-path measurements, noisy record bounds, existing owner rejection, failed style staging, all-disabled transfer, retired marker cleanup, 16-migration cap and oversized subtree bound.
- R28–R29: synchronous native marker callback changes identity during staging; reset during quarantine leaves subsequent retired callbacks inert.

Focused regressions include source-index, cascade, locator, selector generation, targeting hardening, selection audit, picker performance, Design editing, Code/media/pseudo editing and actual 200% Chrome zoom. Four old integration expectations intentionally change from losing a strongly proven edited replacement to preserving its session; the underlying locator/selector policy tests and weak/unsafe/root-mismatch expectations remain intact. Revised A08/A13/L01 evidence is written into this phase's directory; prior phase evidence remains locked.

Diagnostics for R01–R29 live in `artifacts/diagnostics/reconciliation/`, except R20 deactivation, which is checked directly against the removed extension UI and unstyled late replacement. A08/A13/L01 integration evidence is also saved there. R21 records zero locator requests, reconciliation starts/resolutions, selector generation, source scans and cascade resolutions for 1,000 raw pointer events.

## Final verification — 2026-09-30

`pnpm typecheck`, `pnpm test` and `pnpm build` passed. Vitest reported 228 passing tests across 15 files. The final focused production-Chrome run passed all 92 tests: 29 new reconciliation cases and 63 regression cases, including 200% zoom. The MV3 build is 1.09 MB (content JavaScript 1.01 MB); permissions remain `activeTab` and `scripting`, with no host permissions. Test-generated changes to locked prior-phase diagnostics were restored after verification.

Exact Chrome verification command:

```text
pnpm test:e2e tests/e2e/reconciliation.spec.ts tests/e2e/selectors.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/selection-audit.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/source-index.spec.ts tests/e2e/cascade.spec.ts tests/e2e/editing.spec.ts tests/e2e/code-html.spec.ts
```
