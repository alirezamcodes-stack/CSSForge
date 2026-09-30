# Engine 07.3B — Safe author source mutation

CSSForge has one explicit, reversible live CSSOM mutation engine in `src/engine/mutation`. Existing Design and Code editing remains `SESSION_OVERRIDE` by default. There is no author-mode switch UI, source persistence, new rule insertion, export UI or visual redesign.

## Targets, authority and policy

`MutationTarget` carries Engine 07.0 source/rule/declaration identities, the exact native style/rule/sheet objects, owning Document/open ShadowRoot, authored value and priority, context ancestry, generation, writability state, mutation strategy, local-author certainty, scope metadata and rollback snapshot. Targets are privately issued and frozen; fabricated/replayed/stale bindings cannot authorize a write. Generated selectors never locate authored rules.

`editor.setMutationPolicy({ mode: 'SAFE_AUTHOR_MUTATION', allowShared: false })` explicitly enables safe author editing for the existing single-property Design/Code path. `editor.applyAuthor(targetId, property, value, options)` is an explicit engine caller API, independent of the default policy. Both paths share the same mutation engine and transaction history. Multi-property Design batches continue using the session layer. An existing enabled/disabled session declaration owns its property and keeps that edit in the session layer.

The engine prepares an exact target, then refreshes 07.0/07.1 evidence again immediately before applying. It checks the current selected DOM binding and EditContext, sheet/rule/style object membership, selector, grouping headers, sheet media/disabled state, owner/root identity, full declaration-block snapshot and generation. A stylesheet replacement, selector change, grouping change or external declaration change rejects the captured target. It does not search for a similar replacement rule.

The mutation cascade uses the unchanged 07.1 resolver without CSSForge overrides. Direct authored winner evidence must be certain, exact and non-inherited; inaccessible sources, limits, ambiguous/unsupported selectors, unresolved layers, motion and other uncertainty cause fallback. The standard readable-author result does not claim browser/user-origin equivalence. Open-root local declarations are permitted only when the sole completeness issue is the existing general `shadow-scope` notice, there is a direct local winner, and no host/slotted/part selectors appear in the indexed local sheets. Cross-boundary and inherited shadow provenance stays unsupported. This narrows authorization locally; it does not change 07.1's published uncertainty result.

Selected media ancestry and pseudo/state must match exactly. Active supported media, supports and named layer groups remain in place. Containers, nested relative selectors and unsupported contexts fall back; they are never lifted into a base rule. An explicit `inline: true` request may add a missing base inline declaration after the same certainty checks. Normal missing properties use session overrides.

## Writable sources and scope

Supported candidates are inline styles, readable same-origin `<style>`/linked CSSStyleRule objects, accessible open-root rules and adopted stylesheets. Cross-origin linked CSS is refused even if CORS makes it readable. Security-blocked/imported/unavailable sources, closed roots, iframe interiors and UA sheets are unsupported.

Readability is not writability. Writability starts unverified. For an existing property, a no-op exact value/priority setter probes CSSOM capability; explicit missing inline additions use removal of that nonexistent property. The block is checked again afterward. Only an accepted and independently verified intended write is marked writable/accepted. Throws and silent rejection never count as successful author writes.

Scope reports `target-specific`, `shared-rule` or `unknown`, a matched count, whether that count is bounded, and a local/shared/unknown risk. Matching uses the original authored selector in its root, with at most 512 visited elements. It does not generate selectors. Shared or unknown scope requires `allowShared: true`; otherwise only the selected element receives a session override. A 40-button fixture demonstrates both policies. Adopted sheets have unknown total scope because their native object may be shared with roots/documents outside this session, so they require explicit shared authorization. Counts in an unknown scope are lower bounds, not a claim of a full blast-radius census.

## Declaration writes and reversal

The engine writes only `style.setProperty(property, value, priority)` or removes that same property during rollback. It never writes author `cssText`, stylesheet text or selector text, and never inserts new author rules. Unrelated declarations, custom properties, selectors and group objects are retained. Value-only edits preserve the existing priority; an explicit empty/important priority changes it deliberately. Editing `color: var(--brand)` changes `color` and never chases `--brand`.

07.1 must identify an exact declaration, rather than a longhand inferred from a shorthand. A detached scratch CSSOM block checks whether the intended operation would change unrelated exposed declarations. Unsafe shorthand/longhand interactions fall back. The verification compares CSSOM declaration values/priorities rather than assuming inline and rule blocks serialize `!important` in identical order. Exact live before/after text fingerprints are retained for rollback conflict detection.

An accepted author edit creates one existing-history transaction with its source target, previous/new value and priority, strategy and generation. Unchanged values create no transaction. Migration creates no duplicate author transaction. Mixed session/author Undo restores the latest appropriate state; Reset restores author edits in reverse order and removes all session layers/ownership. Deactivation also attempts reversal.

Rollback requires the same source objects/context and the exact post-write declaration block. External changes are conflicts, including changes to unrelated declarations. Undo retains the conflicting transaction and reports the error instead of overwriting page changes. Reset restores independent reversible edits, clears all session editing ownership, invalidates prepared author requests and retains only blocked author history. Retrying after the exact expected page state is restored can complete cleanup. Deactivation attempts each remaining reversal; external replacement or a blocked rollback can leave existing author edits in the live page. It cannot restore a different stylesheet or force a page-owned conflict away.

If CSSOM throws after accepting the intended property, the engine attempts to restore only that property when unrelated state is unchanged. Safe fallback is permitted only after verified restoration. An irrecoverable/externally changed partial write is reported as rejected and cannot silently trigger a session fallback. No engine can guarantee reversibility after arbitrary external CSSOM changes or hostile setter behavior.

## Reconciliation and presentation

Author transactions and marker/session ownership are separate. A selected target with author history can use 07.3A's existing strong same-root replacement policy even when it has no enabled session layer. The replacement gets a fresh logical binding, but no inline author declaration is copied. A new edit recomputes provenance and can choose a different authored winner. Rule rollback addresses the exact original CSSStyleRule; inline rollback restores only the original DOM object's style, including when that object is detached. A live inline target moved across roots blocks rollback rather than authorizing a write across the captured boundary.

Author writes/rollback lazily invalidate cached source associations because a changed rule may govern other elements, including a migrated replacement. This invalidation does not scan CSS. Discovery remains on explicit consumer requests. Ordinary 07.3A target migration still uses its existing scoped invalidation behavior. Picker hover does not analyze mutations, sources, cascade or selectors.

Code receives `authored`, `session-override` and `cssforge-mutated-author` declaration metadata, refreshes authored values after writes/undo/reset, and passes exact displayed declaration identities to the shared author API. Its existing structure and styles are unchanged. Authored checkboxes remain disabled; temporary disabled UI never deletes an authored declaration.

## Tests and evidence

`tests/author-mutation.test.ts` verifies fabricated/foreign ownership rejection, target/property validation before source reads, and exact shorthand declaration names. Three added `tests/source-index.test.ts` cases verify native inline/rule/group bindings, selector changes, sheet replacement and refusal to use similar rules.

`tests/e2e/author-mutation.spec.ts` loads the actual unpacked production Chrome extension and independently reads page CSSOM. Test-only isolated-world access reaches the built editor without adding production globals. Diagnostics are saved in `artifacts/diagnostics/author-mutation/M01.json`–`M48.json`.

- M01–M04: existing/missing inline declarations, important priority, custom properties, unrelated state, Undo/Reset.
- M05–M13: embedded, media, pseudo, supports, layer, same-origin linked, adopted Document/open ShadowRoot and local open-root rules.
- M14–M19: 40-element shared scope, inaccessible sources, shorthand, unresolved layer, container and selected media mismatch.
- M20–M25: stale rule/sheet/value/selector/grouping and throwing CSSOM.
- M26–M30: replacement and fresh cascade after Undo, external rollback conflict, actual Design/Code integration, 1,000 raw pointer events, and variable provenance separation.
- M31–M39: explicit priority/no-op history, mixed transactions, bounded scope, unsafe missing longhand, original-object inline Undo, conflict retry, declaration identity mismatch, deactivation and authored disable protection.
- M40–M48: reset/selection/context generation safety, disabled sheet, partial/silent CSSOM rejection, readable CORS refusal, independent rollback despite another source conflict and live inline root-boundary protection.

Exact focused Chrome command:

```text
pnpm test:e2e tests/e2e/author-mutation.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/selectors.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/selection-audit.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/source-index.spec.ts tests/e2e/cascade.spec.ts tests/e2e/editing.spec.ts tests/e2e/code-html.spec.ts
```

## Limits and next engine work

This is live CSSOM mutation, not disk/server `.css` persistence. Shared or truncated scope needs explicit authorization; adopted sheets never claim a globally exact count. Unsupported/inherited/shorthand/contextual cases keep session fallback. External source conflicts intentionally block exact rollback, and loss of the original source does not authorize writing a replacement source. Closed roots, iframe interiors, new author rules, source maps, physical persistence, export/Changes UI, full AST editing and animation remain deferred. The next recommended engine work is a dedicated mutation-conflict and shared-scope audit before adding persistence or an author-mode UI.

## Final verification — 2026-09-30

- `pnpm typecheck`: passed.
- `pnpm test`: 236 passed across 16 files (five new mutation boundary tests and three additional native binding tests).
- `pnpm build`: passed; Chrome MV3 total 1.11 MB, content JavaScript 1.02 MB. Permissions remain `activeTab` and `scripting`; no host permissions were added.
- The exact focused Chrome command above passed all 140 cases in one final run: 48 author-mutation cases and 92 regressions covering 07.0–07.3A, Design/Code, history, media/pseudo, performance and actual 200% tab zoom.
- M29 independently measured 1,000 raw pointer events with zero mutation analyses/capability checks/writes, selector generation, reconciliation work, source scans, cascade resolutions and locator requests.
- Locked prior-phase diagnostic files were restored after verification. Only this phase's M01–M48 evidence is retained as new diagnostic work.

ENGINE 07.3B COMPLETE. No subsequent engine phase was started.
