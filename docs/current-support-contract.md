# Current CSSForge support contract

Current product contract for the Chrome MV3 extension. This document describes implemented behavior; it is not a roadmap or a claim of universal CSS support. Exact current run results belong in [the Phase 09B report](phase-09b-dom-structure-editing.md); the earlier project audit and Phase 08A/08B/09A reports remain historical snapshots.

## Supported today

| Workflow | Contract |
| --- | --- |
| Activation / picker | Toolbar-activated inspection of ordinary top-document HTTP(S) pages; explicit picks, hover feedback and owned-UI exclusion. Browser/store/restricted pages are rejected. |
| Target ownership | Real Element/root identity governs edits. Stable evidence can authorize a unique same-root replacement during bounded reconciliation; classes/text/positions alone cannot authorize migration. |
| Design | Registered geometry, spacing, typography, display/opacity, background, border, positioning, box/text shadow and filter properties. Background layers, supported linear/radial gradients, shadow layers and presets use reversible transactions. |
| Controls | Browser-validated values, numeric units/conservative conversions, color formats/alpha and token drafts. Rejected drafts do not change the accepted page state. Enter/Escape/Undo follow the shared gesture contract. |
| Session editing | Target-specific owned stylesheet declarations, separate media/pseudo contexts, owned declaration toggles, grouped gestures and atomic supported batch edits. |
| Inline text | Inspector menu → Edit text opens an owned editor for one exact direct Text child in a supported HTML element. Apply commits one transaction in the same CSS/text Undo order. Cancel/Escape writes nothing; Enter adds a line, Ctrl/⌘ Enter applies. Empty strings, spaces, Unicode/RTL and existing line endings are preserved. |
| Edit result | A recorded declaration is distinct from its effect. Supported active cascade evidence can show an edit winning or overridden; inactive contexts remain pending and uncertain effects remain unverified. Computed values are separate from override tokens. Status refresh does not add edit transactions. |
| Code | Inline CSSOM declarations, readable matching rules, priorities, source contexts, referenced read-only keyframes, supported cascade status and explicit Refresh sources. Editing supported values uses session overrides; adding properties uses the supported registry. |
| DOM structure | Inspector menu → Insert element, Duplicate, Delete, Move up/down. Bounded native operations share the CSS/text history. Original native objects, parent/root and exact sibling anchors authorize rollback. Insert/Duplicate keep selection; explicit repick gets fresh ownership. Delete clears selection without reconciliation; Undo restores the same native object and its prior descendant CSS/text owners. |
| HTML / Navigator | Bounded real DOM traversal, lazy branch expansion and selection/navigation; open shadow boundaries and assigned-slot navigation. Structural operations/Undo/Reset refresh the actual tree. No HTML source editing. |
| Changes / Undo / Reset | Current CSS declarations, DOM text and structure grouped by logical target. CSS contexts, captured baselines, requested tokens and effectiveness remain distinct; text includes exact original/applied/current values and ownership state. Undo follows one global transaction order. Reset removes CSS layers and attempts text/structure/author rollback in reverse order, retaining conflicts. Counts separate edited elements, current CSS declarations and DOM changes from event history. |
| Copy / Export | Explicit Copy target CSS, Copy all CSS and local `cssforge-changes.css` download. Selector generation/validation occurs only during output preparation. Enabled session declarations retain their actual `!important` priority and nested media/pseudo contexts. Output and warning/omission counts are deterministic for unchanged current ownership. |
| UI assets | Bundled Geist Sans/Mono, centralized theme tokens and Lucide UI icons; packaged notices/licenses. UI font loading uses bundled data. |

Text records appear in their logical Changes group with original/applied/current text, provenance and conflict/availability. Counts separate CSS declarations from DOM changes. CSS copy/export excludes all DOM text records and reports their omission count; DOM-only groups disable CSS output. Undo restores only the exact original Text/owner/root while its current data equals the applied string and its text semantics remain eligible. Reset/deactivation attempt safe text restoration, preserve host changes and retain unresolved document-local recovery records. No text is reapplied automatically. Navigation retires references; no session is persisted.

Structure rows add bounded operation, affected element, placement and ownership state to Changes. Exact creation/Delete and reorder-back net zero can collapse rows without removing Undo history. CSS export remains CSS-only with **separate text and structure omission counts**; DOM-only groups disable output. Structure grants no selector/replacement authority. Match/cascade caches refresh without rescanning indexed stylesheet scopes; explicit CSS output validates a fresh unique selector, including new or reordered elements.

Insert permits `div`, `span`, `p`, `button` (`type=button`) and `section`, before/after selected or first/last child, with optional literal text. Duplicate refuses IDs/IDREFs, inline handlers and resource attributes and strips only proven owned marker metadata. Subtree operations refuse unsafe platform/form/editable/custom/SVG/resource descendants and enforce 128 nodes, depth 8, 32,768 text characters, 256 attributes, 16,384 attribute characters and 64 ancestry steps. Reorder is same-parent only and preserves every other Node's relative order. Changed content, parents, roots or anchors block destructive Undo/Reset; pending document-local records preserve host changes across UI reactivation. Accessible open ShadowRoots are supported within these bounds; closed/frame interiors are unavailable. This is safe supported structure editing, not an arbitrary HTML/component/page builder.

## Partial / conservative

- **Source scope:** inline, readable style/linked/adopted sheets and nested CSSOM groups are indexed in supported roots. Per-scope limits are 50 sheets, 2,000 rules, 12 nested groups and 10,000 declarations; truncation is explicit. Code also bounds presented groups/declarations/keyframes.
- **Cascade:** readable author declarations only. Supported importance, inline precedence, flat named layers (including reversed important order), specificity, longhand expansion and inheritance are resolved conservatively. The result explicitly is not browser-equivalent.
- **Modern CSS:** imports are recorded without expansion. Containers/scopes, CSS nesting, anonymous/nested/conditional layers, logical-to-physical mapping, `all`, pending-substitution shorthands, revert keywords and complex state/shadow selectors can remain unresolved. UA/user origins, final `var()/calc()` substitution and animated/transition values are not resolved.
- **Contexts:** media discovery is based on readable matching source contexts, not a responsive device simulator. Hover/focus/active apply naturally; before/after style existing generated content. Choosing a context does not force it active. A pending conditional edit is not a failed edit. Simultaneous active states or media branches outside the chosen inspection context leave effectiveness unverified.
- **Open Shadow DOM / slots:** picking, local source indexing, editing and composed navigation work within accessible roots. Full host/slotted/encapsulation cascade provenance is incomplete.
- **Replacement:** recovery is bounded and requires strong unique identity evidence. Ambiguous, weak, late, cross-root or unsupported replacements are not guessed. Safe recovery of committed session ownership does not authorize a stale physical-owner draft.
- **Text scope:** nested elements, comments, multiple Text children and elements with no Text child are refused. Form values, contenteditable/rich-text surfaces, canvas, SVG and custom-element text hosts are excluded. Open shadow text requires the same exact local owner checks. Drafts are retired on logical/physical binding changes. Replaced Text nodes, including equal-string replacements, never inherit ownership. There is no DOM text rebinding or structure editing. Text is limited to 65,536 UTF-16 code units; newly inserted textarea line breaks use LF, unchanged original CR/CRLF regions are retained.
- **Freshness:** source/cascade snapshots refresh at meaningful selection/edit/source lifecycle points or explicit Refresh. Unrelated CSSOM/media/DOM changes are not universally observed; raw pointer hover does not scan stylesheets or resolve cascades.
- **Visual result:** stronger authored `!important`, layout constraints, inheritance, motion and unsupported cascade cases can prevent the requested rendered result. Session editing does not automatically rewrite authors or escalate specificity.
- **Output:** generated selectors describe the current element and may change meaning after page changes; structural/attribute/class risks are reported. Exported selectors can have different specificity from the session marker. Blocked/unverified requests remain copyable with warnings, without promising the same rendered result. Disabled declarations are excluded. Shadow-root/unavailable targets, failed unique selectors and dormant author recovery records are excluded with explicit counts/reasons; flat CSS does not pierce shadow boundaries. Clipboard uses a trusted button gesture and the native API without additional extension permission; unavailable/rejected clipboard contexts report failure. Download uses a local Blob URL and cleans it up.
- **Original values:** ordinary Base values are captured from the pre-write inspection snapshot as inline-authored tokens or browser-computed values, not reconstructed original stylesheet source. Conditional originals are unknown when not proven. Undo removes rolled-back baseline records; a fresh first edit captures a fresh baseline. Review is current owned state, including an override whose token happens to equal its baseline.
- **Geometry:** selected dimensions and overlay positioning are available; this is not a ruler/measurement toolkit or continuous animation inspection.

## Not currently supported

- Persistent review/history, Redo, share links or saved sessions.
- Responsive device/viewport tooling, rulers, eyedropper/color sampling, asset management or animation tooling.
- General arbitrary stylesheet/keyframe editing, original source-file writes, HTML editing or a complete style-owner/effective-target workflow.
- Durable edits across deactivation, reload, navigation or browser restart. Selection changes and panel hiding preserve active session edits; Reset/deactivation remove safe owned edits. Unresolved author/text/structure rollback records may remain only in memory in the same live document, preserving host changes. These recovery ledgers are not persistent session storage.

## Platform limited

- Closed ShadowRoot interiors and iframe interiors are unavailable. A closed host or iframe element can be selected without access to its interior.
- CSSOM security can make cross-origin sheets unreadable. Indexing does not bypass browser access restrictions or prove writability.
- Browser internal/store pages and browser-rejected injections are unavailable with the current permission model.

## Not exposed in product

The native author-mutation engine implements explicit guarded inline/rule/adopted/same-origin CSSOM writes, source freshness, recipient scope, conflicts, rollback and recovery. Normal UI has no safe-author-mode control and defaults to session overrides. Existing source editing affordances do not imply original file persistence or arbitrary shared author writes. Custom-property dependent impact and other conservative mutation limitations remain; this phase does not widen author mutation scope.

## Browser and distribution boundary

Initial target: **Chrome MV3**. Phase 08A packaged verification uses Chrome **154.0.8037.93**. This is a tested runtime, not a declared minimum version. Lower Chrome versions, Firefox and other browsers are unverified. Native manual popover/top-layer APIs and the remaining runtime dependencies have not been validated together on a lower Chrome baseline; test-harness CDP extension loading is a separate requirement. No minimum-version manifest entry is guessed.

See [the release contract](current-release-contract.md) for permissions, local ZIP packaging, technical data/network observations and outstanding distribution requirements.
