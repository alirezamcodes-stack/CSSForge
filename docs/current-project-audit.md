# CSSForge current-state engineering and product audit

Audit date: **1 October 2026 (Europe/Berlin)**. Source baseline: **4f26023f058cf8825f571336035bf303d0f21eff**, `main`, `current-ui-v1`.

**Audit only. No production implementation, redesign, refactor, dependency update, commit, push, reset, checkout, or next-phase work was performed.**

Evidence order: current production source, current tests, current runtime, current configuration, then targeted documents and reference evidence. File/line anchors below are relative to `C:/Users/alire/Documents/ChatGPT/CSSForge`; they identify the audited baseline, not a proposed change.

Evidence labels:

- **SOURCE VERIFIED**: established by the current executable implementation or configuration.
- **TEST VERIFIED**: asserted by a current test; execution is stated separately. Merely collecting diagnostic observations is not verification.
- **RUNTIME VERIFIED**: observed in this audit's current build/run.
- **DOCUMENTATION ONLY / REFERENCE ONLY**: does not establish current production behavior.
- **INFERRED / UNVERIFIED**: a plausible risk or a boundary that was not established by runtime evidence.

“COMPLETE” means complete within the explicitly described supported scope. It never means equivalent to Chrome's entire CSS/DOM implementation.

## 1. Executive state of CSSForge

CSSForge is a working, action-activated Chrome MV3 extension for on-page element inspection and reversible visual CSS editing. It has real Design, Code, HTML, Navigator, and lightweight Changes surfaces. It uses a bounded CSSOM source index, a conservative readable-author cascade resolver, explicit DOM identity, separately generated selectors, strong-evidence replacement reconciliation, and an editing controller that owns page writes and history outside React.

The engineering foundation is substantially beyond the Phase 06.5 description in the README. Source indexing, cascade, locator, selectors, reconciliation, safe-author mutation, partial-write recovery, conflict ownership, and synchronous transaction guards all exist. **Engine capability must be separated from exposed product capability:** safe-author mutation is implemented and tested, but no current production UI action selects that mode.

The supported source/cascade and targeting foundations are **READY WITH NON-BLOCKING GAPS**. The current product is **NOT READY — BLOCKERS EXIST** for an unrestricted public release: an active session edit can be recorded/displayed as successful while a stronger authored important declaration keeps the page unchanged, without a visible effect-failure warning. This is a feedback defect, not incorrect engine ordering. Packaging and supported-browser release declarations also remain incomplete for store distribution.

No P0 destructive editing, security, or target-migration defect was established. This is not a proof that every site or browser is safe. Unit verification passes; the selected browser batch has 130 passes and one classified audit-environment failure. Full accessibility certification, universal modern CSS support, and the full 345-case browser suite were not established in this run.

## 2. Repository state

| Item | Observed state |
| --- | --- |
| Initial branch | `main` |
| HEAD | `4f26023f058cf8825f571336035bf303d0f21eff` |
| HEAD subject | `feat: complete structural and semantic UI refinement` |
| `current-ui-v1` | Same commit as HEAD |
| Local `origin/main` ref | Same commit as HEAD |
| Initial working tree | Clean; no tracked or untracked differences reported |
| Fresh remote fetch | Not performed; origin relationship is to the local remote-tracking ref, consistent with the user-provided verified remote baseline |
| Existing ignored generated directories | `.output`, `.wxt`, `node_modules`, `.pnpm-store`, `.preview`, `test-results` were present and ignored |
| Local-only implementation changes | None at audit start; none introduced by the audit |

Recent orientation was limited to the five known milestones: `4f26023`, `41d6e50`, `b3656a9`, `12dadef`, and `d17fe20`. No full history analysis or broad historical artifact/reference scan was performed.

The final tree is intentionally reported separately in section 28: existing tests regenerate tracked diagnostic JSON, and an interrupted audit helper left generated files. No attempt was made to reset or clean these outputs into a falsely clean status.

## 3. Current architecture map

| Subsystem | Actual ownership and principal modules |
| --- | --- |
| Extension activation | `entrypoints/background.ts:3`: action listener, per-tab pending guard, toggle message or first injection, restricted-page feedback |
| Content lifetime / host | `entrypoints/content.tsx:12`: document-lifetime author ledger; WXT runtime content script; ShadowRoot React mount; manual top-layer UI host; deactivate/pagehide/invalidation cleanup |
| Inspector / portals | `src/ui/App.tsx`, `inspector/InspectorShell.tsx`, `shared/Surface.tsx`, `popovers/Popover.tsx`; shared focus, placement, Escape and drag helpers |
| Picker / feedback | `src/picker/controller.ts:28`, `candidates.ts`, `frame.ts`, `overlay.ts`; transient hover remains outside React |
| Selection / target lifetime | `picker/targetLifecycle.ts`, `invalidation.ts`, `navigation.ts`; original Element and captured root are authoritative |
| Stable recovery identity | `engine/locator/index.ts`, `evidence.ts`, `model.ts`; capture strong evidence on explicit selection; bounded re-resolution only on loss/request |
| Exportable selector text | `engine/selectors/index.ts`, `escape.ts`; independent root-local native validation and explicit result states |
| Replacement reconciliation | `engine/reconciliation/index.ts`; bounded observer/window/generation; session controller stages and commits ownership migration |
| Source index | `engine/sources/index.ts:12`; readable CSSOM sources, exact native bindings, identities, contexts, notices and scoped caches |
| Cascade / specificity | `engine/cascade/index.ts:39`, `specificity.ts`, `layers.ts`, `properties.ts`, `matching.ts`, `status.ts`; per-property readable-author resolution and uncertainty |
| Session writes / history | `editing/session.ts:28`; target markers, owned stylesheets, context scopes, transaction grouping, Undo/Reset and migration |
| Author writes / conflict ownership | `engine/mutation/index.ts`, `scope.ts`, `ledger.ts`; provenance/writability checks, recipients, exact native snapshots, partial recovery, current attribution and historical ledger |
| Design / values | `ui/design/LiveDesignView.tsx`, `EditControls.tsx`, `SpacingEditor.tsx`, `RichBackground.tsx`, `RichEffects.tsx`; `editing/values.ts`, `conversionContext.ts`, `rich.ts`, `properties.ts` |
| Shared controls | `ui/shared/NumericScrubber.tsx`, `ColorControl.tsx`, `Icon.tsx`; shared engine-backed numeric/color behavior |
| Code | `ui/code/LiveCodeView.tsx`, `sourcePresentation.ts`; CodeMirror value drafts, source/session distinction, cascade status and explicit refresh |
| HTML / Navigator | `picker/tree.ts`, `ui/html/LiveHTMLView.tsx`; same bounded real DOM tree and navigation; Navigator uses a dedicated modal |
| Changes / Dock | `inspector/LiveInspection.tsx:32`, `dock/LiveDock.tsx`; real session count/actions; seven exposed dock controls |
| UI state / adaptation | `state/ui.ts`: Zustand presentation flags; `picker/context.tsx`: useSyncExternalStore adapter for controller snapshots |
| Theme / assets | `styles/tokens.css`; CSS Modules; `shared/useUIFonts.ts`: bundled buffer-backed fonts; Lucide icon wrapper |
| Preview / tests | `src/preview.tsx` mounts fixture UI independently; `tests/*.test.ts` and `tests/e2e/*.spec.ts` cover pure models, native source supplements and packaged MV3 behavior |

Data flow is concrete: action → content mount → picker selection → editor/source/cascade snapshots → React controls → controller transaction → stylesheet/native declaration → refreshed snapshots. DOM handles and native CSSOM capabilities are not persisted in Zustand.

## 4. Source-index engine audit

Primary evidence: `engine/sources/index.ts:12`, `model.ts`; `tests/source-index.test.ts`, `tests/e2e/source-index.spec.ts`. Unit source-index cases passed; the built-extension Code source case passed. The native-source supplementary case failed to import after the audit's Vite server crash, so its runtime result is not claimed as passing.

| Area | Classification | Established behavior / remaining limit |
| --- | --- | --- |
| Inline declarations | COMPLETE within CSSOM | Normalized declaration values, order, priority and custom properties retained (`index.ts:102`) |
| `<style>` / readable linked CSS | COMPLETE within bounds | Source kind, sheet/rule identity and order retained; accessibility is measured by reading CSSOM (`:44-77`) |
| Inaccessible CSS | COMPLETE representation; LIMITED BY PLATFORM content | Source/access reason retained; no invented rules; cascade certainty reduced |
| Adopted stylesheets | COMPLETE indexing in supported roots | Regular then adopted sheet order; repeated native sheet objects deduplicated (`:43-46`) |
| Nested grouping rules | PARTIAL interpretation | Group hierarchy/path/context retained; not every group's activation/precedence is understood |
| `@media` / `@supports` | COMPLETE snapshot interpretation | Native activation checks and sheet media retained; external condition changes need refresh |
| `@layer` | PARTIAL | Preserved; flat named ordering resolved; nested/anonymous/conditional ordering conservative |
| `@container`, `@scope`, unknown groups | LIMITED BY DESIGN | Context retained without guessing activation or scope semantics |
| CSS nesting | LIMITED BY DESIGN | Parent rule ancestry retained; relative nested matching unresolved |
| `@import` | LIMITED BY DESIGN | Import recorded but its imported contents are not expanded (`:62`); incomplete scope reported |
| Document scope | COMPLETE within readable-author scope | Ordinary matching constrained to the target's root |
| Open/nested ShadowRoot scope | PARTIAL | Accessible roots indexed; ordinary matches root-local; encapsulation, host and slotted cascade not fully resolved |
| Closed ShadowRoot | LIMITED BY PLATFORM | Interior excluded; host can still be inspected |
| Authored values / `!important` | COMPLETE CSSOM preservation | Units/functions/priority retained; not original file text, comments, duplicate declarations, byte formatting or source coordinates |
| Source order / exact binding | COMPLETE within bounds | Native WeakMap identities survive rule-path changes; binding rechecks native sheet/rule identity and selector (`:126-144`) |
| Bounds / uncertainty | COMPLETE explicit representation | Per-scope 50 sheets, 2,000 rules, depth 12, 10,000 declarations; exhaustion produces notices and lower confidence |
| Continuous freshness | LIMITED BY DESIGN | Selection, edit invalidation, Code activation and explicit Refresh; no universal source observer/polling |

Indexing a source does not prove safe writability, a winning declaration, or original source-file edit capability.

## 5. Cascade, specificity and inheritance audit

**COMPLETE within the supported readable-author subset; PARTIAL as a whole-browser cascade.** The result explicitly says `scope: readable-author`, `browserEquivalent: false` (`cascade/index.ts:120`).

Source- and test-verified ordering: importance → inline precedence → flat layer precedence → lexicographic specificity → source/rule/declaration order (`index.ts:10-19`). Important layer order reverses. Inline important is above author layered important. Current unit tests and the native cascade supplement passed.

Per-property results include winners, overridden/inactive/unresolved candidates, tentative readable leaders, confidence, loss reasons and session contributions (`index.ts:23-36`, `model.ts:14`). Mixed shorthand wins are not labelled a blanket winner (`status.ts:4`). Native CSSOM scratch declarations expand ordinary supported shorthands while preserving the original declaration's provenance (`properties.ts:13-24`).

Specificity supports `:is()`, `:not()`, `:has()` maximum argument weight, zero-weight `:where()`, and `nth-child/nth-last-child(... of ...)` selector contributions (`specificity.ts:50-77`; 32 current unit cases passed). Being able to calculate specificity is distinct from safely matching every such selector in an inspection context.

Ordinary surfaced inherited properties and custom properties have bounded provenance, `inherit/initial/unset` handling, and a 64-parent limit (`properties.ts:2-10`, `index.ts:112-139`). Parent important declarations do not compete with a local normal declaration. Unknown inheritance and indexed `@property` registrations remain uncertain. Script-only `CSS.registerProperty` is not discoverable here.

Unsupported/conservative cases include escaped/namespaced and shadow selectors, complex dynamic-state matching, relative nesting, logical-to-physical mapping, `all`, pending-substitution shorthands, `revert/revert-layer`, nested/anonymous/conditional layer order, imports, UA/user origins, presentational hints, animations/transitions and final computed `var()/calc()` substitution. Incomplete evidence withholds a proven winner rather than inventing one.

No supported-subset ordering defect was established. An ID-important or layered-important author declaration beating the session marker rule is correctly represented by the engine; the user-visible edit feedback defect is D01 below.

## 6. Selection and targeting audit

**COMPLETE in the supported top-document/open-root scope, with deliberate boundaries.** Evidence: `picker/controller.ts:28`, `candidates.ts:4`, `targetLifecycle.ts`, `navigation.ts`; current picker/targeting units and packaged targeting tests passed.

- Candidate collection combines composed event path, point hit testing and admissible ancestors; owned UI/feedback is excluded. Picking intercepts only the explicit primary-button gesture; ordinary inspection leaves host interaction enabled (`controller.ts:185-195`).
- Selection authority is the original Element plus document/root/lifecycle checks. Readable labels, CSS selector strings, text and marker attributes do not replace object identity.
- Selection-time computed inspection is distinct from hover geometry. Resize/mutation/scroll observations update geometry through a frame gate; unsafe/disconnected selections are cleared or quarantined.
- Same-root reparenting rebinds the bounded observation chain. Cross-root moves, root/host replacement, incompatible replacements and unsupported document/frame scope do not receive a blind edit.
- Open and nested open shadows work for picking and local editing. Slots follow a composed navigation policy: assigned nodes are reached through their slot while their real DOM root remains authoritative (`navigation.ts:2-26`). Current slot keyboard/ancestry tests exist; those exact P1/P2 cases were inspected, not rerun here.
- Iframes expose their outer element and an unavailable-interior boundary. Frame-local injection/selection is absent, including same-origin interiors. Closed roots expose their host, not private descendants.
- HTML/body are subject to normal lifecycle/admissibility checks and explicit target geometry; hostile transforms are addressed by viewport top-layer hosting, not mutation of the page's transforms.
- Escape cancels picking while preserving the previous selection; repick and explicit navigation cancel stale reconciliation generations. Inspector hiding preserves edits; full deactivate destroys runtime ownership and removes the session layer.

No unsafe migration from weak evidence was found. Geometry under unobserved distant layout changes remains a bounded-observation limitation, not proven universal tracking.

## 7. Stable locator audit

**COMPLETE conservative recovery policy.** `engine/locator/index.ts:6-105`, `evidence.ts`, `model.ts`; 24 unit cases and all 14 selected locator browser cases passed.

Locators capture evidence on explicit valid selection, not pointer movement. Root/document/open-host chains are retained as native objects. Strong keys include IDs, stable application attributes and corroborated semantic combinations; capture-time uniqueness is proved. Stable ancestor evidence must also have been unique and must still corroborate the candidate.

Resolution checks current root/host/document, tag/namespace and captured evidence compatibility, current uniqueness and optional proposed-candidate agreement. A superficially matching class/text/index or copied marker cannot authorize migration. Weak evidence can help locate candidates but returns `unsafe` if no strong capture-time authority supports them (`index.ts:94`). There is no heuristic “closest-looking” fallback.

Default bounds: 64 candidates, eight ancestors, 24 queries, 12 shadow boundaries (`index.ts:8`). Ambiguous/missing/unsafe/truncated/root-mismatch/document-mismatch/unsupported-frame are explicit states. Original-valid identity remains stronger than replacement inference.

## 8. Selector generation audit

**COMPLETE within explicit bounded generation; not internal identity.** `engine/selectors/index.ts`, `escape.ts`, `model.ts`; 25 unit and 18 selected browser cases passed.

Generation considers stable IDs/attributes, semantic evidence, minimal class combinations, ancestor assistance, then structural fallback. Native root-local validation proves uniqueness and that the result matches the current target. Identifier and string escaping are separate. Same-ID/different-root elements cannot validate a shadow selector accidentally.

Shadow selectors are a path of validated root segments, not a single selector that falsely pierces roots. Results distinguish unique/non-unique/invalid/unsupported/truncated and report strategy/stability. Structural selectors may be unique but unstable after DOM changes.

Limits include eight ancestors/eight shadow levels, six classes/six attributes, 24 combinations, 96 attempts/validations, 128 siblings and 2,048 characters (`model.ts:22`). Cached results are revalidated on explicit use. No selector work occurs on pointer hover, ordinary Design writes or Code edits; selectors are not used as authoritative target recovery.

## 9. Target reconciliation audit

**COMPLETE bounded conservative behavior; no confirmed stale-owner race.** Evidence: `engine/reconciliation/index.ts:13`, `model.ts:9`, `editing/session.ts:229-251`; 15 unit and all 29 selected browser cases passed.

The original owner is quarantined on loss. An observer is installed before the loss-time query; only a strongly resolved unique same-root candidate may stage migration. The window is 1,200ms, with six resolutions, per-delivery/total record budgets 64/192, node budgets 64/192, eight ancestor regions, and 16 migrations per logical target. No polling or perpetual recovery loop exists.

Generation checks invalidate stale callbacks. Observer/timer cleanup precedes committed transfer. Reset, repick, selection changes, deactivate, expiration, oversized mutation deliveries and host/root loss stop recovery. A replacement already owned by another editing target is rejected. A→B→C retains one logical session owner/history; copied markers do not grant identity; disabled declarations migrate as disabled.

R28/R29 protect synchronous ambiguity during marker staging and Reset during quarantine. Safe reconciliation of committed edits does not prove every focused React draft or pending gesture is replacement-safe; the Design binding-generation question remains INFERRED/UNVERIFIED in section 21.

## 10. Session editing audit

**COMPLETE core reversible override mechanism; PARTIAL universal visual effectiveness.** `editing/session.ts:115-173`, `markerContainment.ts`, `properties.ts`; current editing units and all four selected editing browser cases passed.

Default policy is `SESSION_OVERRIDE`. The session retains Element references, random collision-checked attributes, one owned style layer per target/root and scopes keyed by media plus pseudo context. Declarations are set through CSSStyleDeclaration, using important priority, rather than interpolating user values into a rule. Property removal/toggle affects only owned overrides.

Inputs use an explicit property registry and browser validation. CSS text separators/control characters and value-embedded important syntax are rejected (`properties.ts:20-24`). Inline important blocks the corresponding override; sizing is disabled for unsupported size boxes. Base/media/pseudo writes, multi-property atomic background transactions, gesture grouping, Undo/Reset, lifecycle cleanup and copied-marker containment are implemented.

Custom properties are inspectable and supported by the safe-author API, but are not in the ordinary session Design/Code property registry. The default exposed UI cannot freely add an arbitrary custom property. Media contexts and state selectors change the rule condition; they do not emulate a viewport or force state.

Important limits: the owned unlayered marker rule has ordinary author-important cascade weight. Stronger author-important rules, layered important declarations and browser motion/layout constraints can defeat a syntactically valid edit. D01 records the missing visible effectiveness feedback. Marker containment is bounded and fails closed on overflow, rather than guaranteeing arbitrary hostile scripts never create a transient match.

## 11. Safe author mutation audit

**PARTIAL current product capability: substantial tested engine, dormant user workflow.** `engine/mutation/index.ts:24`, `scope.ts`, `ledger.ts`; `editing/session.ts:174-201`, `:227`; all 48 selected author-mutation browser cases passed.

The engine supports explicit `SAFE_AUTHOR_MUTATION`, freshness/certainty checks, exact inline or style-rule declarations, same-origin readable linked CSSOM, adopted sheets, root-local open-shadow rules, important priority and custom properties. Linked editing changes live CSSOM, not a source file/server. Adoption is treated conservatively because a sheet may be shared beyond its current inspected root.

Safe mode selects the exact current winning source capability, checks supported context, native identity, writability and declaration snapshots, then records a transaction. Uncertain/inaccessible/stale/unsafe shorthand/cross-origin cases fall back only when a safe session fallback is permitted. Multi-property rich batches remain session transactions; safe mode does not turn arbitrary batches into several unreviewed author writes.

Native writes are checked after execution. Silent rejection creates no successful author transaction. Partial native writes are restored if ownership can be proved; otherwise one partial/blocked record survives with honest recovery state. Reentry guards exist independently at editor and native mutation layers. Author record capacity is reserved before writes; unresolved ownership is not evicted.

Undo/Reset restore only exact native ownership and retain conflicts. Current attribution verifies the live value/priority/source identity; historical ownership can survive an external change without claiming that the current value still belongs to CSSForge. Inline replacement recovery touches the original native Element, never a similar replacement's inline style. A document-lifetime ledger survives UI deactivate/reactivate for blocked recovery; document loss retires it.

**Deferred limitation still exists:** recipient counting measures selector matches, not dependent impact of inheritance or `var()` tokens. Q05 (`tests/e2e/mutation-audit.spec.ts:58-65`) characterizes one locally matched token declaration changing six inherited dependents without shared authorization. Source: `mutation/scope.ts:6-40`. This is P2 safety work before exposing a “local/safe author” product workflow, not an exposed default-session destructive defect.

Search found **no UI/entrypoint caller** of `setMutationPolicy`; only the API and test harness use it. Existing Code branches for author mode/custom properties are intentional dormant paths, not evidence that users can select author mode today.

## 12. Conflict and mutation safety audit

**COMPLETE existing conservative conflict mechanics; PARTIAL impact model.** Source: mutation native guards/ledger/scope and session exclusivity. Current `mutation-conflicts.test.ts` has 15 passing unit cases. Focused F/T browser suites exist and were inspected; an attempted additional execution was blocked by automatic approval review, so this audit does not claim those suites reran.

Selector-list recipients are unioned/deduplicated independently of the selected cascade context. Terminal state/pseudo recipients and adopted scope remain unknown until explicitly authorized. Traversal is bounded to 512 elements, 80 branches and 8,000 selector characters; exhaustion does not claim a complete local count (`mutation/model.ts:30`, `scope.ts`).

External changes are guarded by exact declaration/native source state. Ordinary author Undo requires the full applied declaration block to match; an unrelated external change may therefore conservatively block reversal. Partial recovery instead proves ownership of the attempted property and simulates restoration to reject shorthand collateral effects. It does not blindly restore a whole declaration block over the host's changes.

Synchronous native callbacks are not assumed inert: editor exclusivity and author-native busy guards exclude nested edits/Undo/Reset, and deferred teardown drains after the current stack unwinds (`session.ts:203-221`). Current F08–F24 and T01–T38 tests cover partial conflict, current-vs-historical attribution, reentry, source replacement, history capacity and document lifecycle. These tests are meaningful user-data protection, not just record-count checks.

The conflict state is visible through error text and existing Undo/Reset, but there is no detailed conflict-review/ownership product surface. No confirmed data-loss overwrite was found; custom-property dependency impact remains outside the model.

## 13. Undo, Reset and Changes audit

**Undo/Reset COMPLETE within session semantics; Changes PARTIAL; persistent History MISSING.** Evidence: `editing/session.ts:303-351`, `inspector/LiveInspection.tsx:32`, `EditControls.tsx:33`.

Undo reverses the latest transaction, including grouped gestures, disabled override state and mixed author/session ordering. Pending replacement history is protected until a proven owner exists. Repeated Undo walks history; stale/blocked author records remain recoverable rather than being silently discarded. Reset removes session layers/markers, cancels reconciliation, restores safe author records in reverse order, retains conflicting author ownership and resets editing policy/context.

Selection, task changes and inspector hiding preserve session edits. Deactivate removes ordinary overrides/history; only unresolved author recovery survives UI reactivation in the same live document. Navigation/document replacement retires native recovery. This is not persistent session storage.

The author ledger has a 256-record bound. The general session `history` array has no explicit cap: repeated ungrouped edits can grow it for the lifetime of an activation. This is source-verified maintenance/performance debt; no measured long-session slowdown or data loss was demonstrated.

Changes reports real edited-element count, current-session wording, Undo, Reset and Close. It explicitly says detailed review and export are unavailable. There are no grouped before/after diffs, per-change revert, copy/export, saved sessions, persistent timeline or redo UI. Fixture diffs in the independent preview are not live product history.

## 14. Current UI surface audit

| Visible surface/control | Classification | Actual event/action/data path |
| --- | --- | --- |
| Picker / cancel / repick | Connected and functional | Dock/header → picker start/cancel; real candidate/selection |
| Header identity/dimensions/font | Connected and functional | Selection snapshot → real identity/geometry/computed font |
| Parent/child actions | Connected and functional | Picker composed navigation; disabled when absent |
| Header Navigator/menu/hide | Connected and functional | Zustand surface/visibility; menu session actions invoke editor |
| Design/Code/HTML tabs | Connected and functional | Roving keyboard tabs → correct real live surface when selected |
| Media/state contexts | Connected but bounded | Editor context; discovered readable media; actual CSS pseudo selectors |
| Design fields and choices | Connected and functional within registry | Numeric/color/token/choice → editor apply/applyBatch → owned CSS |
| Rich layers/presets/sliders | Connected and functional with limits | Structured parser → atomic/session writes; unsupported syntax preserved |
| Code source/declarations | Connected but bounded | Central source snapshot/cascade → normalized CSSOM rows; supported edits |
| HTML/Navigator | Connected but bounded | Lazy real DOM handles → expand/navigation/selection/Refresh |
| Changes | Connected but partial | Real count/Undo/Reset; detailed review/export explicitly unavailable |
| Measurement dock popover | Presentation-only readout | Selected dimensions; no ruler, distance or measurement gesture |
| Dock More/visibility/power | Connected and functional | Existing surfaces/inspector toggle/full deactivate |
| Hidden palette/assets/eyedropper tools | Intentionally hidden/dormant | Fixture-only dock variants are not live controls |
| Safe-author mode selector | Missing | API/state branch exists; no production user action selects it |

No exposed fake AI/chat workflow or populated fixture Changes/DOM data was found in the live selection path. Empty Code/HTML states retain stale “not connected yet” copy in `LiveInspection.tsx:29`; this is reachable wording debt, not absence of the selected-element implementations.

## 15. Design controls, numeric units, colors and effects

| Section/system | Classification | Evidence / semantic limits |
| --- | --- | --- |
| Geometry | PARTIAL | Live X/Y readouts, width/height/radius edits; X/Y not movement controls; no transform editor; unsupported sizing disabled |
| Spacing | COMPLETE exposed controls | All four margin/padding sides; real values/unit conversion; negative margins accepted, invalid padding rejected |
| Typography | COMPLETE exposed subset | Family/weight/size/line-height/color/alignment/letter-spacing/decoration/case; no font download/catalog; arbitrary family via token input has D02 gap |
| Numeric/unit model | COMPLETE supported scalar behavior | `values.ts`, `conversionContext.ts`, `NumericScrubber.tsx`; typed CSS token preservation, raw valid expressions, bare lengths, zero/negative constraints, relative units, integers and modifier steps |
| Unit conversions | PARTIAL by design | Preserve size only with a definite reference; ambiguous percentage/font/gradient/shadow conversions disabled with explanation; manual valid CSS stays possible |
| ColorControl | COMPLETE supported behavior | Shared six contexts; HEX/RGB/HSL/alpha, concrete picker, recent colors, invalid-draft protection, gesture cancel, associated errors |
| Unresolved color tokens | LIMITED BY DESIGN | `currentColor`, variable tokens and mixed values preserved; no fabricated black; spectrum/hue/alpha unavailable until a concrete replacement |
| Background layers | COMPLETE exposed subset | Color, HTTP(S) URL entry, add/remove/reorder/hide/show, companion position/size/repeat lists, atomic transactions |
| Gradients | PARTIAL | Supported linear/radial stops, track, direction, distribute/reverse and presets; conic/interpolation hints/double-position stops/complex syntax preserved without fake editors |
| Border | PARTIAL | Shorthand width/style/radius/color; mixed four-side colors shown explicitly; choosing a color replaces all sides; no full per-side UI |
| Display/position | COMPLETE exposed subset | Display/opacity, position, contextual top/right/bottom/left/z-index; no flex/grid layout sub-editor; z-index remains integer |
| Box/text shadows | COMPLETE exposed subset | Multiple layers, ordering/visibility/presets, x/y/blur/color, box spread/inset; complex syntax preserved until deliberate replacement |
| Filters | COMPLETE eight exposed functions; PARTIAL arbitrary CSS | Blur/contrast/brightness/saturate/invert/grayscale/sepia/hue-rotate; complex/repeated functions disable ambiguous controls and remain preserved |

Control semantics are controller-owned. Numeric typing/scrubbing uses gesture grouping, frame-coalesced application, Enter commit, Escape/pointercancel rollback, browser validation and associated errors. Shift ×10/Alt ×0.1 are property-aware; z-index remains integer. Existing unit, professional, P1/P2 tests verify these behaviors; 54 value units and selected editing/rich browser cases passed here.

Color cancellation, mixed borders, hinted gradients and accessible errors have substantive current P2 assertions. Those exact P2 cases were not rerun in this audit. Gradients declined by the parser remain intact; no full gradient grammar is claimed. Hidden background/shadow tokens carry their original CSS in encoded metadata so visibility operations are reversible.

D02: `TokenInput` (`RichControls.tsx:8-13`) still differs from numeric/color controls: it writes on every keystroke, discards boolean rejection results, has no gesture identifier, Escape rollback or invalid/error association. Consumers include custom font family, radial shape/position, image URL, background position/size. Browser validation prevents invalid CSS writes, but local drafts and undo ergonomics are partial. URL-specific error text exists, without generic field association.

Native filter ranges group live writes and coalesce frames; they lack the numeric field's explicit Escape/pointercancel rollback handler (`RichEffects.tsx:32-43`). Treat uniform gesture cancellation as a scoped workflow gap, not an established destructive defect. Normal Undo still exists.

## 16. Code audit

**PARTIAL full CSS editor, COMPLETE connected supported-declaration workflow.** `LiveCodeView.tsx:27-133`, `sourcePresentation.ts`; all four selected Code/HTML browser cases and five presentation units passed.

Code distinguishes inline authored declarations, readable matching stylesheet rules, CSSForge-owned overrides, contexts and keyframes. It preserves normalized CSSOM semantics and source identities, not original file text. Authored declaration toggles are disabled deliberately; owned overrides can be removed/re-enabled. Supported values open a CodeMirror draft, validate, Apply/Cancel/Escape and restore row focus. Added properties are limited to the supported registry; arbitrary stylesheet/keyframe/property editing is absent.

Source and cascade reads are explicit; Refresh invalidates current caches. Adjacent same-source/context presentation grouping retains original rule/declaration objects and order rather than merging different source identities. Cascade statuses, summary certainty and source attribution are visible, but numeric specificity tuples, detailed loss explanations and inheritance chains do not have a dedicated UI.

`CodeTarget` remounts on `targetId:bindingGeneration` (`:98`), protecting old drafts during replacement. The author-mode branch exists but is unreachable through current user controls. No dedicated clipboard/copy/export action was found. Keyframes are inspectable read-only; that is not animation authoring.

## 17. HTML audit

**COMPLETE bounded inspection/navigation; DOM editing MISSING.** `picker/tree.ts:7-49`, `navigation.ts`, `ui/html/LiveHTMLView.tsx`.

Real DOM tags/IDs/classes/text are safely displayed. Element handles stay in the controller. Only visible expanded branches are traversed, with 12 selected-path ancestors, 180 rows, depth 16 and 32 displayed children per branch; navigation child sampling is bounded. Truncation is explicit and the selected path is retained around large sibling lists.

Parent/child/previous/next selection, expansion, Refresh and real open-shadow traversal are connected. Slots use assigned-element navigation, avoiding duplicate ordinary/assigned representations. Closed shadows and iframe interiors are boundaries. No HTML serialization editor, element insertion/removal, text editing or arbitrary DOM mutation exists in this live surface.

## 18. Navigator audit

**COMPLETE dedicated bounded navigation surface.** Same real tree as HTML, inside shared modal/focus infrastructure. Refresh is explicit rather than continuous whole-document indexing. Selection changes synchronize the inspector and tree; losing a target stops unsafe node actions.

Current P2 tests protect roving tabindex and Right/Left expand-child/collapse-parent, Up/Down/Home/End/Enter. Selected Code/HTML and freeze modal cases passed in this audit, including native 200% zoom, short viewport reachability, Tab/Shift+Tab containment and opener restoration. No claim is made that the bounded tree exposes every node at once.

## 19. Dock and popovers audit

**COMPLETE currently exposed seven-control dock; extra tools are absent.** `LiveDock.tsx:9-14` connects pick/cancel, Changes, Navigator, measurement readout, More, inspector visibility and deactivate. More only routes existing session controls/navigation. Hidden fixture palette/eyedropper/background tools are not broken exposed tools and should not be resurrected as part of this audit.

Popover/tooltip/surface placement shares Floating UI helpers: flip/shift/size/autoUpdate, viewport bounds, focus management, Escape and opener restoration. Portals remain under the owned UI root; modal base UI is inert, and picker suspension prevents accidental host selection. Font loading, observer/listener teardown and drag frame cancellation are effect-owned.

Manual top-layer ordering places noninteractive feedback behind the UI host. Current P1 tests assert hostile maximum z-index and transformed html/body; freeze tests passed for short viewports and focus. A later host-created top-layer dialog/popover overtaking CSSForge is not universally excluded or tested by those z-index assertions.

## 20. Design-system and theme architecture audit

**MOSTLY CENTRALIZED, with P3 legacy drift.** `styles/tokens.css:1-36` defines semantic surfaces/text/focus/error/status/context/syntax, type/spacing/radii and motion; live components consume these roles. Numeric/color/Icon/placement infrastructure is shared. Two bundled Geist buffers use private family names and are added/removed through document FontFaceSet (`useUIFonts.ts:7-17`), with fallback on load failure.

Literal-color classification:

| Location/pattern | Classification | Consequence |
| --- | --- | --- |
| Palette values in `tokens.css:10-36` | VALID PALETTE DEFINITION | Central semantic ownership |
| User CSS swatches, gradients/shadow preset samples and checkerboard | INTENTIONAL SPECIAL CASE | Content/sample colors are not theme colors |
| Feedback overlay literals (`picker/overlay.ts:12`) | INTENTIONAL SPECIAL CASE / small token bypass | Independent noninteractive feedback palette; does not invalidate inspector centralization |
| Legacy error/tooltip/layer/dock literals (`ui.module.css:22-42`, `:95-120`, `:228-249`) | LEGACY / TECH DEBT | Older definitions and repeated later overrides complicate effective styles |
| Color-picker pointer/shadow/border literals (`propertyControls.module.css:61-104`) | INTENTIONAL SPECIAL CASE with TOKEN BYPASS | Adapter chrome still owns several one-off constants |
| Preset browser/sample styling | INTENTIONAL SPECIAL CASE plus legacy duplication | Distinguish sample artwork from control chrome before cleanup |

`ui.module.css` contains several generations of later overrides and important selectors; some older definitions serve preview variants, some are overridden. This is concrete maintainability debt, not a request to redesign. Important host resets and pointer-event isolation are justified; not every important declaration is a theme defect. No automated dead-CSS proof or comprehensive computed-style contrast audit was run.

## 21. State-management audit

**READY WITH NON-BLOCKING GAPS.** Zustand owns task, section collapse, overlays, surface, inspector position/visibility, tooltip/dock state and isolated preview fixture preferences (`state/ui.ts`). Element/native CSSOM authority, override scopes, history and reconciliation remain in controller closures. `useSyncExternalStore` adapts stable snapshots (`picker/context.tsx:11-22`); React does not create edit stylesheets during render.

There are concrete coupling costs: editing/picker snapshot consumers subscribe to the entire snapshot, and content's whole-UI subscription calls suspension on every store change; App also synchronizes suspension. Each applied edit publishes broadly and can rerender many Design consumers. This is source-verified rerender amplification potential; no measured user-visible slowdown was established. Picker hover publishes no React state.

**INFERRED replacement draft risk:** Design keys by `targetId + contextKey`, while migration preserves targetId and increments bindingGeneration; Code keys by both id and generation. Focused numeric/token drafts, conversion caches or queued effect gestures may survive a binding swap. Numeric callbacks use the latest onChange reference, and filter checks only logical target/context. Current committed-edit migration tests do not directly establish focused/pending draft behavior. An audit helper intended to investigate this did not yield a usable completed result; this remains UNVERIFIED, not a confirmed unsafe migration defect.

Preview and live behavior share presentation components but have separate branches. This is intentional dormant fixture code, with the risk that standalone preview tests alone can be mistaken for product verification. Avoid broad store rewrites without a measured ownership or rendering problem.

## 22. Rendering and performance audit

**Sound hot-path architecture, bounded slower paths; large-page latency UNVERIFIED.** `picker/frame.ts`, `controller.ts:124`, source/cascade caches, bounded locator/selectors/reconciliation, filter and numeric frame queues.

The source-level performance case passed: bursts of 1,000/2,000 pointer events produce zero computed inspection, source scans, cascade resolution, locator search, selector generation, reconciliation or UI publications; first hover geometry is frame-gated and repeated same-target movement reuses it. Selection performs its deliberate computed inspection. Teardown makes pending hover inert. Built author M29 and selector S01 also passed their no-hover-analysis assertions.

Selection/source refresh and author recipient analysis are bounded but synchronous. A bounds cap prevents unbounded scans, not guaranteed frame-budget compliance on every large page. Rich parsers and snapshot subscriptions may recompute across an edit render; browser tests prove frame coalescing for filter bursts, not every React consumer's render count.

The current production build is approximately 1.04MB content JS + 87.89kB CSS, 1.14MB total. Two bundled font files are 69,760/71,596 bytes. CodeMirror is justified for real drafts; font/bundle loading is a performance budget to monitor, not a demonstrated release defect. No broad benchmark or heap-retention measurement was conducted.

## 23. Observer and listener lifecycle audit

**SOURCE/TEST VERIFIED cleanup; no confirmed leak.** `controller.ts:198-248`, `invalidation.ts:2-29`, `markerContainment.ts`, `reconciliation/index.ts:19-99`, `entrypoints/content.tsx:17-57`.

| Owner | Setup / teardown |
| --- | --- |
| Picker pointer/intercept/scroll/resize/visualViewport | Symmetric removal on destroy; pending frame cancelled |
| Selected target/ancestor/sibling mutation+resize | Bounded chain rebind; old observers disconnected on selection/loss/destroy |
| Edited marker containment | Per-root owner tracking; final-owner release disconnects; Reset/destroy clears all |
| Replacement observer/timer | Exists only during bounded loss window; token cancellation, timeout, terminal state and destroy disconnect/clear |
| React Escape/drag/placement/portal listeners | Effect cleanup; numeric/gradient/filter animation frames cancelled on unmount/context boundary |
| Content document listener | Dormant runtime toggle remains intentionally while inactive; pagehide/invalidation retires author ownership; invalidation removes message/pagehide listeners |
| FontFaceSet | Adds private faces at mount, removes them at unmount |

Repeated reset/deactivate/repick/replacement teardown is covered by current browser tests. Pointer teardown passed here. Universal adversarial host removal of the UI host, BFCache combinations and heap behavior were not independently exhaustively verified.

## 24. MV3, permissions, packaging and isolation audit

**Architecture READY WITH NON-BLOCKING GAPS; store packaging NOT READY.** Current WXT config and generated manifest were both inspected after the successful build.

Manifest: MV3; background service worker; permissions **activeTab, scripting**; no host_permissions; empty static content_scripts. Runtime content injection targets the clicked top-document tab; no allFrames path. The stylesheet is a web-accessible resource using a dynamic URL with HTTP(S) matches. This is required style access, not automatic website access.

Background's per-tab pending guard avoids overlapping action toggles, and restricted pages receive badge/title feedback. Page isolation is extension isolated world + ShadowRoot UI; owned CSS writes intentionally affect the inspected page. CSS strings are assigned through native declarations, and fonts are bundled buffer-backed resources without remote font requests. Native manual popover/top-layer and modern Chrome extension-loading test APIs are browser assumptions; no minimum browser version is declared.

Build output has a working unpacked package and notices. Manifest lacks a release icon set and explicit minimum browser/support policy; package is private 0.1.0 and has no zip/release script. Store listing/privacy/release submission readiness is UNVERIFIED. Unpacked internal testing is practical today; it is not evidence of completed store distribution. Firefox/other browser compatibility is unverified and not the declared initial target.

## 25. Security and safety audit

**No confirmed exploitable security defect in inspected paths.** Real paths were checked, without inventing vulnerabilities from general extension concerns.

- Production page strings are React text or textContent. No production `dangerouslySetInnerHTML`, `innerHTML`/`outerHTML` execution sink, eval or new Function was found. Test fixtures use HTML injection and controlled bridges; those are not shipped page APIs.
- Selector generation/locator queries escape identifiers/strings and validate natively; current unusual-ID/quote/attribute browser cases passed.
- Session CSS values are property-allowlisted, bounded, separator/control/embedded-priority checked and CSS.supports validated before native setProperty. Author writes retain exact native capability, context and state guards.
- Image URL entry restricts explicit URLs to HTTP(S). Host-authored image CSS is displayed/preserved; copying a host URL into a preview may cause ordinary image loading, not extension privileged fetch.
- No connector/backend, remote executable code, fetch/XMLHttpRequest/WebSocket, clipboard/export service or durable browsing-data store was found in the audited production paths.
- Synthetic page events are not a trusted authentication boundary for privileged actions: picker events select Elements, and no production test bridge exposes the editor to the page. The security boundary remains browser runtime/action and isolated-world authority.
- Cross-origin CSSOM failures are represented, not bypassed; safe mutation additionally rejects readable cross-origin linked sources outside policy.

Dependency advisory scanning, malicious-host fuzzing, browser permission threat certification and full CSP/site matrices were not performed. Open ShadowRoot isolation is not a secrecy guarantee against the host page; no confidential credentials are stored in the UI. The demonstrated D01 issue is truthful-feedback safety, not code execution or destructive author overwrite.

## 26. Accessibility audit

| Area | Classification | Current evidence |
| --- | --- | --- |
| Tab semantics/roving tab order | TEST-COVERED / source verified | Task tabs role/controls/selected + Arrow/Home/End; current interaction tests |
| Tree keyboard/roving tabindex | TEST-COVERED | HTML/Navigator P2 asserts complete tree keys; selected navigation runtime passed |
| Modal keyboard/host-focus containment | CONFIRMED GOOD | Two freeze cases passed, including eight Tab/Shift+Tab cycles and host focus rejection |
| Popover Escape and focus restoration | TEST-COVERED; selected RUNTIME VERIFIED | Shared FloatingFocusManager/Escape policy; Code/HTML and freeze cases |
| Numeric/color invalid state/errors | TEST-COVERED / source verified | aria-invalid + described errors, no invalid page write; P2/professional cases exist |
| TokenInput validation/cancel semantics | ACTUAL SOURCE DEFECT/GAP | D02: missing local invalid/error association and Escape gesture cancellation |
| Labels/disabled controls | CONFIRMED GOOD in inspected controls | Accessible IconButton labels/native disabled/selected state; disabled unavailable conversions explain references |
| Color picker unresolved/mixed tokens | TEST-COVERED | No fabricated concrete value; unavailable transforms explained; six-context P2 coverage |
| Focus-visible/text contrast | LIKELY GOOD BUT UNVERIFIED comprehensively | Semantic focus/text tokens; current visual test computes bounded palette contrast; not rerun here |
| Narrow/short/200% zoom reachability | CONFIRMED GOOD selected workflows | Freeze + selected Code/HTML/editing/rich tests passed |
| Screen reader announcements/full compliance | UNVERIFIED | No full screen reader/axe/manual assistive-technology certification |

Do not equate screenshots, palette ratios or test counts with WCAG compliance. Dedicated pointer range cancellation and focused replacement drafts still need scoped evidence; neither is a proven global keyboard failure.

## 27. Responsive, zoom and hostile-page audit

Current tests cover 320px, 390px, short viewports, native Chrome 125/150/200%, transformed html/body, maximum z-index overlays, feedback overlap, clipping and modal focus. Source establishes top-layer viewport hosting, clamped drag geometry, bounded overlay placement and internal scrolling.

This audit reran short **390×280 / 1440×360** freeze cases and native **200%** workflows in Code/HTML, editing and rich effects. They passed. P1 hostile transforms/z-index, 320px and intermediate native zoom assertions were inspected but not rerun. Their current test existence is stronger evidence than old screenshots, but runtime verification should not be implied.

The historical byte-exact P1 raster overlap comparison is timing/antialias-sensitive; current P2 has a bounded one-channel/no-more-than-0.1%-pixels comparison. This is a test brittleness distinction, not a confirmed host-isolation regression. Later host top-layer entries, every CSP/reset/site combination and all cross-browser behavior remain unverified.

## 28. Test-suite audit and current verification

### Exact commands/results

| Command | Current outcome | Counts / retries / flakes / skips |
| --- | --- | --- |
| `pnpm typecheck` | PASS, exit 0 | No test count; no rerun |
| Initial sandbox `pnpm test` | ENVIRONMENT STARTUP FAILURE | esbuild Access denied resolving config/parent; zero tests executed |
| Authorized `pnpm test` | PASS, exit 0 | **256/256**, **18/18 files**, zero failures/skips/retries; no test flake observed |
| Authorized `pnpm build` | PASS, exit 0 | WXT 0.20.27 / Vite 7.3.6, chrome-mv3, ~1.14MB; no build rerun |
| `pnpm exec playwright test --list` | PASS | **345 tests in 35 files**; inventory, not execution |
| Selected browser command below | FAIL, exit 1; classified environment interference | **131 attempted; 130 passed; one failed; zero skipped; zero configured/automatic retries; no manual test rerun**; 4.2 minutes |
| Additional command below | NOT EXECUTED | Automatic approval review failed on usage limit, not an unsafe-action judgment; zero tests launched |

Selected executed command:

```text
pnpm test:e2e tests/e2e/author-mutation.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/selectors.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/source-index.spec.ts tests/e2e/cascade.spec.ts tests/e2e/editing.spec.ts tests/e2e/code-html.spec.ts tests/e2e/rich.spec.ts tests/e2e/current-ui-freeze.spec.ts tests/e2e/picker-performance.spec.ts
```

This selected batch has **128 packaged-extension cases, all passed**, plus three native/source supplements: cascade and picker-performance passed; native source-index failed. Installed headless Chrome **154.0.8037.92** was loaded through Extensions.loadUnpacked and activated through the real extension action, using disposable profiles and the minimal manifest.

Failure: `tests/e2e/source-index.spec.ts:44`, “native CSSOM engine retains ownership, nested groups, keyframe declarations and scoped identities.” Dynamic import `/src/engine/sources/index.ts` failed after Vite emitted EBUSY watching `tmp/audit-ui-runtime-profile/Default/Network/Cookies`. An audit helper placed a browser profile outside the existing ignored `.preview`/`test-results` roots. The concurrent Vite watcher crash explains the fetch failure; packaged-extension cases continued passing. **Classification: ENVIRONMENT ISSUE caused by audit instrumentation**, not a demonstrated source-index product defect. The failed native case was not rerun, and is not called green. The introduced helper/profile location should not be used in future checks.

Attempted additional command, blocked before execution:

```text
pnpm test:e2e tests/e2e/engine-integration.spec.ts tests/e2e/mutation-conflicts.spec.ts tests/e2e/current-ui-p2.spec.ts
```

Automatic approval review returned a usage-limit failure and explicitly stated that it could not complete review; the action was not executed. No bypass was attempted. Source/current-test inspection continued. The full 345-case browser suite was deliberately not expanded into a historical diagnostic/visual matrix.

### What the unit suites protect

| Area | Current unit evidence and counts |
| --- | --- |
| Source/index | source 3 + source-index 14: kinds, identity, security failures, native bindings, scopes, bounded traversal and context conservatism |
| Cascade/specificity | cascade 25 + specificity 32: precedence/loss/defaulting, important layers, inherited provenance, mixed shorthand status and structured selectors |
| Targeting | picker 7 + targeting 5 + locator 24 + selectors 25 + reconciliation 15: authority, bounds, ambiguity, escaping, root safety and cancellation |
| Editing/value grammar | editing 5 + values 54 + rich 8 + professional 4: property validation, conversions, complex syntax preservation and shared-control model |
| Mutation ownership | author-mutation 5 + mutation-conflicts 15: policy, recipient union/bounds, ledger lifecycle and native ownership model |
| Presentation/geometry | UI 7 + geometry 3 + code-presentation 5: UI state/placement and safe adjacent source grouping |

Counts do not substitute for native semantics. Small pure mocks cannot prove browser CSSOM reentry/rollback behavior; the built-extension F/T/M suites do.

### Coverage quality and gaps

Meaningful coverage includes native CSSOM normalization/important layers, exact source freshness, weak-identity rejection, A→B→C replacement, copied marker containment, pointer hot paths, undo/reset, shared selector branches, partial writes, native callbacks, conflict attribution and real zoom/focus.

Important gaps: D01 user-visible ineffective-edit feedback; TokenInput cancellation/association; focused/pending Design gestures during binding migration; explicit uncertainty guards for registered custom properties, missing session source order, logical mapping, `all`/pending-substitution, motion and imported-sheet cascade; long-session history/render budgets; public browser/support packaging policy.

Current `current-ui-*-audit` diagnostic suites can record blocked/mismatching observations without failing every finding. A passed diagnostic recorder is not an assertion that the product has no defect. `current-ui-p1/p2`, freeze, editing and mutation regression assertions genuinely protect behavior. Fixed waits and screenshot/raster equality can be timing-sensitive; native asynchronous action completion is explicitly polled in the extension harness. Several old screenshot-capture suites write historical paths by default; this is reproducibility/output-isolation debt, not dead product code.

No test.skip/test.fixme/test.only configuration was found by targeted search; the selected execution reported no skips. `tests/cascade.test.ts:99` mentions disabled declarations but directly tests inactive media/supports; its title overstates that particular assertion.

### Git safety / audit-generated outputs

Normal tests regenerated **19 tracked diagnostic JSON files**: `artifacts/diagnostics/author-mutation/{M07,M15,M17,M18,M27,M44,M45}.json` and `artifacts/diagnostics/reconciliation/{R01–R10,R12,R23}.json`. These are test outputs, not production implementation edits. They were identified through git status, not read as historical audit evidence.

Audit helper files left untracked: `.audit-ui-runtime.mjs` and `tmp/audit-ui-runtime-profile/`. Existing ignored `.output/.wxt/test-results` were also refreshed by tools. The requested new artifact is `docs/current-project-audit.md`. No git add/commit/push/reset/clean/checkout was used. Production/source/test/config changes are checked separately at the end of the audit.

## 29. Documentation versus current code

| Document | Classification | Current conclusion |
| --- | --- | --- |
| README.md | STALE / CONTRADICTED BY CURRENT CODE | Says Phase 07 not started, no full source index/cascade/observer/author rewrite; says no bundled font files and no position offsets. Current implementations contradict these whole-product statements |
| current-ui-functional-fixes-p1.md | HISTORICAL, mostly current correction scope | Current host/top-layer/slot/dock fixes and tests still exist; report is not fresh verification |
| current-ui-functional-fixes-p2.md | HISTORICAL, mostly current correction scope | Shared color, mixed-border, hint preservation, focus/keys and Changes wording exist; its historical counts/claims are not current run results; it does not promise all TokenInput behavior |
| current-ui-visual-polish.md | MOSTLY CURRENT scoped presentation, HISTORICAL run results | Semantic tokens, source grouping and lightweight Changes match; “297 passed” belongs to that run, not this audit |
| engine-07.0.md / engine-07.1.md | HISTORICAL scoped design records | Source/cascade bounds/conservatism still useful; source-only scope/“Author CSS is never edited” cannot describe the whole current implementation |
| mutation-conflict-fixes.md | MOSTLY CURRENT mechanics, HISTORICAL milestone | Q01–Q04 ownership/recovery fixes are implemented; Q05 custom dependency limit still exists; “07.4C has not started” is superseded |
| engine-integration-torture.md | MOSTLY CURRENT guard mechanics, HISTORICAL verification | Synchronous transaction/native guards and current T suite exist; no fresh all-T runtime claim here |
| Supplied product brief/UI foundation | REFERENCE / DESIGN INTENT | Good orientation; future Changes copy/export wording is not current functionality |

Old reports can remain valid history without being rewritten. A single current capability/support document and corrected README are more valuable than mass-editing historical COMPLETE/FROZEN reports.

## 30. Dependencies

**No clearly unused declared production dependency found.** Actual imports justify React/ReactDOM, Zustand, Floating UI, Lucide, react-colorful, culori, CodeMirror CSS/language/state/view and Lezer highlight. CodeMirror is used for real value editing, not only tests; culori formats/parses color while react-colorful supplies picker interaction. These roles overlap in domain but are not accidental duplicate UI implementations.

Development dependencies supply WXT/React build, TypeScript/types, Vite preview/build, Vitest and Playwright. Tests import WXT browser types, not a production-only test runtime. Package caret ranges resolve to current installed versions rather than the exact declared minimum; WXT/Vite/Vitest build/run output was recorded. No lockfile line-by-line review, upgrades or advisory/database scan was performed, so obsolete/vulnerable versions are UNVERIFIED rather than asserted.

Runtime dependency weight is meaningful (~1.04MB content bundle including fonts/editor/UI). There is no measured evidence that a trivial helper dependency dominates or that removal would improve the current product. `public/THIRD-PARTY-NOTICES.txt` and Geist OFL ship; full redistributed-dependency license completeness was not independently certified.

## 31. Dead, stale and dormant code

| Finding | Classification | Evidence / impact |
| --- | --- | --- |
| Fixture Design/Code/HTML/Changes and extra dock tools | INTENTIONAL DORMANT CODE in extension branch | Standalone preview needs them; do not count as live capability or delete as dead without import reachability analysis |
| Safe-author UI branches and policy API | INTENTIONAL DORMANT CODE / product gap | Used by tests/API; no live mode selector; not safe dead code |
| Unselected Code/HTML “not connected yet” copy | TECH DEBT, P3 | Reachable empty-state text is outdated while selected views work |
| Legacy CSS layers/literals and preview/live store coupling | TECH DEBT, P3/P2 | Effective style/state ownership less obvious; not proof all old selectors/actions are unused |
| Icon names/tool state unions for hidden tools | INTENTIONAL DORMANT / UNVERIFIED removal safety | Preview consumers exist; no automated tree-shaking/dead-export proof |
| Session history without cap | TECH DEBT, P2 | Long activation can accumulate transactions; author safety ledger separately bounded |

Targeted TODO/FIXME/HACK/stub/not-implemented/legacy/console/error searches did not reveal a hidden unfinished production subsystem beyond explicit supported-scope boundaries. Throw sites are lifecycle/availability guards. No unsupported unused-export deletion was proposed.

## 32. Actual current product capability inventory

| Capability | Status | Current truth |
| --- | --- | --- |
| Element picker | COMPLETE | Real explicit page picks and cancellation |
| Hover inspection | COMPLETE limited metadata | Geometry/identity feedback; full computed/source engine deliberately excluded from hot path |
| Selected-element inspection | COMPLETE supported scope | Identity, geometry, font and supported CSS snapshot |
| Replacement/reconciliation | COMPLETE bounded | Strong unique same-root recovery only |
| Live visual editing | PARTIAL | Real registered properties; D01 ineffective-important feedback and browser/layout limits |
| CSS units | COMPLETE supported scalars | Context-aware conversions, conservative unavailable cases, raw valid tokens |
| Colors | COMPLETE supported grammar/workflow | Concrete formats/alpha, unresolved/mixed preservation |
| Typography | COMPLETE exposed subset | Core text controls; no webfont/advanced font workflow |
| Spacing | COMPLETE | Eight sides |
| Geometry | PARTIAL | Width/height/radius edits, X/Y readouts; no move/transform workflow |
| Backgrounds | COMPLETE exposed subset | Solid + URL + multiple layers/placement/visibility/order |
| Gradients | PARTIAL | Linear/radial supported; complex/conic preserved/read-only |
| Borders | PARTIAL | Shared shorthand controls/mixed-color replace-all; no per-side expansion |
| Positioning | COMPLETE exposed subset | Position/offsets/z-index; no full layout toolkit |
| Box shadows / text shadows | COMPLETE exposed subset | Multiple supported layers/presets/values |
| Filters | PARTIAL arbitrary CSS | Eight controls; unsupported functions preserved |
| Media contexts | PARTIAL | Bounded relevant CSS context selection; no viewport emulator |
| Pseudo/state contexts | PARTIAL | Conditional hover/focus/active/before/after; no forcing/creation |
| Source inspection | PARTIAL | Readable normalized CSSOM; imports/inaccessible/original-file limits |
| Cascade inspection | PARTIAL | Supported author subset, visible status/uncertainty |
| Provenance | PARTIAL | Engine source/inheritance/attribution richer than visible detail |
| Specificity visibility | PARTIAL | Engine tuple present; no dedicated numeric user presentation |
| Code editing | PARTIAL | Supported declaration values/owned toggles/new registry properties; no arbitrary stylesheet/keyframe editor |
| HTML inspection | COMPLETE bounded | Real lazy DOM view/navigation |
| Navigator | COMPLETE bounded | Dedicated tree selection surface |
| Changes | PARTIAL | Real count, Undo, Reset and limitations |
| Undo / Reset | COMPLETE session semantics | Reversible current session plus guarded author recovery |
| Detailed history/review | MISSING | No grouped live diff/timeline/per-change review |
| Persistent history/session | MISSING | No storage; live-document recovery ledger is not persistence |
| Source mutation | PARTIAL | Engine/API exists; no exposed mode/authorization workflow |
| Session override editing | COMPLETE mechanism, PARTIAL effectiveness | Default path; author important can defeat it |
| Dedicated copy workflows | MISSING | Ordinary text selection may be copied manually; no product copy action |
| Export workflows | MISSING | No export/download/patch output |
| Responsive workspace | MISSING | UI fits narrow/zoom; media context picker is not responsive tooling |
| Measurement/rulers | PARTIAL | Dimensions readout only; no rulers/distances/gesture |
| Eyedropper / page color sampling | MISSING | Live dock hides these tools; color picker is not sampling |
| Assets workflow | MISSING | Image URL entry/presets do not constitute asset discovery/upload/management |
| Animation tooling | MISSING | Read-only keyframes are inspection, not timeline/keyframe editing |
| Style ownership/effective target workflow | PARTIAL | Engine attribution/source checks exist; no dedicated owner/impact workflow |
| Advanced source actions | MISSING | No open-file/save-source/scope authorization review UI |
| Additional dock tools | INTENTIONALLY EXCLUDED from current live dock | Fixture icons do not imply user tools |
| Iframe interiors | LIMITED BY PLATFORM/current scope | No frame-local implementation, including same-origin interiors |
| Open/nested Shadow DOM | PARTIAL | Pick/edit/local source/recovery supported; encapsulation cascade incomplete |
| Closed Shadow DOM | LIMITED BY PLATFORM | Interior inaccessible; host supported |
| Slots | COMPLETE supported navigation; PARTIAL CSS semantics | Assigned-node composed tree works; full slotted cascade uncertain |
| AI/Chat | INTENTIONALLY EXCLUDED | Reference brief prohibits fake chat; no real capability |

Missing means missing today, not automatically a requirement or recommendation to build it.

## 33. Separate CSS Pro reference capability comparison

Reference work began after the current implementation was established. Only the four prescribed entry documents and **four exact static images** were inspected: screens `01-inspector-design-and-dock.png`, `03-code-view.png`, `05-changes-surface.png`, `06-html-navigator.jpg`. No contact-sheet/keyframe collection, reference phase directory or branding asset scan was performed.

Static screenshots prove visible affordances/content, not that CSS Pro executes them safely, persists them or supports a universal CSS grammar. Evidence-map video titles alone do not prove detailed runtime behavior.

| Observed reference capability | CSSForge comparison | Evidence and limit |
| --- | --- | --- |
| Floating inspector, selected identity/dimensions/font, Design/Code/HTML | EQUIVALENT basic workflow | Screen 01; CSSForge current real shell. Branding is not compared |
| Spatial spacing/core typography/background/display/border | EQUIVALENT exposed core / PARTIAL advanced range | Screen 01; current controls. Reference background-as-text-color toggle has no CSSForge counterpart |
| Media/state controls | PARTIAL | Screen 01 shows selectors; CSSForge offers bounded conditions without forcing. Reference forcing/viewport semantics UNKNOWN |
| Compact declaration Code with checkboxes and inline color affordances | PARTIAL / DIFFERENT BY DESIGN | Screen 03; CSSForge authored toggles disabled for safety, owned toggles functional; registry limits |
| Animation/transform/will-change declarations and keyframe display | PARTIAL | Screen 03; CSSForge can inspect keyframes but cannot author those absent registry controls. Reference animation-tool execution UNKNOWN |
| Expanded HTML tree and selected row/navigation surface | EQUIVALENT bounded inspection model | Screen 06; CSSForge real lazy tree/selection; reference DOM editing behavior UNKNOWN |
| Dedicated Changes surface | PARTIAL | Screen 05; CSSForge surface exists but only count/actions |
| Grouped before/after CSS diffs | MISSING | Screen 05 visibly shows per-target removed/added declarations |
| Copy changes/full code | MISSING | Screen 05 visible global/per-target buttons; their reference runtime correctness is not certified |
| Export changes | MISSING | Screen 05 visible export affordance; exact file format UNKNOWN |
| Reset changes | EQUIVALENT current session intent | Screen 05 affordance; CSSForge actual Reset tested; reference ownership details UNKNOWN |
| Share-link / copy prompt for LLM | MISSING / not selected roadmap requirement | Screen 05 visible controls; cloud/persistence implementation UNKNOWN |
| Ruler/palette/eyedropper/assets-looking dock icons | UNKNOWN FROM REFERENCE detailed behavior | Screen 01 icons alone insufficient; CSSForge corresponding full tools absent/measurement readout partial |
| Responsive/move/insert/text/remove workflows | UNKNOWN FROM REFERENCE detailed semantics | Evidence map lists videos; not viewed; CSSForge current corresponding editors absent |
| AI/Chat | INTENTIONALLY EXCLUDED | Screen 01/03 has Chat tab; CSSForge brief explicitly excludes fake implementation |
| Persistent history / style-owner/effective-target safety | UNKNOWN FROM REFERENCE | The inspected evidence does not establish these policies |

Functional parity must not be inferred from similar typography, geometry or dock icons. No CSS Pro logo, wording, icons, proprietary assets or implementation was copied.

## 34. Known platform and intentional limits

Restricted browser/store pages, inaccessible cross-origin CSSOM and closed ShadowRoot interiors cannot be made readable by the current permissions. Frame interiors require a separate frame-local architecture not present here. Shadow encapsulation, imported stylesheets, CSS nesting/scope/container/logical properties, registrations and motion can defeat readable-author certainty even when Chrome renders them correctly.

CSSOM is normalized live state, not original source files. Authored CSSOM mutations are local to the loaded document. Important cascade rules, inheritance and layout can defeat a local visual override. Context selection never forces state or resizes the viewport. Session data is discarded on ordinary deactivate/navigation. These boundaries should be presented plainly and must not be counted as solved by a future copy/export button.

## 35. Actual confirmed defects

### D01 — P1: active edits can appear successful without changing rendered CSS

**SOURCE VERIFIED + RUNTIME VERIFIED.** Current built Chrome extension, base context, `#target { font-size:18px !important }`: setting Font size to 32 and Enter leaves computed size 18px, while override/presented/input is 32px, Undo count is one, error is null and no alert appears. A flat important layer case produces the same ineffective result. No page error occurred.

Root: session renders an unlayered single-attribute important rule (`session.ts:126-128`), rejects only inline important directly (`:160`), and records syntactic style application as success (`:167-173`); presentation prefers override over computed (`:101-103`). Field tooltip offers computed/override values, but does not proactively identify that an active edit lost the cascade.

`selection-audit.spec.ts:285-296` already characterizes apply=true with unchanged computed CSS and correct specificity loss. Thus the underlying precedence limitation is intentional and the cascade engine is correct. The defect is **user-visible effectiveness/status truth**, not a demand to beat every important rule. Address before broad public release; preserve inactive media/pseudo edits as intentional pending conditions.

### D02 — P2: token fields lack the shared rejection/cancellation contract

**SOURCE VERIFIED; complete runtime UX reproduction UNVERIFIED.** `TokenInput` applies every keystroke, ignores false results, has no grouped gesture, Escape rollback or aria-invalid/error association (`RichControls.tsx:8-13`). Background position/size, radial shape/position and custom font family use it. Browser/controller validation protects the page from invalid syntax, but drafts/errors and Undo semantics differ from the numeric/color controls. This is a concrete current control gap; do not claim a destructive invalid-CSS write.

### D03 — P3: current empty-state/docs wording contradicts connected capabilities

**SOURCE VERIFIED.** Empty selected-surface guidance says Code/HTML are not connected (`LiveInspection.tsx:29`); README says source/cascade/Phase 07 do not exist and describes obsolete font/observer/offset behavior. Fix current user-facing/current-entry documentation in a later authorized phase. Historical reports can remain historical.

No further confirmed P0/P1 product defect was established. Environment test failure, inferred replacement draft risk and absent capabilities are separately classified.

## 36. Technical debt

| Debt | Priority | Why concrete / boundary |
| --- | --- | --- |
| Unbounded ordinary session history | P2 | Activation-time array grows on ungrouped edits; native author recovery has a separate cap; no measured degradation claimed |
| Focused/pending Design binding-generation coverage | P2 | Different Code/Design generation keys and logical-id checks; current safety tests focus on committed transactions; risk remains inferred |
| Author token dependency impact | P2 | Q05 local scope misses inherited/token consumers; safety prerequisite for author UI |
| Explicit uncertainty-guard tests | P2 | Source guard labels determine mutation eligibility but several lack direct regression assertions |
| Current-source safety ownership complexity | P2 | Session/mutation closures coordinate staging, history, guards, ledger and teardown; preserve native behavior tests before extracting modules |
| Broad snapshot subscriptions/duplicate suspension sync | P3 | Source-established render/callback amplification; measure before optimizing |
| Layered legacy CSS/token bypass | P3 | Repeated definitions/important overrides make effective style ownership harder to follow |
| Test output isolation | P3 | Existing suites rewrite tracked diagnostic paths; audit profile in watched tmp caused an environment failure |
| Diagnostic test pass semantics | P3 | Observation recorders can pass despite recorded findings; distinguish regressions from evidence capture |

These findings justify scoped maintenance, not a speculative engine rewrite or broad visual polish pass.

## 37. Missing capabilities and product priorities

Highest-value confirmed gap: users can experiment but have no dedicated reliable way to review grouped changes and take their CSS out of the session. Detailed Changes + copy/export should use actual transaction/source/context models and explicit selector/uncertainty semantics, not fixture diffs or a new parallel history truth.

Other absent tools—persistent sessions, responsive workspace, real rulers, eyedropper, color sampling, assets, animation authoring, HTML mutation and additional dock tools—are separate product choices. A narrow session exporter may deliver value before any of them. Safe-author exposure is not ready to be advertised as local-impact editing until dependent impact/authorization and recovery review are settled.

## 38. Release readiness and blockers

| Category | Readiness | Blocker / non-blocking limit |
| --- | --- | --- |
| Architecture | READY WITH NON-BLOCKING GAPS | Clear ownership; closure/subscription debt does not establish failure |
| Engine correctness | READY WITH NON-BLOCKING GAPS | Explicit conservative author subset; unsupported modern CSS does not silently become browser-equivalent |
| Targeting correctness | READY WITH NON-BLOCKING GAPS | Strong migration and root guards; bounded intentional refusals |
| Editing safety/current UI | NOT READY — BLOCKERS EXIST | D01 successful-looking active edit with unchanged result |
| Author mutation safety | READY WITH NON-BLOCKING GAPS for dormant API; NOT READY for local-impact UX claim | Q05 dependency impact and no user authorization/recovery workflow |
| Product completeness | READY WITH NON-BLOCKING GAPS for clearly scoped inspector; NOT READY for end-to-end reusable CSS workflow | Review/copy/export absent; must choose release promise |
| Tests | READY WITH NON-BLOCKING GAPS | Units green; 128 packaged cases green; environment supplement failure and unrun focused suites disclosed |
| Accessibility | READY WITH NON-BLOCKING GAPS | Good tested focus/keys; D02 and full screen reader/contrast certification open |
| Performance | READY WITH NON-BLOCKING GAPS | Hot path protected; long-session/large-page latency unmeasured |
| MV3 permissions/isolation | READY WITH NON-BLOCKING GAPS | Minimal action injection and owned top layer; modern browser support boundary |
| Error handling | NOT READY — BLOCKERS EXIST | D01 missing effective-result distinction; token rejection gap |
| Maintainability | READY WITH NON-BLOCKING GAPS | Specific lifecycle/tests/style debt; no architectural rebuild justified |
| Current documentation | NOT READY — BLOCKERS EXIST for public claims | Current README materially contradicts implementation |
| Unpacked packaging | READY WITH NON-BLOCKING GAPS | Current MV3 build/load/action tested |
| Store/release packaging | NOT READY — BLOCKERS EXIST | Icons/support declaration/distribution checklist absent; store/privacy submission unverified |

Public release blockers: truthful active-edit outcome/error presentation, current capability/support documentation, and concrete distribution/support packaging. If the intended release promise includes reusable output, review/copy/export is also a product blocker. Internal unpacked testing of the scoped current inspector is already viable. Full CSS Pro parity is not a release criterion.

## 39. Non-blocking improvements

Legacy CSS cleanup, narrower subscriptions after measurement, capped ordinary history with explicit semantics, exact uncertainty-guard tests, output-isolated browser artifacts, accurate empty-state wording and small shared-control consistency gaps can be handled after P1 effectiveness/safety contracts. Complex CSS support and additional tools should expand only for validated workflow demand.

## 40. Prioritized findings and required summary matrix

| ID | Priority | Finding | Evidence quality / decision |
| --- | --- | --- | --- |
| D01 | P1 | Silent ineffective active session edit | SOURCE + RUNTIME; release truthfulness blocker |
| D02 | P2 | Token field rejection/cancel/history/a11y gap | SOURCE; runtime follow-up narrowly scoped |
| R01 | P2 | Custom-property impact labelled local by direct recipients | SOURCE + current Q05 characterization; author UX prerequisite |
| R02 | P2 | Focused/pending Design migration behavior unverified | INFERRED; targeted test before declaring unsafe or widening workflow |
| R03 | P2 | Session history and uncertainty regression gaps | SOURCE/coverage search; bounded maintenance work |
| G01 | P2 | Detailed review/copy/export absent | SOURCE; highest-value product completion gap |
| G02 | P2 | Safe-author engine lacks user ownership/authorization workflow | SOURCE; do not expose prematurely |
| D03 | P3 | Stale current docs/empty-state copy | SOURCE; public-documentation gating makes its release consequence larger than code severity |
| T01 | P3 | CSS layering/token bypass and broad subscriptions | SOURCE, performance impact INFERRED |
| T02 | P3 | Browser output isolation/diagnostic assertion ambiguity | SOURCE + audit-environment runtime failure |

**P0: none confirmed.** Do not elevate unknowns or all absent reference tools into blockers.

| AREA | STATUS | EVIDENCE | REMAINING WORK | PRIORITY |
| --- | --- | --- | --- | --- |
| Engine | COMPLETE supported subset / PARTIAL full CSS | sources/cascade source; unit + built-source/cascade cases | Imported/modern CSS only on demand; guard tests | P2 |
| Cascade | COMPLETE conservative author subset | cascade/specificity tests and runtime supplement | No full-browser claim; stronger UI explanations | P2 |
| Selection / Picker | COMPLETE supported scope | controller/lifecycle; units + targeting browser | Platform boundaries; no confirmed defect | — |
| Locator | COMPLETE conservative | 24 unit + 14 browser passes | Preserve weak-evidence rejection | — |
| Selectors | COMPLETE bounded explicit generation | 25 unit + 18 browser passes | Future export must convey shadow/structural stability | P2 |
| Reconciliation | COMPLETE bounded | 15 unit + 29 browser passes | Focused/pending Design gesture coverage | P2 |
| Session Editing | COMPLETE mechanism / PARTIAL effect truth | session + editing/rich runtime + D01 reproduction | Effective/pending/blocked feedback | P1 |
| Author Mutation | PARTIAL product, substantial dormant engine | 48 browser passes; policy API | Dependency impact + authorization/recovery UX | P2 |
| Conflict Handling | COMPLETE native guards / PARTIAL impact | 15 unit; current F/T source; M browser | Rerun F/T when environment/review permits | P2 |
| Undo/Reset | COMPLETE session semantics | session, selected native cases | Ordinary history cap; detailed review choice | P2 |
| Design | COMPLETE exposed subset / PARTIAL advanced CSS | live controls + editing/rich | D01/D02; no new tools required yet | P1/P2 |
| Code | PARTIAL general CSS / COMPLETE connected subset | four Code/HTML + presentation units | Copy/export and provenance detail after safety | P2 |
| HTML | COMPLETE bounded inspection | tree/navigation + browser | No DOM editor; don't imply one | — |
| Navigator | COMPLETE bounded | shared tree + modal runtime | Preserve explicit limits/manual Refresh | — |
| Changes | PARTIAL | real count/actions/current P2 assertions | Grouped review/copy/export | P2 |
| Dock | COMPLETE seven exposed controls | LiveDock source; freeze/runtime workflows | Real measurement/sampling tools optional | P2 optional |
| Theme System | MOSTLY CENTRALIZED | tokens/shared controls/current CSS | Legacy chrome token bypass/override cleanup | P3 |
| State Management | HEALTHY WITH DEBT | controller ownership/external stores | Measure broad subscriptions; migration draft proof | P2/P3 |
| Performance | HOT PATH VERIFIED / OTHER LOAD UNVERIFIED | passed hover/filter/mutation counters | Long-session/large-page budget checks | P2 |
| Accessibility | TEST-COVERED / PARTIAL certification | focus freeze/runtime + current P2 source | Token associations; assistive technology/contrast | P2 |
| MV3 | WORKING MINIMAL-PERMISSION PACKAGE | manifest/build/native load/action | Browser support/icons/distribution declaration | P2 |
| Tests | 256 units pass; 130/131 selected browser | exact current execution above | Environment supplement and unrun focused suites | P2/P3 |
| Documentation | STALE entry docs, useful scoped history | README/source contradictions | One factual current capability/support entry | P3 |
| Dependencies | ALL DECLARED RUNTIME IMPORTS JUSTIFIED | package/current imports | Advisories/obsolete versions unverified | P3 |
| Product Completeness | WORKING SESSION INSPECTOR / OUTPUT GAP | current capability inventory | Detailed Changes + safe copy/export | P2 |
| Release Readiness | NOT READY — BLOCKERS EXIST for public release | D01 + docs + packaging | Scoped safety/release contract first | P1/P2 |

## 41. Dependency-aware roadmap

1. **Truthful editing and control safety.** Resolve D01 effect-status semantics for active vs inactive contexts; verify TokenInput rejection/cancel/grouping and focused/pending gesture behavior during target generation changes. Preserve current safe cascade and identity rules. Add focused user-behavior regressions, not a new broad matrix. This precedes review/export because a diff must not misrepresent an ineffective edit as a rendered result.
2. **Current release/support contract.** Correct current entry documentation, define supported Chrome/version and scope, finish icon/distribution checks and separate assertions from evidence captures. Rerun the environment-failed source supplement and current focused F/T/P2 tests with profiles in ignored output roots. This turns the foundation into a reviewable release baseline without feature expansion.
3. **Session review → copy/export.** Build factual grouped changes using existing native transaction/context/selector models, then a modest copy/export path with explicit unsupported/shadow/structural context semantics. Keep one history truth; protect undo/reset and multi-target migration. This is the best next product-value phase after safety, rather than another visual pass.
4. **Author ownership/impact decision.** Only if source editing is a selected product direction, establish custom-property/inherited dependent impact and recipient authorization, expose source-owner/recovery UX and preserve partial-write conflict guarantees. Do not simply add a mode toggle to the dormant engine.
5. **Selected advanced tools and measured debt.** Choose responsive workspace, sampling, measurement, assets, animation or persistence based on demand and dependencies. Measure long-session/render budgets and clean legacy styles in bounded work. CSS Pro reference similarity does not determine this order.

## 42. Recommended NEXT phase and audit confidence

**Recommended NEXT phase: “Current editing truth and release-contract hardening.”** Its concrete scope is D01, shared token-input validation/cancellation, focused/pending Design replacement verification, current README/support/packaging truth, and completion of the blocked/environment-affected verification. It is a scoped correctness/reliability phase, not an engine rewrite, redesign, polish pass or new dock-tool phase.

After that baseline is reviewed, choose **Detailed Changes + copy/export** as the next product-value phase. Do not automatically start author mode, persistent history, responsive tools or CSS Pro parity work.

Confidence is **high** for subsystem ownership, current exposed controls, missing output workflows, conservative identity/source contracts, the demonstrated D01 feedback defect, unit baseline and 128 passing packaged cases. It is **moderate** for less-exercised native conflict/reentry edges because current tests/source were inspected but the requested additional run was blocked. Focused Design migration drafts, the failed native-source supplementary runtime, intermediate zoom/hostile-page reruns, screen reader/contrast certification, large-page/long-session budgets, store submission, dependency advisories and unviewed CSS Pro video semantics remain explicitly UNVERIFIED.

Audit ends at this decision point. **No recommended phase has been implemented.**
