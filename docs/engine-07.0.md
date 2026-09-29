# Engine 07.0 — CSS source index

`src/engine/sources` owns CSSOM discovery, identities, declaration extraction, supported selector-context matching and keyframe indexing. The picker owns one index per editing session. Design media discovery and Code's bounded presentation adapter consume the same cached selected-source snapshot. Session overrides are projected through the same typed source/rule/declaration model directly from current editing state, including disabled declarations; generated override style elements are excluded from author sources. No author styles are modified by the index.

## Model and scope

Sources distinguish inline, style, linked, adopted and session overrides. Accessibility is an explicit readable/security/unavailable union. A failed sheet remains in the model with its URL/label and no invented rules. Rule identities use CSSOM object WeakMaps, independent of selector text and current index path. Declaration identities combine rule identity and property name. Context identities derive from their owning group. Paths/order reflect the current snapshot; IDs last for the session, not across page reloads or replaced CSSOM objects. A stylesheet adopted in multiple scopes retains one sheet identity with a separate scoped occurrence.

Rules retain selectorText, declarations, nested children, ancestor contexts, CSSOM serialization and keyframe names/selectors. Declarations preserve CSSOM-authored values, units, custom properties, functions, priority, order and ownership. CSSOM already normalizes formatting, may reorder important declarations, and may discard duplicate or invalid authored declarations; original source text, comments and file line/column positions are unavailable. No computed-style values or cascade winners are substituted.

Media (including stylesheet media attributes), supports, layer, container, nested style and other exposed grouping ancestry are retained. Media/supports match flags are snapshot-time results when safely available; container/layer/unknown groups have no invented boolean. Inactive and disabled sources remain data. Terminal supported pseudo contexts reuse the existing matcher. Only media-only supported selector contexts can be edited through the current override editor; other group conditions remain read-only because that editor cannot preserve them.

The selected document/open shadow root and accessible ancestor scopes are indexed. Ordinary matching is restricted to the selected element's own scope. CSSForge-owned scopes are excluded. Closed roots, shadow host/slotted matching, inheritance, relative nested selector resolution, imported stylesheet contents and cascade/specificity resolution remain unsupported. Import rule text remains indexed and produces an explicit limitation notice.

## Cache and refresh

Per-scope snapshots and per-element matches are cached. Selecting an element, activating Code, or pressing Refresh deliberately invalidates the source cache. Repeated reads and Design/Code consumers share discovery; React renders and raw pointer events do not scan sources. Override updates project current session state without rescanning author sheets. Teardown releases caches. `getStats` counts scope scans for performance assertions and has no UI.

External CSSOM insertRule/deleteRule/replace, style text/attributes, stylesheet loads, changed media conditions or selector-affecting DOM changes require selection or explicit refresh. There is no polling or claim that MutationObserver sees all such mutations. Limits are 50 sheets, 2,000 rules, 12 nested groups and 10,000 declarations per scope, with explicit notices; Code additionally bounds rendered groups/declarations/keyframes. Shadow discovery queries only style/link nodes in relevant scopes, never all page elements.

## Verification

- `pnpm typecheck`, `pnpm test`, `pnpm build`.
- `pnpm test:e2e tests/e2e/source-index.spec.ts tests/e2e/code-html.spec.ts tests/e2e/picker-performance.spec.ts`.
- Engine unit cases cover authored declarations, source kinds, nested contexts, pseudo/media contexts, security failures, identities/deduplication, refresh/cache, shadow/owned scope isolation, session overrides, keyframes, relative selectors and inspection bounds.
- Native Chrome CSSOM verifies browser serialization and identity across insertion. Built-extension fixtures exercise Code's inline/style/linked/adopted/inaccessible sources, nested media/supports/layer/container contexts, variables, calc, keyframes, refresh and open shadow sources. Existing Code tests retain editing/toggle/undo/reset, media/pseudo behavior and narrow/200% zoom coverage. Hover instrumentation asserts zero scans during raw moves.

