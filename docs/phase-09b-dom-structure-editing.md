# Phase 09B — DOM structure editing

## Baseline and architecture (recorded before implementation)

The authorized baseline is clean `main`, HEAD `d8e308f7ed50d14f83d5de808663d51ed5927408`, tagged `phase-09a-complete`. The user's amendment makes that the canonical completed Phase 09A baseline. The older `phase-09a` tag remains unchanged and is not a baseline for this work.

Phase 09A routes exact native Text ownership through a document-lifetime DOM ledger. `editing/session.ts` owns the only ordered history, including session CSS, author source writes and text. Native text rollback checks the original owner, root and Text object and expected value. Reset/deactivation retain blocked native records in the ledger. Target loss currently quarantines CSS ownership and may request strong reconciliation; that path must not interpret an intentional Delete as host replacement.

Phase 09B adds structural ownership records to the same ledger and transactions to the same session history. A domain resolver issues single-use plans containing native owner, parent, root, generation and exact adjacent Node anchors. Native API calls commit one operation; bounded subtree snapshots and exact gaps guard reverse operations. A narrow parent/subtree observer reports host conflicts without reapplying. Delete parks the original editing owner, releases its session layer, and clears selection without reconciliation; exact Undo restores its prior scopes and native object, requiring a user repick for selection.

Insert/Duplicate retain the current selection. A later explicit pick of the new native element receives fresh editing ownership. Structure rows group under the explicit operation's selected anchor, with the affected element and placement identified separately. No target identifiers, CSS scopes, text ownership, locators or reconciliation evidence are copied to a clone.

Changes receive bounded primitive projections; native objects remain in the domain/session. CSS export stays CSS-only with separate text and structure omission counts. Structural writes invalidate selector matches and cascade evidence without discarding indexed stylesheet scopes; fresh selectors are validated only when explicitly requested. HTML/Navigator continue reading the actual current DOM. Pointer paths do not resolve structure eligibility or snapshots.

## Domain and eligibility

`editing/dom/structure.ts` implements `DOM_INSERT`, `DOM_DUPLICATE`, `DOM_DELETE` and `DOM_REORDER`. Issued plans are frozen, single-use, and tied to the original logical target, generation, lifecycle identity, document/root, native owner, parent and adjacent **Nodes**. Before commit the domain checks both position and snapshot again. No locator, selector, class, text, label or child index grants write authority. Placement checks skip only exact native stylesheet Nodes registered as CSSForge-created metadata and picker-owned UI Nodes; host stylesheet/UI lookalikes remain real page anchors. CSS layer teardown or UI reactivation cannot invalidate an otherwise unchanged page gap. The session owns ordering and history; the DOM ledger's text and structure sets are ownership evidence, not separate Undo stacks.

The resolver reports supported plans or `UNSUPPORTED`, `UNAVAILABLE`, `STALE`, `CONFLICT` and native `FAILED` reasons. The UI prepares only at explicit menu/dialog boundaries. Critical document elements, scripts/styles/resource elements, SVG, custom/customized elements and discoverable shadow hosts, forms/controls, contenteditable ancestry, frame interiors and closed interiors are excluded. Ordinary descendants of a custom ancestor can be edited when their immediate container is ordinary. Accessible open ShadowRoots can serve as exact native parents. No cross-root/document movement is supported.

Whole-subtree limits are **128 nodes**, **depth 8**, **32,768 UTF-16 text/comment characters**, **256 attributes**, **16,384 aggregate attribute-name/value characters**, and **64 ancestry steps**. These deliberately cap native cloning, ownership comparison and retained rollback evidence for V1; exceeding a bound refuses the entire operation. No truncation is treated as authority. Snapshots contain exact native topology and bounded attribute/data primitives, ignoring only metadata proven owned by CSSForge on that exact source node. They never read or write HTML serialization.

## Operation contracts

| Operation | Commit and safe reverse |
| --- | --- |
| Insert | Native `createElement`, optional `createTextNode`, and `insertBefore`; allowlist `div`, `span`, `p`, `button`, `section`. Buttons get `type=button`. Before/after selected or first/last child use captured exact gaps. Optional text is literal. Cancel/Escape writes nothing. Undo removes only the unchanged exact created subtree at its owned position. |
| Duplicate | `cloneNode(true)` followed by one native insertion immediately after the selected owner. Refuses any ID/IDREF, inline event handler, URL/resource attribute or CSS `url()` in the bounded subtree. No ID rewriting, partial clone, component-state reconstruction or listener copying is claimed. Only proven owned marker attributes are stripped; host lookalikes remain. Undo checks exact clone identity, expected subtree and position. |
| Delete | Removes the exact selected native owner. Retains that same detached object and all descendants; listeners/native state survive restoration. Parks all existing editing owners in the bounded subtree and releases their CSS layers without clearing scopes. Selection clears; reconciliation is cancelled. Undo requires unchanged detached content and original parent/root with both original sibling anchors still forming the exact gap, then restores native identity and CSS scopes. Selection remains clear until explicit repick. |
| Reorder | Moves one selected element before its previous element sibling or after its next element sibling, within the same parent only. Text/comments may be crossed; the relative order of every other Node is preserved. Selection, logical ID and generation stay unchanged. Undo proves current placement and original gap, conceptually excluding only the exact moving Node. Boundaries create no transaction. |

The original subtree snapshots and both previous/next anchors are required for destructive Undo. Missing, moved or replaced anchors do not fall back to labels, selector matches or an index. Unrelated siblings outside the captured gap can change without gaining or removing authority.

## Host reactions, history and recovery

Narrow parent-child-list and owned-subtree observers compare recorded evidence. CSSForge drains only its own known-write records; page observers remain untouched. Same-task page reactions can change content, placement or anchors and produce visible pending conflicts. There is no observer-driven repair, reapplication loop, second transaction or reconciliation request for intentional removal.

Later owned edits mark earlier affected structural records `superseded`; their original evidence remains immutable. Undo is always strict and occurs only after later session transactions reverse. Reset and deactivation traverse the shared history in reverse order. Failed newer text/inline-author/structure ownership prevents destructive removal of an enclosing older creation, including the equal-baseline text case. Independent safe records can still reverse. Pending native records remain in the document-lifetime ledger across UI reactivation; reload/root replacement retires them. They are not durable saved sessions.

If a native Delete restores successfully but the page blocks recreating a CSS layer, Undo retains requested CSS history and reports the layer failure instead of throwing. Host restoration of a deleted object outside Undo is not treated as an authorized recovery transition. Existing strong reconciliation can still migrate CSS ownership when independently proven; it never redirects structure or Text authority to the replacement object.

## Changes, CSS output and inspection

Structure rows publish only bounded kind, affected element label, placement, state and reason, under the selected operation anchor's logical group. This published projection contains no native DOM references or HTML serialization. Undo removes its row. Insert plus later Text has one structural and one Text row, potentially in separate logical groups after explicit repick. Creation followed by exact owned Delete collapses the structural net to zero while keeping both Undo transactions. Reorders back to the first exact gap collapse; otherwise the latest move represents current placement. Ambiguous/conflicted records remain visible. CSS remains current owned declarations, not a timeline.

CSS export is unchanged in purpose: enabled supported CSS only, separate text and structure omission counts, no HTML/JSON/page export. DOM-only groups disable CSS output. CSS edited on a newly created element requires a fresh unique selector validated on the explicit copy/export request, and never exports an owned marker selector. Flat document CSS still cannot reach shadow-root targets.

Structure invalidates match caches (including `:nth-child`, `:empty`, `:has`, siblings and inherited chains) and cascade evidence while retaining indexed stylesheet scopes. Explicit Code/source refresh keeps its established broader invalidation. Selector generation remains explicit. A structural revision refreshes the bounded HTML/Navigator tree from the real DOM even when target ID is unchanged. Geometry and navigation availability refresh after supported moves. No parallel React DOM model is introduced.

## Accessibility and performance

Inspector actions use the existing keyboard menu and provide disabled reasons through `aria-describedby`. Insert uses the existing modal focus manager, labelled native selects/textarea, Insert/Cancel, status announcements and Escape/focus-return policy. Narrow viewport and actual Chrome 200% zoom are verified; the form scrolls within the existing surface bounds. Delete is the deliberate explicit action and introduces no extra confirmation ceremony.

The 1,000-pointer test compares structure eligibility/preparation/snapshot/ownership/write/projection counters, Text counters, source scans, cascade resolutions, locator/selector/reconciliation counters, author analysis, and Changes output preparation/serialization against idle. All deltas must be zero. Observers disconnect when their ownership records resolve, and only watched original parents/subtrees are observed.

## Verification log

- First domain unit run: 341 passed, 1 failed (342 total). The root-replacement check incorrectly relabelled retired evidence. Fixed the domain and reran: 342/342 passed.
- First built Phase 09B run, retries 0: 22 passed, 2 failed (24 total). Fixed structural tree refresh; replaced a hanging test-only callback adapter for native zoom with Chrome's promise API.
- Expanded explicit run, retries 0: 27 passed, 2 failed (29 total). The assertions needed to wait for modal focus wrapping and match Chrome's CSSOM-normalized `:has(> div)` spelling. Both explicit targeted reruns passed (2/2).
- First complete Phase 09B suite before the metadata-gap extension, retries 0: **32/32 passed** (1.1 minutes), including descendant ownership, all placements/non-element anchors, and committed replacement authority.
- First full pipeline: `pnpm typecheck` passed; `pnpm test` **343/343 in 22 files** passed; `pnpm build` passed; `pnpm zip` passed.
- Required current critical browser regression on the first packaged build: **403/403 passed** in 16.2 minutes, retries 0. This run used the first package; it does not cover the later reproduced metadata-anchor case.
- An additional focused native-shadow case reproduced a false conflict when CSSForge layer teardown removed a recorded layer anchor (0 passed, 1 failed, retries 0). Scoped structural gaps to skip proven native CSSForge metadata, added host-lookalike unit coverage (345/345 unit cases passed), and added page-end recovery coverage across UI lifetimes. The first 403-case run finished successfully on its original package. The corrected package and complete expanded 405-case regression subsequently reran successfully.

No failed run is counted as successful evidence. No automatic retries are enabled.

After the metadata fix, the expanded Phase 09B run passed 33/34 (1.3 minutes). Its remaining page-end test expected a conflict for a host insertion *after* the actual trailing Text anchor; the exact gap was unchanged, and safe deactivation correctly restored the node. A focused diagnostic rerun failed the same assertion (0/1). Corrected the fixture to remove its trailing whitespace before capturing the page-end gap, so its host insertion changes the actual gap. Both metadata tests then passed explicitly (2/2, retries 0). No production change was needed for that test expectation.

The critical command includes 29 files, keeps existing historical screenshot-capture cases excluded, and covers current functional P1/P2, hostile pages, focus, zoom, picker, sources/cascade, CSS, author mutation, text, structure, Changes/export, HTML/Navigator, identities and reconciliation:

```powershell
pnpm exec playwright test tests/e2e/phase-09b-structure.spec.ts tests/e2e/phase-09a-domain.spec.ts tests/e2e/phase-09a-text.spec.ts tests/e2e/phase-08b-changes.spec.ts tests/e2e/phase-08a-effectiveness.spec.ts tests/e2e/phase-08a-token.spec.ts tests/e2e/phase-08a-replacement.spec.ts tests/e2e/source-index.spec.ts tests/e2e/engine-integration.spec.ts tests/e2e/mutation-conflicts.spec.ts tests/e2e/current-ui-p2.spec.ts tests/e2e/author-mutation.spec.ts tests/e2e/mutation-audit.spec.ts tests/e2e/cascade.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/selectors.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/selection-audit.spec.ts tests/e2e/current-ui-p1.spec.ts tests/e2e/code-html.spec.ts tests/e2e/editing.spec.ts tests/e2e/rich.spec.ts tests/e2e/units.spec.ts tests/e2e/professional.spec.ts tests/e2e/extension.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/interactions.spec.ts tests/e2e/foundation.spec.ts --grep-invert 'captures five Phase 03|thirteen focused views|capture Phase 02' --retries=0
```

## Git and package evidence

No staging, commit, push, checkout, reset, clean or tag mutation was performed. HEAD remains the authorized baseline. Historical Phase 08A/08B/09A reports and audit evidence are unchanged.

| Classification | Final intended files |
| --- | --- |
| PRODUCTION (13) | `src/editing/changes.ts`, `src/editing/dom/index.ts`, `src/editing/dom/structure.ts`, `src/editing/session.ts`, `src/export/actions.ts`, `src/export/css.ts`, `src/picker/controller.ts`, `src/state/ui.ts`, `src/ui/changes/LiveChangesSurface.tsx`, `src/ui/html/LiveHTMLView.tsx`, `src/ui/inspector/LiveInspection.tsx`, `src/ui/text/StructureEditor.tsx`, `src/ui/text/inlineText.module.css` |
| TESTS (3) | `tests/dom-structure.test.ts`, `tests/structure-output.test.ts`, `tests/e2e/phase-09b-structure.spec.ts` |
| DOCS (3) | `README.md`, `docs/current-support-contract.md`, this report |
| GENERATED | Ignored `.output` production build/ZIP and `.preview` / `test-results` disposable test output. No generated file is intended for Git. |

The Chrome MV3 package still has version `0.1.0`, only `activeTab` and `scripting`, no host permissions or automatic content scripts, and both packaged font/license notice files. All six ZIP payload files matched the corresponding unpacked build SHA-256 byte-for-byte before the critical run.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.output/cssforge-0.1.0-chrome.zip` | 461464 | `DBDA29F340BAA41606CCC6D6325D394AFFA5AAE944F64E8EFCD05E655EDE7E39` |
| `.output/chrome-mv3/content-scripts/content.js` | 1083261 | `FFE7373319357819A004C780299F67C19DBE58C541A49D1F758DA951BE173FC9` |
| `.output/chrome-mv3/content-scripts/content.css` | 91422 | `2EA5E99868D0C188C3051A0973F036850EEF3CD47B27743ACE55758BC7AA7D43` |

The corrected build passed all **34/34 Phase 09B cases** (1.1 minutes, retries 0). Repeated the required pipeline in order: typecheck passed, **345/345 units in 22 files** passed, build passed, ZIP passed. All six final ZIP payloads match the unpacked output. The complete expanded **405/405 cases in 29 files passed** in **16.3 minutes**, retries **0**. Post-regression ZIP/JS/CSS hashes are identical to the table above. `git diff --check` passed (only normal LF-to-CRLF normalization warnings); new-file whitespace checks passed. No staged files or unintended tracked/generated changes exist.

Runtime evidence: Chrome **154.0.8037.93**, Node **24.19.0**, pnpm **11.19.0**, WXT **0.20.27**, Vite **7.3.6**, Vitest **3.2.7**. Browser compatibility beyond this tested Chrome runtime is unverified.

## Final executed browser counts

| Suite | Passed |
| --- | ---: |
| `author-mutation.spec.ts` | 48 |
| `cascade.spec.ts` | 2 |
| `code-html.spec.ts` | 4 |
| `current-ui-p1.spec.ts` | 16 |
| `current-ui-p2.spec.ts` | 15 |
| `editing.spec.ts` | 4 |
| `engine-integration.spec.ts` | 38 |
| `extension.spec.ts` | 2 |
| `foundation.spec.ts` | 7 |
| `interactions.spec.ts` | 8 |
| `mutation-audit.spec.ts` | 48 |
| `mutation-conflicts.spec.ts` | 24 |
| `phase-08a-effectiveness.spec.ts` | 8 |
| `phase-08a-replacement.spec.ts` | 3 |
| `phase-08a-token.spec.ts` | 6 |
| `phase-08b-changes.spec.ts` | 14 |
| `phase-09a-domain.spec.ts` | 5 |
| `phase-09a-text.spec.ts` | 27 |
| `phase-09b-structure.spec.ts` | 34 |
| `picker-performance.spec.ts` | 1 |
| `professional.spec.ts` | 3 |
| `reconciliation.spec.ts` | 29 |
| `rich.spec.ts` | 5 |
| `selection-audit.spec.ts` | 16 |
| `selectors.spec.ts` | 18 |
| `source-index.spec.ts` | 2 |
| `target-locator.spec.ts` | 14 |
| `targeting-hardening.spec.ts` | 2 |
| `units.spec.ts` | 2 |
| **Total — 29 files, zero retries, zero failures** | **405** |

## Final Git status

All 19 entries below are authorized Phase 09B work. No staging or commit was performed. Branch `main`, HEAD `d8e308f7ed50d14f83d5de808663d51ed5927408`, and both existing tags remain unchanged. `phase-09a-complete` is canonical; `phase-09a` still points at `142ce4f5bbc220c28ae53bca52d06c17225dbe07`.

```text
 M README.md
 M docs/current-support-contract.md
 M src/editing/changes.ts
 M src/editing/dom/index.ts
 M src/editing/session.ts
 M src/export/actions.ts
 M src/export/css.ts
 M src/picker/controller.ts
 M src/state/ui.ts
 M src/ui/changes/LiveChangesSurface.tsx
 M src/ui/html/LiveHTMLView.tsx
 M src/ui/inspector/LiveInspection.tsx
 M src/ui/text/inlineText.module.css
?? docs/phase-09b-dom-structure-editing.md
?? src/editing/dom/structure.ts
?? src/ui/text/StructureEditor.tsx
?? tests/dom-structure.test.ts
?? tests/e2e/phase-09b-structure.spec.ts
?? tests/structure-output.test.ts
```

The first packaged critical run passed 403 cases, the final corrected package passed all 405. These are distinct executed runs, not retries. Historical audit/Phase 08A/08B/09A tracked documents have no diff. Ignored production ZIP/build and disposable test artifacts remain local. Phase 09B is complete within the documented supported scope; no next-phase implementation has started.

## Remaining limits and next phase

No arbitrary HTML, cross-container moves, drag/drop, component editing, form editing, ID rewriting, closed-root discovery or persistent page builder is implemented. Native clone omits JavaScript listeners and framework component state. Previously unknown closed roots cannot be inspected or reconstructed. Conservative native ownership conflicts can require restoring the exact host state before rollback becomes safe. Insert/Duplicate keep selection; their subsequent edits are explicitly picked fresh owners.

With the final ownership/regression checks green, **Native Eyedropper** is the recommended next scoped phase: its explicit button gesture and asynchronous colour result can feed the existing draft/transaction workflow with a narrow cancellation/stale-target contract. Interactive pseudo-state forcing/simulation requires a separate feasibility review because current contexts describe conditional CSS without forcing page state, and simulated selectors can affect cascade semantics. Measurement/Layout Guides would require a broader overlay and multi-target geometry interaction contract. Neither alternative, nor the recommended phase, is implemented here.

This scope recommendation is an inference from the existing colour controls and transaction code. [Chrome's EyeDropper contract](https://developer.chrome.com/docs/capabilities/web-apis/eyedropper) documents feature detection, a user-triggered `open()` promise returning an sRGB colour, Escape cancellation and AbortController support. Those platform requirements map to a bounded future review of trusted gestures, stale targets and cancellation; they do not constitute CSSForge implementation or verification of screen sampling.
