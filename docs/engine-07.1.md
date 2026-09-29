# Engine 07.1 — readable author cascade

The resolver in `src/engine/cascade` consumes the unchanged Engine 07.0 source index. `CascadeResult` explicitly declares `scope: readable-author` and `browserEquivalent: false`. Per-property results retain matched, inactive and unresolved candidates, a tentative readable leader, a proven winner only within supported author data, loss reasons, importance effects, session edits, defaulting, and inherited provenance. Authored declarations remain attached to each expanded longhand; computed values never substitute for author values.

## Supported resolution

- Specificity uses lexicographic ID/class/type tuples. It handles type, class, ID, attribute, pseudo classes/elements, selector lists, `:is`, `:not`, `:has`, zero-weight `:where`, and nth-child/nth-last-child `of` lists. Each matching selector-list branch contributes its own weight; functional lists use their maximum. Unknown syntax has no guessed score.
- Precedence compares importance, distinct inline precedence, flat named layer order (reversed for important), specificity, then indexed sheet/rule/declaration order. Layer ordering statements and repeated named blocks are supported. Nested, anonymous, or conditionally established layer order is unresolved.
- Session edits are separate source data but have their real **author-important** cascade strength: an attribute selector, plus the selected pseudo contribution. Inline important, earlier important layers, or higher-specificity author-important selectors can beat them. The session exposes its actual style element position among indexed author sheets, including author sheets inserted afterward and adopted sheets that follow regular sheets. Missing session position makes certainty unavailable.
- Browser CSSOM on a detached style object expands margin, padding, borders, background, font and other supported shorthand declarations. Each candidate retains its original declaration, property and value alongside its expanded property/value. No universal value grammar or computed-style sweep is involved. Mixed shorthand wins/losses are represented as mixed.
- Supported inherited properties include the surfaced typography properties, color, text shadow, common text/list properties and ordinary custom properties. The resolver walks accessible parents (bounded to 64), traces authored provenance, and keeps local declarations separate from ancestor declarations. A parent's important declaration never competes directly with a child's normal declaration. `inherit`, `initial`, and `unset` defaulting are supported. Initial values are not invented. `revert`/`revert-layer` remain explicitly unresolved.

## Context, uncertainty and boundaries

Base combines ordinary declarations and currently active media/supports conditions. Terminal hover/focus/active contexts combine base with that one chosen state; before/after resolve their own declarations and inherit from the originating element. No state is forced. Selecting a media context retains unconditional rules and that branch's conditions; it never activates a false query or combines unrelated selected branches. Parent resolution uses Base rather than fabricating ancestor pseudo states.

Inaccessible sheets, imports, source truncation and known animation/transition declarations reduce confidence. Unknown container/scope/group conditions, nested or unsupported selector matching, logical-to-physical property mapping, unsupported layer ordering, `all` resets and pending-substitution shorthands stay unresolved. A tentative readable leader is not exposed as a proven winner in these cases. Disabled sheets/declarations and inactive media/supports cannot win.

This is not the full browser cascade: user/UA origins, presentational hints, animation/transition values, shadow encapsulation/slotting, closed roots, inherited computed-value conversions, and final `var()`/`calc()` substitution are not resolved. Custom-property declaration winners are distinct from substituted property values. Known `@property` registrations prevent ordinary-inheritance assumptions; script-only CSS.registerProperty registrations are not observable through this source index. Inheritance metadata is explicit, and unknown properties do not default to an invented inheritance policy. Namespaced/escaped and complex dynamic-pseudo selector matching remains conservative even where specificity can be calculated. CSSOM normalization and source-index limitations still apply.

## Integration and lifetime

The picker owns a cached resolver. Source refresh/selection invalidates source and cascade snapshots; edits and context changes invalidate cascade results without reparsing author sheets. Parent reads share the source index; repeated reads reuse results. Raw pointermove performs zero cascade resolutions and zero stylesheet scans. No polling or whole-document element scan is introduced.

Code keeps its layout and gains one compact scope/uncertainty summary plus declaration status tooltips (winning, overridden, inactive, mixed or unresolved). Design's computed, editor, inline-authored and override values are unchanged. Author CSS is never edited.

## Verification

Commands: `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:e2e tests/e2e/cascade.spec.ts tests/e2e/source-index.spec.ts tests/e2e/code-html.spec.ts tests/e2e/picker-performance.spec.ts`.

Unit cases cover selector tuples, lexicographic comparisons, source order, importance/inline/session precedence, layer reversal, inheritance/defaulting/custom properties, normalized shorthand conflicts, uncertain sources/contexts, mixed declaration status and caching. Native Chrome verifies actual CSSOM expansion, media/supports, pseudo isolation, inheritance, layers and source cache reuse. The actual built extension verifies statuses, edits, a session edit losing to a layered important declaration, later page-inserted CSS, explicit source refresh and inaccessible-source uncertainty. Existing focused regressions cover edit/toggle/undo/reset, source indexing, open shadow scopes, narrow viewport, real 200% zoom and hover/teardown performance.

Standards consulted: [Selectors Level 4 specificity](https://www.w3.org/TR/selectors-4/#specificity-rules) and [CSS Cascade Level 5 ordering](https://www.w3.org/TR/css-cascade-5/#cascade-sort).
