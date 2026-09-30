# Engine 07.2A — Stable Target Locator + Safe Re-resolution

Date: 2026-09-30 (Europe/Berlin). Internal identity evidence only. No export selector, UI change, stylesheet mutation, frame injection, edit migration or mutation reconciliation was added.

## Model and lifecycle

One locator engine captures a versioned immutable snapshot at explicit selection. The snapshot records the original `targetLifecycle` binding (Element, document, root, session), evidence generation, namespace/tag, stable ID/attributes, semantic attributes, filtered classes, bounded ancestry/sibling evidence, and a structured open-shadow host/root chain. Frame identity is an explicit top-document placeholder; interior requests return `unsupported-frame`.

The locator is structured evidence, not an export selector or display label. CSSForge markers, generated edit IDs, inline styles, temporary ARIA state and text content do not contribute identity evidence. Root lookup strings are private implementation queries built from separately captured evidence.

An existing valid binding always returns `original-valid` with the original Element and performs no search. Explicit repicking refreshes the evidence generation. Cached capture is reused otherwise; an older refreshed generation or expired engine is unsafe.

On 07.1.5 target loss the existing quarantine/clear path remains authoritative. It invokes the locator resolver once and retains a read-only result. A successful result does **not** select the replacement or transfer markers, transactions, source/cascade caches, Code state or Design ownership. There are no new observers, polling, resolver frame loops, geometry hooks or source hooks.

## Evidence policy and resolution

- **Strong, conditional on uniqueness at capture:** same-root ID; application identifier attributes (`data-testid`, `data-test`, `data-id`, `data-key`, and application `data-…-id/key` names); meaningful semantic combinations; a unique stable ancestor plus corroborating target attributes/classes and target uniqueness inside that ancestor at capture.
- **Corroborating:** namespace/tag compatibility, name/type/role/ARIA label/link or media source, filtered class overlap and stable ancestor relationship.
- **Weak/non-authorizing:** tag alone, class alone, sibling position, text, visual labels and copied markers. Text is not read at all. Known transient/utility/generated classes, random/framework ID patterns, framework-internal data attributes and generic data attributes are excluded conservatively.

Resolution validates session, document and exact captured root chain first. It then uses the original object if valid; otherwise it progressively checks ID/proven unique attribute evidence, stable ancestor scopes, and bounded weak candidates. Candidate compatibility must retain captured namespace/tag and relevant identity/semantic attributes. Class order and recognized state classes are immaterial. Sibling index never authorizes identity.

Both authorization **and** uniqueness are mandatory. Duplicate IDs are a hard ambiguity veto. Non-unique testing labels cannot defeat a stronger unique application key, but cannot authorize a replacement alone. Multiple plausible compatible targets return `ambiguous`; no score or first-match fallback resolves them. A candidate unique only after an indistinguishable original disappears is not upgraded from weak evidence.

Results distinguish `original-valid`, `resolved-unique`, `ambiguous`, `missing`, `root-mismatch`, `document-mismatch`, `unsupported-frame`, `unsafe` and `truncated`, with Element only for successful states, confidence category, used evidence, candidate count, reason and rejected candidate reasons. These remain controller/engine data, not raw React presentation.

Bounds: 64 candidates per targeted query, 24 queries per capture/resolution, 8 ancestry levels, 12 shadow boundaries, 32 attributes/classes/sibling steps and 160 characters per evidence value. Oversized results are checked before candidate array materialization and return `truncated`. No wildcard `querySelectorAll('*')` or cross-root scan is used.

## Root safety

Root identity includes the actual Document and each actual open ShadowRoot/host boundary. Matching IDs in document, sibling roots and nested roots are distinct. A replaced/disconnected shadow host or changed host/root chain returns `root-mismatch`; this phase does not migrate to a new root instance. Closed boundaries return unsafe. Slotted elements retain actual light-DOM ownership; assignment/rendered position never invents shadow ownership.

An original moved to another root returns `root-mismatch`. An explicit proposed candidate in another root also returns `root-mismatch`. If only a fresh replacement exists elsewhere, ordinary lookup reports no safe candidate in the captured root; it does not search other roots to discover it. Document identity is object identity, not URL equality.

## Tests and measured outcomes

[locator.test.ts](../tests/locator.test.ts): 24 focused policy tests cover original authority/caching, unique and duplicate IDs, incompatible tag/namespace, application data, duplicate data, semantic combinations, class/state reorder, marker exclusion, repeated testing labels versus unique app keys, generation refresh, card ancestry/reordering, indistinguishable siblings, nested roots, missing/wrong roots/documents, unsupported frames, expired/quarantined sessions, search/capture budgets and closed ancestors. A small DOM double tests policy; browser tests verify native CSS queries and actual root handling.

[target-locator.spec.ts](../tests/e2e/target-locator.spec.ts): 14 tests inspect the **actual built extension** through its existing React context in Chrome's isolated world using test-only CDP code. No production test hook/global was added. L01–L14 evidence is stored under `artifacts/diagnostics/target-locator/`.

Built outcomes: unique ID, stable product ID, semantic combination, repeated-card ancestor and same-root open/nested-shadow replacements return `resolved-unique`. Duplicate ID/data and repeated class targets return `ambiguous`; incompatible tags and weak marker clones return `unsafe`; absent candidates return `missing`; excessive candidate sets return `truncated`; wrong-root/document/frame requests return their corresponding boundary states. All rerender outcomes retain cleared selection/Design/Code. Edited clones lose unsafe session CSS under existing 07.1.5 containment.

Built L01 measures 1,000 alternating raw pointer events: **0 captures, 0 resolver requests/searches/queries, 0 source scans, 0 cascade resolutions, 0 synchronous target geometry reads, 1 frame-coalesced target geometry read**. Valid-original resolution adds no search or query. Geometry changes do not regenerate evidence. Existing picker-performance coverage verifies the same separation after selection and teardown.

Commands:

```text
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e tests/e2e/target-locator.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/selection-audit.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/editing.spec.ts tests/e2e/code-html.spec.ts
```

Typecheck passed. Unit suite: **188 passed in 13 files**. Chrome MV3 build: **1.08 MB**, including 994.39 kB content script; permissions remain `activeTab` and `scripting`, without host permissions. Final browser suite: **41 passed (49.0s)** against the final build. Existing regression scope covers B1–B7, slot/candidate navigation, pseudo/media contexts, Design/Code editing and actual 200% zoom.

## Files

- `src/engine/locator/model.ts`, `evidence.ts`, `index.ts`: locator model, evidence policy and bounded resolver.
- `src/picker/controller.ts`: intentional capture, read-only loss/request result, cleanup and stats. Existing lifecycle policy is unchanged.
- `tests/locator.test.ts`, `tests/e2e/target-locator.spec.ts`, `tests/e2e/fixtures/target-locator.html`.
- `tests/e2e/picker-performance.spec.ts`: added zero-locator-work assertions.
- This report and new L01–L14 evidence. Locked prior diagnostic evidence is preserved.

## Limits and deferred work

Attribute/ID stability is a conservative application-evidence policy, not proof of arbitrary application intent. Unknown stable naming schemes, intentionally reused IDs, renamed semantic evidence, excluded UUID/hash patterns or excessive bounds may require explicit repicking. Strong conflicting evidence rejects convenience matches. No uniqueness claim is made on truncated evidence. Native targeted CSS lookup still has browser-internal cost on large roots; this is bounded result/query processing, not a universal wall-clock latency guarantee.

The resolver performs one loss-time attempt, plus explicit requests. It does not wait for an asynchronous framework replacement that appears later. Shadow-host/root replacement is not migrated. Closed roots, iframe interiors and the existing B1 synchronous copied-marker style-query interval remain unsupported/deferred.

**07.2B deferred:** original/export selector preservation, generation, ranking, compactness and copy UI.

**07.3 deferred:** mutation observation/retry policy, replacement reconciliation, editing/marker/transaction migration, source/cascade association and Code/Design restoration.

**ENGINE 07.2A COMPLETE.** Engine 07.2B was not started.
