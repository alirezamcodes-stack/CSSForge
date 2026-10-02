# Current CSSForge support contract

Current product contract for the Chrome MV3 extension. This document describes implemented behavior; it is not a roadmap or a claim of universal CSS support. Exact current run results belong in [the Phase 08B report](phase-08b-detailed-changes-copy-export.md); the earlier [project audit](current-project-audit.md) and [Phase 08A report](phase-08a-editing-truth-release-hardening.md) remain historical snapshots.

## Supported today

| Workflow | Contract |
| --- | --- |
| Activation / picker | Toolbar-activated inspection of ordinary top-document HTTP(S) pages; explicit picks, hover feedback and owned-UI exclusion. Browser/store/restricted pages are rejected. |
| Target ownership | Real Element/root identity governs edits. Stable evidence can authorize a unique same-root replacement during bounded reconciliation; classes/text/positions alone cannot authorize migration. |
| Design | Registered geometry, spacing, typography, display/opacity, background, border, positioning, box/text shadow and filter properties. Background layers, supported linear/radial gradients, shadow layers and presets use reversible transactions. |
| Controls | Browser-validated values, numeric units/conservative conversions, color formats/alpha and token drafts. Rejected drafts do not change the accepted page state. Enter/Escape/Undo follow the shared gesture contract. |
| Session editing | Target-specific owned stylesheet declarations, separate media/pseudo contexts, owned declaration toggles, grouped gestures and atomic supported batch edits. |
| Edit result | A recorded declaration is distinct from its effect. Supported active cascade evidence can show an edit winning or overridden; inactive contexts remain pending and uncertain effects remain unverified. Computed values are separate from override tokens. Status refresh does not add edit transactions. |
| Code | Inline CSSOM declarations, readable matching rules, priorities, source contexts, referenced read-only keyframes, supported cascade status and explicit Refresh sources. Editing supported values uses session overrides; adding properties uses the supported registry. |
| HTML / Navigator | Read-only bounded real DOM traversal, lazy branch expansion and selection/navigation; open shadow boundaries and assigned-slot navigation. No HTML source editing. |
| Changes / Undo / Reset | Current owned declarations grouped by logical target and separate contexts. First accepted transaction captures known pre-edit values; unproven originals remain unknown. Requested tokens, disabled state, provenance and shared effectiveness/browser values remain distinct. Undo reverses recorded transactions; Reset removes session overrides across edited targets and contexts. Counts describe edited elements and current declarations, not chronological events. |
| Copy / Export | Explicit Copy target CSS, Copy all CSS and local `cssforge-changes.css` download. Selector generation/validation occurs only during output preparation. Enabled session declarations retain their actual `!important` priority and nested media/pseudo contexts. Output and warning/omission counts are deterministic for unchanged current ownership. |
| UI assets | Bundled Geist Sans/Mono, centralized theme tokens and Lucide UI icons; packaged notices/licenses. UI font loading uses bundled data. |

## Partial / conservative

- **Source scope:** inline, readable style/linked/adopted sheets and nested CSSOM groups are indexed in supported roots. Per-scope limits are 50 sheets, 2,000 rules, 12 nested groups and 10,000 declarations; truncation is explicit. Code also bounds presented groups/declarations/keyframes.
- **Cascade:** readable author declarations only. Supported importance, inline precedence, flat named layers (including reversed important order), specificity, longhand expansion and inheritance are resolved conservatively. The result explicitly is not browser-equivalent.
- **Modern CSS:** imports are recorded without expansion. Containers/scopes, CSS nesting, anonymous/nested/conditional layers, logical-to-physical mapping, `all`, pending-substitution shorthands, revert keywords and complex state/shadow selectors can remain unresolved. UA/user origins, final `var()/calc()` substitution and animated/transition values are not resolved.
- **Contexts:** media discovery is based on readable matching source contexts, not a responsive device simulator. Hover/focus/active apply naturally; before/after style existing generated content. Choosing a context does not force it active. A pending conditional edit is not a failed edit. Simultaneous active states or media branches outside the chosen inspection context leave effectiveness unverified.
- **Open Shadow DOM / slots:** picking, local source indexing, editing and composed navigation work within accessible roots. Full host/slotted/encapsulation cascade provenance is incomplete.
- **Replacement:** recovery is bounded and requires strong unique identity evidence. Ambiguous, weak, late, cross-root or unsupported replacements are not guessed. Safe recovery of committed session ownership does not authorize a stale physical-owner draft.
- **Freshness:** source/cascade snapshots refresh at meaningful selection/edit/source lifecycle points or explicit Refresh. Unrelated CSSOM/media/DOM changes are not universally observed; raw pointer hover does not scan stylesheets or resolve cascades.
- **Visual result:** stronger authored `!important`, layout constraints, inheritance, motion and unsupported cascade cases can prevent the requested rendered result. Session editing does not automatically rewrite authors or escalate specificity.
- **Output:** generated selectors describe the current element and may change meaning after page changes; structural/attribute/class risks are reported. Exported selectors can have different specificity from the session marker. Blocked/unverified requests remain copyable with warnings, without promising the same rendered result. Disabled declarations are excluded. Shadow-root/unavailable targets, failed unique selectors and dormant author recovery records are excluded with explicit counts/reasons; flat CSS does not pierce shadow boundaries. Clipboard uses a trusted button gesture and the native API without additional extension permission; unavailable/rejected clipboard contexts report failure. Download uses a local Blob URL and cleans it up.
- **Original values:** ordinary Base values are captured from the pre-write inspection snapshot as inline-authored tokens or browser-computed values, not reconstructed original stylesheet source. Conditional originals are unknown when not proven. Undo removes rolled-back baseline records; a fresh first edit captures a fresh baseline. Review is current owned state, including an override whose token happens to equal its baseline.
- **Geometry:** selected dimensions and overlay positioning are available; this is not a ruler/measurement toolkit or continuous animation inspection.

## Not currently supported

- Persistent review/history, Redo, share links or saved sessions.
- Responsive device/viewport tooling, rulers, eyedropper/color sampling, asset management or animation tooling.
- General arbitrary stylesheet/keyframe editing, original source-file writes, HTML editing or a complete style-owner/effective-target workflow.
- Durable edits across deactivation, reload, navigation or browser restart. Selection changes and panel hiding preserve active session edits; Reset/deactivation remove them. The document-lifetime author recovery ledger is not persistent session storage.

## Platform limited

- Closed ShadowRoot interiors and iframe interiors are unavailable. A closed host or iframe element can be selected without access to its interior.
- CSSOM security can make cross-origin sheets unreadable. Indexing does not bypass browser access restrictions or prove writability.
- Browser internal/store pages and browser-rejected injections are unavailable with the current permission model.

## Not exposed in product

The native author-mutation engine implements explicit guarded inline/rule/adopted/same-origin CSSOM writes, source freshness, recipient scope, conflicts, rollback and recovery. Normal UI has no safe-author-mode control and defaults to session overrides. Existing source editing affordances do not imply original file persistence or arbitrary shared author writes. Custom-property dependent impact and other conservative mutation limitations remain; this phase does not widen author mutation scope.

## Browser and distribution boundary

Initial target: **Chrome MV3**. Phase 08A packaged verification uses Chrome **154.0.8037.93**. This is a tested runtime, not a declared minimum version. Lower Chrome versions, Firefox and other browsers are unverified. Native manual popover/top-layer APIs and the remaining runtime dependencies have not been validated together on a lower Chrome baseline; test-harness CDP extension loading is a separate requirement. No minimum-version manifest entry is guessed.

See [the release contract](current-release-contract.md) for permissions, local ZIP packaging, technical data/network observations and outstanding distribution requirements.
