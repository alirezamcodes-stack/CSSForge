# Phase 10A — Native EyeDropper and page color sampling

**Current status: READY FOR REVIEW; product acceptance remains pending.** The native refresh defect and measured subscription overhead are corrected, and real Windows pixel selection and native Escape are verified. The later heavy-page investigation confirmed and fixed redundant cascade work shared with Phase 09B. Both after-fix 22-workload series retained live preview, exact final values and Undo without sustained backlog or long stalls. Thirty-two lifecycle cycles showed constant listener/DOM counts and stable cycle cost. The exact original real-page hang and residual heap growth remain unconfirmed. The historical findings below are preserved; the EDIT-TIME PERFORMANCE / HANG INVESTIGATION records the current evidence and supersedes earlier readiness decisions.

Date: 2026-10-02. Workspace: `C:\Users\alire\Documents\ChatGPT\CSSForge`. Authoritative baseline: clean `main`, HEAD and `origin/main` `ace3789c4613fe88dc9196f2a67cc11c6d17c599`, exact tag `phase-09b`, commit `feat: add safe DOM structure editing`. The requested four initial Git checks matched before any edit. Work stays uncommitted and unpushed in this working tree. Existing milestone tags and historical reports remain unchanged.

## Outcome and evidence boundary

Existing color popovers now expose Sample screen color. A successful native result follows `sampleNativeColor → colorToken → ColorControl.apply → existing consumer callback → existing CSS transaction`. There is one color system, one ordered history and one accepted sampling gesture. Typography, background color, mixed borders, exact gradient stops and exact box/text shadow layers share the integration. The live dock has no new sampling entry.

The real installed Chrome isolated-world API was checked before production UI work. Trusted activation, construction, opening and AbortSignal cancellation work from CSSForge's ShadowRoot. Production ColorControl also opens the real API once and inspector closure aborts it without a CSS transaction. Successful pixel selection and the OS eyedropper's Escape handling are **not claimed as automated native results**. They remain manual checks. Deterministic success/cancellation/staleness tests substitute only `globalThis.EyeDropper` in the test isolated world; built React controls, rich models, editor, Changes, history and export stay real.

## Native feasibility

Evidence uses the built MV3 extension, installed Chrome, disposable Playwright profiles, the real toolbar action and an isolated-world CDP observer. No production test hook, extra permission, desktop capture, tab capture, screenshot sampler or OS input helper was introduced. The ordinary localhost fixture is a browser-secure context. Feature detection covers contexts where the constructor is absent, including browser-enforced secure-context/platform limits.

| Observation | Current evidence |
| --- | --- |
| Isolated-world exposure | `typeof EyeDropper === 'function'`; `isSecureContext === true`. |
| Trusted ShadowRoot click | `event.isTrusted === true`, transient activation active, native `open()` returns a pending promise. |
| Activation requirement | After the activation granted by toolbar dispatch expires, native `open()` rejects with `NotAllowedError`. |
| AbortSignal | Native open accepts the exact signal and rejects with `AbortError` after abort. |
| Existing popover | Native open/abort retains the color popover; history stays empty. |
| Production button | Pass-through observation records one real native open; inspector closure aborts the signal and native request; history stays empty. |
| Escape driver | Playwright's web keyboard event reaches the document (`htmlKeys: 1`) while the standalone native promise remains pending. Explicit native abort cleans up the probe. This driver does not prove OS-level Escape. |
| Success result shape | Browser contract is `{sRGBHex: '#RRGGBB'}`. Exact shape/normalization is exercised at the deterministic platform boundary; no native pixel was selected in this run. |

[Chrome's EyeDropper documentation](https://developer.chrome.com/docs/capabilities/web-apis/eyedropper) defines the opaque sRGB result, explicit activation and user cancellation. The [EyeDropper specification](https://wicg.github.io/eyedropper-api/) defines secure-context exposure, AbortSignal, overlap errors and suppression of page UI events during native sampling. These sources describe the native contract; the table distinguishes measured runtime behavior from that contract. Constructor availability is not a universal browser-support or color-management guarantee.

## Platform adapter and request ownership

`src/platform/eyedropper.ts` contains capability detection, synchronous native open, exact six-digit sRGB result validation/normalization and compact success/cancelled/unsupported/failed/busy outcomes. Only `sRGBHex` is read; extra source/alpha metadata is ignored. `AbortError` and an aborted signal are cancellation; activation/operation/overlap failures receive compact UI failure feedback. Raw exception strings are not primary product text.

One module-local symbol bounds active native ownership across controls. An aborted owner releases its lease; late completion cannot release a newer owner's lease. There is no new Zustand store, persistence, sampled-color cache or parallel color history. The existing Recent colors list receives the same normalized accepted color used by manual editing; cancellation stores no sampled color. Existing panel pointer-up behavior can still remember the previously accepted current color.

ColorControl rejects synthetic events and calls native open synchronously inside its trusted click handler, before any awaited work. The real button supports pointer activation and native Enter/Space activation. Programmatic clicks, hover, mounting, picking, focus alone and pointermove do not open a request. While busy the button retains focus with `aria-disabled`/`aria-busy`, and the handler rejects duplicate activation. An absent constructor uses a genuinely disabled button with a visible described reason.

## Lifetime and stale-result safety

The local request captures its exact object identity, control scope, logical `targetId`, physical `bindingGeneration`, media/pseudo context, accepted Design value snapshot and initiating button. Consumer scope names the CSS property; gradient scope includes layer, exact stop, active stop and layer model; shadow scope includes property, exact index and list model. Format and presented value changes also retire the request.

Synchronous editor/UI subscriptions invalidate pending ownership on selection/context changes, including change-away-and-back within one task. Layout cleanup aborts on control/scope/popover/inspector lifetime changes. Unmount and deactivation retire ownership. Before accepting any delayed success, ColorControl drains picker target loss and compares the fresh editor state, UI state and current control scope. Strong reconciliation may preserve a logical ID, but a new physical generation cannot inherit a pending result. Refreshed Design value snapshots are conservatively discarded even if some displayed tokens compare equal.

Stale results write nothing, add no history/Changes row and never restore a draft to a new owner. A newer request survives an older ignored-abort result. The stale UI message is local and compact. No retry loop, selection subscription that requests pixels, polling job or selector-based sampling owner exists.

The existing picker suspension now tracks independent `surface` and `sampling` reasons. Sampling releases only its own reason, preserving current picker activity and the authoritative surface owner. During a request, the color popover disables outside-press/focus-out dismissal; delayed UI events cannot dismiss it and release suspension halfway through an event gesture. Other popovers keep their existing behavior. Native Escape owns cancellation; the shared Escape policy avoids ordinary popover/gesture rollback while native ownership is pending. If Escape arrives through the HTML panel instead, it cancels the pending request and keeps the popover usable. A later Escape after accepted sampling uses the ordinary color gesture rollback.

## Color, history and output semantics

- Native sampling supplies an **opaque** concrete sRGB color. Prior alpha is intentionally replaced; HEX uses the existing `#RRGGBBff` formatter, while RGB/HSL use the existing culori utilities. Alpha sampling and extra color-management guarantees are not offered.
- Unresolved inline `var()`/`currentColor` and mixed border presentation are unchanged by opening, cancellation, failure or stale completion. Explicit success replaces the token with a concrete color. Mixed-border success replaces all four sides through the existing border callback.
- A supported gradient changes only the captured stop in the captured layer; a shadow changes only the captured box/text layer. Existing batch serialization, hidden-layer behavior and callbacks remain authoritative. Sampling accepts no arbitrary gradient syntax.
- Success starts one ordinary color gesture and applies once. Cancellation starts no gesture and never rolls back an earlier edit. Existing Escape, Undo and Reset reverse an accepted sample through the ordered CSS history. Inactive media samples remain ordinary pending conditional CSS edits.
- Changes has ordinary CSS rows with the existing before/requested/browser/effectiveness distinction. Clipboard and downloadable output contain ordinary CSS only, with no EyeDropper events, pixel coordinates, source elements, screenshots or sampling metadata. Existing selector preparation and DOM omission rules are unchanged.

## Reproduced issues and scoped fixes

The initial integration run identified loss of focus when the busy sampling button used native `disabled`. Keeping it focusable with semantic disabled/busy state and an explicit request guard corrected cancellation/new-request handling. A sampling-time outside press could also dismiss the popover and release picker suspension before a later mouse event; the request-only popover lock fixes this without changing other consumers.

An existing `parseGradient('linear-gradient(in oklab, red, blue)')` produced a fake `in oklab` color stop. This was reproduced against the unchanged baseline parser with a focused unit case: 8 passed, 1 failed. Phase 10A would otherwise enable sampling that silently replaces interpolation syntax. The scoped fix refuses a top-level `in` interpolation token in the gradient prelude, leaving the original gradient read-only. It also covers angle/hue and radial forms while preserving function-valued stop tokens. No DOM editing, reconciliation or completed Phase 09 transaction behavior was changed.

## Accessibility and performance

The compact pipette button uses the existing Lucide icon, a descriptive accessible name, native keyboard activation, visible tooltip/title, focus styling and described unsupported/busy feedback. Cancellation is quiet; failure does not expose raw browser text. Current popup scrolling/clamping supports 320px, 390px and native Chrome page zoom at 200%. These cases select a target before resizing, then exercise the actual shared sampler control and focus return. No global theme redesign, new focus trap or persistent dock entry was added.

Two 1,000-event bursts, idle and while sampling, assert identical before/after counters for platform constructor access/request creation, source indexing, cascade, locator, selector, reconciliation, Changes preparation/serialization, author mutation, DOM text and structure mutation. Native requests arise only from explicit activation. Existing owned-UI exclusion and picker infrastructure remain in charge of page selection.

## Verification ledger

The final verification and artifact results are filled from completed commands below. Automatic retries are disabled for browser verification.

| Run | Result / interpretation |
| --- | --- |
| Initial native opening/abort probe | 1 passed; verified before production UI work. |
| Initial two native probes | 1 passed, 1 timeout: toolbar activation was still live when the supposed no-gesture probe started a real request. |
| Corrected native activation/popover probes | 2 passed; explicitly waited for transient activation to expire. |
| Adapter unit suite | 19 passed. |
| Initial phase integration | 23 passed, 9 failed / 32. Five fixtures wrongly expected stylesheet tokens instead of computed values; one used a button locator for the Code tab; two selected after narrowing under the inspector; one reproduced busy-button focus loss. |
| Explicit corrected phase rerun | 33 passed, including the separate native Escape driver observation. |
| Added boundary cases | 4 passed, 2 failed / 6: interpolation gradient and sampling outside-press behavior reproduced. |
| Existing parser reproduction | 8 passed, 1 failed / 9 before the scoped parser fix. |
| Parser + adapter after fix | 28 passed / 2 files. |
| Production native integration | 1 passed: real open and abort on inspector closure. |
| Expanded phase suite | 39 passed, 1 failed / 40. The test manually assigned a surface suspension while the authoritative UI surface was null; existing UI subscriptions correctly cleared that artificial flag. |
| Explicit suspension diagnostic | 1 failed; passive call observation proved the authoritative surface updates. |
| Corrected surface-owner case | 1 passed; uses the real Changes surface and verifies that sampler cleanup preserves its suspension until it closes. |
| First full critical attempt | Intentionally interrupted after 57 passed and no failures, to add an explicit trusted-event guard identified in final review. Its exit code 1 reflects cancellation, not a failed test; a fresh full run covers the final build. |
| Complete phase suite before trust guard | 40 passed / 2 files, no retries. |
| Final complete phase suite with trust guard | 40 passed / 2 files, no retries; includes programmatic-click rejection. |
| Final standard checks | Sequential `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm zip` all exit 0 after the final phase suite. Units: 365 passed / 23 files (baseline 345 + 19 adapter + 1 parser regression). |
| Completed current critical browser run | **444 passed, 1 failed / 445**, 31 files, 12.9 minutes, `--retries=0`. First failure: case 85, `current-ui-p2.spec.ts` → P1 opaque UI paint comparison, Changes crop. All 40 Phase 10A cases passed. |
| Explicit unchanged paint-case rerun | **1 passed / 1**, `--retries=0`; production code, test and raster bounds unchanged. |
| Explicit full affected UI rerun | **15 passed / 15**, 54.2 seconds, `--retries=0`; includes the paint case with the original assertions and bounds. All 445 selected critical cases are verified across the full run and explicit reruns, rather than claimed as one clean 445/445 run. |

The full current critical command includes the two Phase 10A files and the 29 suites listed in the Phase 09B report, with `--grep-invert 'captures five Phase 03|thirteen focused views|capture Phase 02' --retries=0`. Historical screenshot-only captures remain excluded; historical reports/artifacts are not regenerated. Current diagnostics and disposable profiles stay under ignored `test-results`.

The paint failure changed 15 of 347,440 opaque crop pixels (ratio 0.0000431729), with maximum channel difference 46 against the unchanged ceiling of 1. Dimensions and alpha were identical. Changed bounds were crop x349–352, y419–424, in the cascade text rather than the feedback placement near the top of the crop. Original/red screenshots and JSON are retained under ignored `.preview/phase-10a/paint-first-failure`. The exact cause is unproven; a transient paint difference is observed, not dismissed by widening tolerances. Earlier compact progress summaries missed this failure and were corrected when final totals were inspected. The full run is not described as 445/445 green. A compact final verification ledger is retained in ignored `test-results/phase-10a-verification.json`. Node color-environment warnings and Git LF/CRLF conversion notices were toolchain diagnostics, not failed assertions.

Completed full-run counts:

| Suite | Passed |
| --- | ---: |
| `author-mutation.spec.ts` | 48 |
| `cascade.spec.ts` | 2 |
| `code-html.spec.ts` | 4 |
| `current-ui-p1.spec.ts` | 16 |
| `current-ui-p2.spec.ts` | 14 / 15; one paint failure |
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
| `phase-10a-eyedropper.spec.ts` | 36 |
| `phase-10a-native-feasibility.spec.ts` | 4 |
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

## Git and package status

`main` and HEAD remain at the authorized baseline. No staging, commit, push, tag move, reset or clean is authorized or performed. Dependencies, lockfile, manifest permissions and packaged notices are unchanged. All six ZIP file entries hash-identically to the unpacked final build. Manifest version is 3, package version `0.1.0`, permissions remain `activeTab`/`scripting`, no host permissions exist and automatic content-script registrations remain empty. The notices and Geist license are included.

| Final generated artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.output/cssforge-0.1.0-chrome.zip` | 462,664 | `763EE803A50216C2939A6C5E8D5B510E55244DA68D35DB662A098B2E7865F417` |
| `content-scripts/content.js` | 1,087,458 | `7CEABA2139AACD4AD305BA0CE1932E1C78318B0674822FA9A12E3324CF0F93DA` |
| `content-scripts/content.css` | 91,996 | `4E54F3F57C0433F177012DD822108ED8DA6657783D815F67BEDAAEDE9C2CB8B3` |

Classification: **PRODUCTION 10 files**, **TESTS 4 files**, **DOCS 3 files**. Generated `.output` ZIP/build files, `.wxt` preparation output, `.preview` output and `test-results` profiles/diagnostics are ignored rather than included in the proposed change. Historical reports and artifacts are unchanged. Final `git diff --check` exits 0. `main`, HEAD/`origin/main` and exact tag `phase-09b` remain at the baseline. Exact final `git status --short --untracked-files=all` is:

```text
 M README.md
 M docs/current-support-contract.md
 M src/editing/rich.ts
 M src/picker/controller.ts
 M src/ui/design/EditControls.tsx
 M src/ui/design/RichBackground.tsx
 M src/ui/design/RichEffects.tsx
 M src/ui/interactions/useEscapePolicy.ts
 M src/ui/popovers/Popover.tsx
 M src/ui/shared/ColorControl.tsx
 M src/ui/shared/propertyControls.module.css
 M tests/rich.test.ts
?? docs/phase-10a-native-eyedropper.md
?? src/platform/eyedropper.ts
?? tests/e2e/phase-10a-eyedropper.spec.ts
?? tests/e2e/phase-10a-native-feasibility.spec.ts
?? tests/eyedropper.test.ts
```

## Remaining native/manual limits

No real OS pixel was selected in this run. A manual native run still needs to select a page color and a CSSForge UI color, verify the returned concrete sRGB value through normal editing, and press the OS eyedropper's Escape to confirm quiet cancellation and usable focus. The deterministic result tests do not replace those observations. Native magnifier behavior, multi-monitor/color-management differences and lower Chrome versions are unverified. Firefox/Safari support is not claimed. The single non-reproduced Changes paint difference remains a recorded test-stability limitation. There is no custom screenshot fallback, palette extraction, screen capture, alpha sampling, sampled source ownership or added network/telemetry path.

## Recommended next phase — review only

| Candidate | Current foundation and main boundary |
| --- | --- |
| Interactive Pseudo-State Testing | Existing media/pseudo edits provide a useful foundation, but reliably forcing browser states needs a separate platform/permission/lifetime design. Choosing a context currently leaves browser activation natural. |
| Measurement and Layout Guides | Existing selected geometry and noninteractive overlay provide the smallest bounded foundation for useful layout feedback. Keep reads tied to the current physical target and avoid per-pointer source/computed analysis. |
| Responsive Editing | Context discovery exists, but viewport simulation, mode semantics and document-wide invalidation require a larger product/engineering scope. |

Recommend **Measurement and Layout Guides** for the next reviewed phase: it can build on current geometry/ownership without broadening native sampling or adding a state-forcing permission model. This is a scope recommendation only; no next-phase implementation is started.

## Post-implementation regression investigation

Date: 2026-10-02. The user rejected the original Phase 10A implementation after reporting unusable native sampling and noticeable lag/frequent hangs. This investigation preserved all uncommitted Phase 10A files, used `phase-09b` / `ace3789c4613fe88dc9196f2a67cc11c6d17c599` as the comparative baseline, and implemented no other phase. No reset, clean, staging, commit, push, tag operation or dependency change occurred.

Initial `git status --short` recorded the existing 12 modified and five untracked files. Initial tracked `git diff --stat`: 12 files, 97 insertions, 17 deletions. Initial `git diff --check`: exit 0; Git LF/CRLF conversion notices did not identify whitespace errors. Isolated baseline, original-candidate and fixed snapshots were built under ignored `.preview/phase-10a-investigation`; the current working tree remained authoritative.

### Reproduction and verified causes

The production Sample button called the original native `EyeDropper.open()` synchronously with trusted activation. Headed and headless Chrome requests remained pending for two seconds and through pointer/viewport changes. Ordinary window blur did not reproduce an immediate popover dismissal. The stable controller object is the `picker` dependency; the new wrapper returned by `useInspection()` did not create an unstable effect identity loop. No speculative focus/dismissal correction was added.

A real native failure was then reproduced: `picker.source(true)` on an unchanged target recreated `design.values`, and the ColorControl editor subscriber compared object identity. It aborted the already-open original native request despite equal accepted values; Chrome rejected it with `AbortError`. The failure was captured before correction. Comparing a semantic fingerprint of the complete Design values permits that harmless refresh while retaining logical target, physical generation, editing context, property/layer/stop, format, local request and actual-value checks. A synchronous change-and-return test proves the old request cannot revive even when the final values equal the original values.

The performance comparison also verified unnecessary work. Every idle ColorControl added a picker subscription and separate editor/UI lifecycle listeners. Editor lifecycle callbacks read the snapshot even without an active sample. The correction reads the stable picker directly from context and attaches exactly one editor and one manual UI listener only for the active request. A single request-identity-guarded release path detaches both, clears pending ownership before abort, and removes only the sampling suspension reason. Success, native cancellation, failure, stale state, close/unmount and late overlap use this ownership path.

### Measured performance comparison

The same representative page contained an eight-stop gradient, two box shadows, one text shadow and 13 ColorControls. Identical action segments covered inspector activation, element selection, Design, color opening, 100 pointer moves, ten open/close cycles, 120 selected-target geometry frames, section changes, real native open/cancel, target changes, Changes, inspector hiding and settled idle periods. Counters were injected into isolated source copies; no production diagnostic helper or permanent render counter was added to the current source/build.

| Measurement | Phase 09B | Original Phase 10A | Corrected Phase 10A |
| --- | ---: | ---: | ---: |
| Idle picker listeners | 8 | 21 | 8 |
| Idle editor listeners | 107 | 120 | 107 |
| Idle manual UI listeners | 2 | 15 | 2 |
| Picker deliveries / 120 geometry frames | 952 | 2,499 | 952 |
| Manual UI deliveries / ten open/close cycles | 80 | 600 | 80 |
| ColorControl renders / geometry sequence | 1,559 | 1,559 | 1,559 |
| Inspector / Design renders / geometry sequence | 119 / 119 | 119 / 119 | 119 / 119 |
| Popover renders / geometry sequence | 6,902 | 6,902 | 6,902 |
| Picker publications / geometry sequence | 119 | 119 | 119 |
| RAF callbacks / geometry sequence | 120 | 120 | 120 |
| Rectangle reads / geometry sequence | 839 | 839 | 839 |
| Computed-style reads / geometry sequence | 11,400 | 11,400 | 11,400 |
| Mutation observer callbacks / geometry sequence | 120 | 120 | 120 |
| UI publications / ten open/close cycles | 40 | 40 | 40 |
| Suspension calls / ten open/close cycles | 40 | 40 | 40 |
| Floating positioning updates / ten open/close cycles | 30 | 30 | 30 |
| Floating mount / unmount / ten cycles | 10 / 10 | 10 / 10 | 10 / 10 |
| RAF / rectangle reads / ten cycles | 50 / 360 | 50 / 360 | 50 / 360 |
| Focus calls / ten cycles | 30 | 30 | 30 |
| Settled idle renders, publications, RAF, positioning and observer callbacks | 0 | 0 | 0 |

The original added callback fanout was 2.625× for geometry and 7.5× for manual UI notifications. Fixed counts match the healthy baseline. Engine source/cascade/selector/locator/reconciliation work did not increase during geometry or pointer sequences. Listener counts returned to the same values after repeated cycles and target switches. Native sampling adds/removes one sampling reason, one editor listener and one manual UI listener; independent surface suspension remains intact.

Full action counters, observer/timer/focus/pointer results and engine snapshots are retained in ignored `baseline-profile.json`, `candidate-profile.json` and `fixed-profile.json` in the investigation directory. The manual UI listener metric covers exported `useUI.subscribe` observers/lifecycle listeners; it does **not** count internal Zustand React-hook subscriptions. UI publication counts are observed directly. Observer instance counters track `observe`/`disconnect`, not every `unobserve`; settled callback counts, bounded repeated-cycle behavior and balanced Floating UI mount/unmount provide the relevant evidence.

A 64-stop stress page mounted 69 ColorControls. Idle editor/picker/manual UI listeners were 219/8/2 at baseline, 288/77/71 in the original candidate, and 219/8/2 after correction. Geometry deliveries were 952 → 9,163 → 952; each variant rendered 8,279 ColorControls and ran 120 RAF callbacks / 839 rectangle reads. Scope serialization accounted for roughly 54–62 ms across 120 frames and was not a demonstrated dominant hang cause. Full rich-model scope identity was retained. The interpolation parser guard remained valid in its nine unit cases and was not broadened.

**Limit:** neither the representative nor the stress page reproduced an infinite update loop, idle thrashing, growing listeners, focus oscillation or a frequent hang. Wall-clock samples were noisy, including concurrent verification load; callback reductions are proven, a timing speedup is not. Baseline geometry also rerenders the existing Design tree. The user's frequent-hang cause therefore remains unconfirmed, and the report does not claim that every reported hang is fixed.

### Real Windows native lifecycle

The initial renderer-only mouse/keyboard driver could not select an OS pixel: it delivered HTML events while the original native promise stayed pending. Investigation continued through the installed Computer Use skill and its Windows native API, using only a uniquely identified disposable Chrome fixture window. This supersedes the earlier report's manual-verification gap. The user's existing windows were not used, and the controlled browser closed after verification.

| Actual native action | Original browser outcome and production state |
| --- | --- |
| Trusted production Sample activation | Native magnifier visibly appeared; original request remained pending with user activation. |
| Windows click on visible `#123456` fixture square | Original promise resolved `{sRGBHex:'#123456'}`; production color became `rgb(18,52,86)`, ordinary HEX token `#123456ff`, history count 1. Signal remained un-aborted. |
| Accepted result cleanup | Sampling reason exactly `[true,false]`; busy state cleared, existing dialog stayed visible, focus returned to Sample. |
| Second native opening followed by actual Windows Escape | Original promise rejected `AbortError` with browser message “The user canceled the selection.” Signal remained un-aborted, proving native user cancellation rather than application abort. |
| Native cancellation cleanup | Prior sampled color and history count 1 remained unchanged; sampling sequence `[true,false,true,false]`; busy cleared and Sample focus/dialog remained usable. |
| Identical source refresh after correction | Recreated values object; native request stayed pending, no abort or edit. |
| Actual editing value change | Original native promise aborted; the deliberate existing CSS edit remained authoritative. |
| Six native open/cancel cycles | Exactly six matching acquire/release pairs; no accumulated sampling suspension; focus/popover restored each time. |

Original native result and cancellation state are saved in ignored `.preview/phase-10a-native-desktop/native-success.json` and `native-escape.json`. Test-world wrappers passed the original native promise through unchanged; no simulated success supplied these two desktop observations. The native dwell probe deliberately schedules a test-only heartbeat to prove renderer responsiveness; performance counters above come from separate profiles without that heartbeat.

### Added regressions and final verification

- Two deterministic production-control tests: identical Design refresh accepts one sample; a synchronous actual-value change and return cannot revive a retired request.
- Seven real native tests: headless/headed dwell, unchanged refresh, actual value invalidation, six cancel cycles, second gradient-stop keyboard focus and exact renderer-driver limitation. Headed launch arguments are checked explicitly.
- Three performance tests: baseline-derived idle listener counts, 12 cancellation cycles, success/failure/stale/close/late-overlap cleanup with no duplicate disposal, and zero settled RAF/observer/focus drift after repeated popup cycles.

| Investigation run | Exact result / interpretation |
| --- | --- |
| Original-candidate headless/headed native dwell | 2 passed / 2, 11.9 seconds. |
| Original-candidate identical-refresh and pixel-driver probes | 0 passed, 2 failed / 2. One reproduces the native refresh defect; the other incorrectly expected renderer Escape to cancel after renderer clicking moved focus to BODY. |
| Corrected renderer pixel-driver probe | 1 passed / 1, 5.3 seconds. Records pending native input explicitly and uses production inspector-close abort as cleanup when renderer Escape cannot reach it. |
| Original-candidate actual-value / six cancel cycles / second-stop probes | 3 passed / 3, 11.3 seconds. |
| Fixed original Phase 10A files plus two refresh regressions | 42 passed / 42, 1.5 minutes. |
| Expanded performance regression file | 3 passed / 3, 13.6 seconds. |
| Explicit original-candidate performance red check | 1 failed / 1, 6.3 seconds: idle editor/picker listeners 120/21 versus healthy 107/8. |
| Final strengthened performance file | 3 passed / 3, 19.2 seconds; also requires zero duplicate cleanup. |
| Final real native investigation file | 7 passed / 7, 30.6 seconds. |
| Real Windows native desktop observations | Original native pixel success and actual OS Escape both verified; separate tool-driven observations, not counted as additional Playwright cases. |
| Required sequential standard commands | `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm zip`: all exit 0. Units: 365 / 23 files. A final typecheck after the native/performance test assertions were frozen also exits 0. |

Every browser run above used `--retries=0`. The native probe's initial renderer-input assumption was corrected without supplying a fake native result. Outside the test counts, package loading and sandboxed desktop-launch diagnostics required using the installed `@playwright/test` module and an escalated controlled visible browser; a missing `--enable-automation` diagnostic flag was added only to test launches. A read-only process probe was denied and not retried. A Windows input guard required refreshed observed window state before proceeding. None changed production behavior or extension permissions.

The complete current critical run finished with **456 passed, 1 failed / 457**, 33 files, 16.2 minutes, `--retries=0`. Its only failure was case 50, `cascade.spec.ts:59`: the browser received `net::ERR_CONNECTION_REFUSED` while importing `/src/engine/sources/index.ts` from the local Vite test server. This case exercises native CSSOM, not EyeDropper. The shared temporary server had exited; a server owned by the investigation restored the endpoint. The first server restart attempt found the port temporarily occupied; the next start remained alive through completion. No production code, cascade assertion or test tolerance changed for this failure.

Explicit unchanged `cascade.spec.ts` rerun: **2 passed / 2**, 4.4 seconds, `--retries=0`. Thus all 457 selected critical cases are verified across the full run and that explicit rerun; this is **not** described as one clean 457/457 run. All 52 Phase 10A cases passed within the full run. The earlier paint comparison passed in this run with its existing assertions; its historical failure remains recorded above. No paint bounds were widened.

The full command is the previously recorded critical command with `phase-10a-native-investigation.spec.ts` and `phase-10a-performance.spec.ts` added, and output directed to ignored `.preview/phase-10a-investigation/critical-results`. The complete command, suite counts, final artifact hashes and outcome are retained in `verification.json`; the complete captured output is `critical.log` beside it. Historical screenshot-only cases remain excluded by the same grep-invert expression.

| Current critical suite | Full-run passed |
| --- | ---: |
| `author-mutation.spec.ts` | 48 |
| `cascade.spec.ts` | 1 passed, 1 failed |
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
| `phase-10a-eyedropper.spec.ts` | 38 |
| `phase-10a-native-feasibility.spec.ts` | 4 |
| `phase-10a-native-investigation.spec.ts` | 7 |
| `phase-10a-performance.spec.ts` | 3 |
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

### Final package and Git state

No temporary diagnostic code exists in `src`, `entrypoints` or the final content bundle. Instrumented copies, counters, native desktop helper and evidence are ignored investigation/test artifacts. The controlled desktop browser exited; the investigation's local test server is stopped after verification. Six ZIP file entries hash-match the unpacked build (the ZIP also contains a directory entry). An initial archive diagnostic attempted to hash that directory as a file; skipping directory entries verified every packaged file. Permissions remain `activeTab`/`scripting`; there are no host permissions or automatic content-script registrations. Notices, fonts, dependency versions and lockfile are unchanged.

| Corrected artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.output/cssforge-0.1.0-chrome.zip` | 462,748 | `27D31AABC490F4795B1428AB7E57CE1821D802020EBC5471DCC57C6EDC4B3D5C` |
| `content-scripts/content.js` | 1,087,554 | `761FBBBCD1419B9B0356CE379F4D77923683EDCDD46AEBECE49DA7144E02D4E8` |
| `content-scripts/content.css` | 91,996 | `4E54F3F57C0433F177012DD822108ED8DA6657783D815F67BEDAAEDE9C2CB8B3` |

`main`, HEAD, `origin/main` and exact tag `phase-09b` remain at `ace3789c4613fe88dc9196f2a67cc11c6d17c599`. No tag was moved or rewritten. Current classification is 10 production, 6 test and 3 documentation files; 19 files total. Tracked-only diffstat is 12 files, 103 insertions and 17 deletions; it excludes untracked additions. Final whitespace validation exits 0. Exact status:

```text
 M README.md
 M docs/current-support-contract.md
 M src/editing/rich.ts
 M src/picker/controller.ts
 M src/ui/design/EditControls.tsx
 M src/ui/design/RichBackground.tsx
 M src/ui/design/RichEffects.tsx
 M src/ui/interactions/useEscapePolicy.ts
 M src/ui/popovers/Popover.tsx
 M src/ui/shared/ColorControl.tsx
 M src/ui/shared/propertyControls.module.css
 M tests/rich.test.ts
?? docs/phase-10a-native-eyedropper.md
?? src/platform/eyedropper.ts
?? tests/e2e/phase-10a-eyedropper.spec.ts
?? tests/e2e/phase-10a-native-feasibility.spec.ts
?? tests/e2e/phase-10a-native-investigation.spec.ts
?? tests/e2e/phase-10a-performance.spec.ts
?? tests/eyedropper.test.ts
```

### Historical readiness decision before the edit-time investigation

**Phase 10A remains NOT COMPLETE / NOT ACCEPTED.** The reproduced native false cancellation and measured idle subscription overhead are fixed and covered. Actual Windows pixel selection, native Escape, focus, transactions and suspension cleanup are verified. No important native-functionality issue was reproduced on the corrected controlled fixture. The reported frequent hangs were investigated with comparative UI/engine/observer/focus/positioning measurements and a larger gradient stress page, but their exact cause was not established. It would be inaccurate to declare that report fully resolved or to promise a measured wall-clock speedup. No manual debugging/validation task is assigned to the user, and no next phase is started.

## EDIT-TIME PERFORMANCE / HANG INVESTIGATION

Completed investigation: 2026-10-03, Europe/Berlin. This investigation follows the user's report that continuous Design edits feel delayed, heavy and sometimes hung. Feature development stopped. The original implementation and regression records above remain historical; this section records the later heavy-page investigation and its separate acceptance evidence. No commit, push, tag, reset, clean or staging operation is authorized or performed.

### Preservation and comparison method

Before new changes, `git status --short` showed the existing 12 modified and seven untracked Phase 10A files. The tracked diff contained 103 insertions and 17 deletions; `git diff --check` exited 0. `main`, HEAD and `phase-09b` remained `ace3789c4613fe88dc9196f2a67cc11c6d17c599`. Baselines were assembled under ignored `.preview/edit-time-performance/clean-builds`, using the committed archive and preserved original/corrected Phase 10A source copies. The original candidate's clean content JS matches its historical artifact hash; all 115 corrected production source files matched the pre-optimization working tree. No diagnostic instrumentation is present in these comparison bundles.

| Preserved content JS | SHA-256 |
| --- | --- |
| Phase 09B | `43720C264B9A995C72F67E8559A35FEA023525DAA02C819B005E52BB4AB7F00C` |
| Original Phase 10A | `7CEABA2139AACD4AD305BA0CE1932E1C78318B0674822FA9A12E3324CF0F93DA` |
| Corrected Phase 10A before cascade fix | `761FBBBCD1419B9B0356CE379F4D77923683EDCDD46AEBECE49DA7144E02D4E8` |

All primary cases use Chrome 154.0.8037.93, 1440×1100 viewport, zoom 1, a disposable persistent profile, the real unpacked MV3 extension and trusted toolbar activation. The same target IDs, initial target styles and native control interactions are used across builds. Each gesture issues 240 independently scheduled trusted CDP pointer moves over four seconds, ending at a distinct +32px displacement, then pointer-up and 500ms settling. Acknowledgement latency cannot backpressure scheduled moves. Numeric scaling is calibrated through a public drag and Undo before timing. Hue starts from an ordinary accepted `#336699ff` so color changes are visible. Final values and one transaction/ordinary Undo are verified.

Main/isolated-world capture counters measure delivered input, not React handler completion. New owned CSS layers measure accepted preview writes separately. First RAF and second RAF latencies are recorded; the second RAF is a conservative **paint-opportunity proxy**, not actual pixel capture. Primary monitoring adds no computed-style or rectangle reads. Browser scripting/style/layout metrics, long tasks, frame intervals, queue delay and post-pointer-up write tail are measured separately. Short Chrome traces and isolated counter builds are supplemental evidence and are not substituted for uninstrumented latency.

### Fixtures and workload

`tests/e2e/fixtures/design-performance-heavy.html` was created before profiling internals. It contains 852 light-DOM elements and 26 elements in an accessible open ShadowRoot: **878 total**, 28 repeated cards, four inline SVG visuals, seven light-DOM and one shadow style block, 292 style rules and a roughly 7,140px document at the fixture audit viewport. The harness's main-document count 854 includes the two injected CSSForge hosts after activation. It exercises nested Grid/Flex and overflow, sticky/fixed/absolute positioning, transforms, custom properties/inheritance, selector lists, competing declarations, media/supports/nested contexts, pseudo-elements/states, `:nth-child`, `:has`, siblings and attributes. Target animations/transitions are disabled during measurement; no uncontrolled animation or CPU loop supplies the complexity.

The simple fixture contains 30 main-document elements, three style blocks and 31 rules. Both fixtures expose `#layout-target` and `#effects-target` with identical starting computed values. Heavy targets have 13/11 matching rules versus four each on the simple page. The effects target has layered six-stop linear/radial backgrounds, three box shadows, two text shadows, filters, border and opacity. Both targets are visible beside the inspector at the measured viewport.

The 11 workloads per profile are Width, padding-top, margin-left, font-size, line-height, border radius, box-shadow blur, text-shadow blur, filter Blur, Text color Hue and Gradient direction. Controls and sections use their real UI; collapsed children remain mounted in the current implementation.

### Reproduction and pre-fix comparison

The heavy fixture exposed substantial CSSForge scripting cost and delayed feedback, shared by all three versions. A separate clean Width comparison produced current/09B/original paint-opportunity p95 of 74.1/72.6/70.3ms and scripting time 3.070/3.025/2.979s during approximately 4.65s windows. All three reached 512px, created one transaction and restored 480px with Undo. These are descriptive single trials, not proof of a causal Phase 10A timing difference.

The complete pre-fix series covers 22 workloads per version. Current verification was 20 passes plus two explicit corrected color reruns; Phase 09B was 21 passes plus an artifact-close failure and explicit two-Width rerun; original Phase 10A passed all 22 in one run. Across the current pre-fix series, maximum paint-opportunity latency was 108.2ms, input queue delay 32ms, frame interval 66.7ms and final-write tail 49.5ms. The longest task was 67ms. A 359.2ms timer-heartbeat gap alone does not establish an event-loop hang. No multi-second stall or sustained backlog reproduced under these inputs. The user's reported real-page hang therefore remains a distinct, unconfirmed symptom; the shared redundant edit work is confirmed.

### One warmed accepted Width edit

An isolated readable diagnostic copy, loaded as the real extension, recorded this pipeline after a warm-up edit:

`trusted ArrowUp → Numeric apply → session apply/render CSS → one owned layer write → one history update → three editor publications → one computed Design snapshot → effectiveness cascade → one picker publication → React commit → geometry RAF/observer feedback`.

The edit delivered 282 editor notifications across 94 subscribers, eight picker notifications and no UI-store publication. The real Zustand vanilla store was wrapped before React subscribed: 249 active listeners include one diagnostic meter, hence **248 application listeners**. One Inspector and LiveDesign render accompanied 34 Numeric, four ColorControl, 40 Popover, nine Section, one RichBackground, two RichShadow and one RichFilters render. There was one React commit. Collapsed/inactive controls still rerender. Those counts establish fanout; they do not establish that all render time dominates the cascade. Three session projections took approximately 0.2ms and notification delivery 0.4ms in this diagnostic sample, so publication batching was not selected as the first optimization.

There was one selected-target `getComputedStyle` call and 43 property reads, not one call per control. Four rectangles were read: synchronous selected-target inspection, two selected-target geometry callbacks and the overlay label. Two RAF callbacks, three MutationObserver callbacks and three ResizeObserver callbacks settled without pending idle work. Closed popovers performed zero Floating UI/Tooltip positioning updates. Mutation/Resize feedback can schedule one extra geometry pass, but the overlay's stable-paint cache prevents an ongoing write loop.

Six cascade resolutions traversed the target and five ancestors, performing 1,680 selector matches and **1,026 property resolutions**. Warm outer cascade/effectiveness/apply times were approximately 14.7/15.7/18ms in the earlier diagnostic copy. Recursive inclusive cascade totals count nested work repeatedly and must not be added as wall-clock time. First-use CSSOM shorthand expansion performed 596 scratch `style.setProperty` calls; warm input performed two. Later richer instrumentation increased measured handler duration, so parser timing percentages are not production timing claims.

### Confirmed bottleneck and scoped production fix

Before editing production code, `.preview/edit-time-performance/investigation-notes.md` recorded PROBLEM, EVIDENCE, ROOT CAUSE, PROPOSED FIX, EXPECTED REDUCTION and CORRECTNESS RISK. Classification: **PRE-EXISTING PERFORMANCE BUG**. `effectsFor` only consumes contributions associated with its override declarations but requested a complete author-cascade result for every intermediate preview and ancestor. Unrelated candidate allocation and property resolution were repeated even for Width.

`createCascade.readProperties` now expands the actual declaration values, restricts candidate construction/property resolution to every requested longhand contribution, and recurses with that contribution set. `effectsFor` uses it. Full `read` for provenance remains unchanged. Fresh native selector matching, complete global all/logical/motion/layer/source checks, registered-token uncertainty, inheritance/defaulting, active outside-context evidence, source position and existing invalidation still apply. Full/scoped cache keys are distinct. Preview scheduling, computed Design reads, history, final-value handling and native sampling ownership were not changed.

The expected one-property resolution reduction was approximately 1,026 to six per warm Width edit. Correctness risks are shorthand/pending substitution, inherited/custom/defaulted values, incomplete global evidence, native media/pseudo activity, actual layer position and invalidation. The pre-fix focused test failed because Width returned 251 properties instead of one; this was an excess-work semantic assertion rather than a missing-API error. Initial fixed tests passed 51 cases; further uncertainty cases and native CSSOM equivalence are included in final verification below.

### Diagnostic limitations and failure classification

All failed runs and explicit reruns remain in ignored logs/artifacts. The ledger is `.preview/edit-time-performance/harness-failure-ledger.md`; counter limitations are in `diagnostic-quality-ledger.md`.

- **TEST DEFECT:** initial activation helper awaited Pick while already picking; one 90s setup failure preceded any measured gesture. Corrected initial-state handling.
- **TEST DEFECT:** raw pointer preparation lost control ownership, producing 484px rather than 512px. Native hover/down acknowledgements, left-button moves and collapsed textbox selection corrected it; failed capture data remain preserved.
- **TEST DEFECT:** first valid short-trace summary chose a blank renderer and included trace-drain time. Fixture renderer selection and stop-before-I/O corrected it. Its 387ms post-drain heartbeat is excluded from product lag claims.
- **TEST DEFECT:** two color cleanup failures followed successful timed gestures. Escape already cancelled the popup gesture before a second Undo. Trigger close followed by ordinary Undo passed both explicit reruns.
- **ENVIRONMENT:** Phase 09B Heavy Width passed its edit assertions, then Playwright trace ZIP packaging failed in `context.close()` with a byte-count/central-directory error. Live harness edits are a plausible, unproven cause. Sources were frozen and both Width profiles passed an explicit rerun, 16.9s. No failure is suppressed.
- **ENVIRONMENT:** a 1.23s unit run may have overlapped the first Phase 09B simple Width timing window. That measurement is preserved; the clean explicit Width remeasurement is used in comparisons.
- **TEST DEFECT:** the first geometry supplement did not restart picking and retained layout-target while moving effects-target. It accurately attributed open-popup library calls but cannot establish effects-target geometry/render behavior. Corrected repicking asserts the actual selected target.
- **ENVIRONMENT:** copied-build pnpm shim/junction setup and an isolated WXT config factory/cwd mismatch failed before useful measurements. No dependency install or purge occurred; one generated root rebuild matched the preserved clean content hash exactly.

The test-only watchdog was chosen after observing pre-fix bounds. It flags a heartbeat gap over one second only with a corroborating one-second long task/input queue/delivery gap, or a 20s acknowledgement timeout; timer starvation alone remains informational. Partial input/diagnostic records are retained on failure. It ships only in tests.

### Computed-style callers, geometry and inactive surfaces

The corrected finite geometry supplement explicitly selected effects-target before moving it for 120 animation frames. With the Text color popup closed, it performed zero computed-style, Floating UI or Tooltip positioning updates. It published picker geometry 119 times (952 deliveries), performed no editor publication/cascade analysis, and made 120 React commits. With one Text color popup open, it made 120 Floating updates, 11,400 computed-style calls and 67,800 CSS property requests; picker geometry published 120 times (960 deliveries), editor/cascade work remained zero, and React made 121 commits. These geometry-only inputs are distinct from sustained parameter editing.

| Floating caller | Calls over 120 open updates | CSS property requests |
| --- | ---: | ---: |
| Containing-block ancestry | 6,600 | 59,400 |
| Overflow ancestry | 1,440 | 5,760 |
| Clipping ancestry | 1,440 | 120 |
| Viewport clipping | 720 | 1,080 |
| RTL | 480 | 480 |
| Offset parent | 480 | 480 |
| Dimensions | 240 | 480 |

The 95 calls per open update explain the old 11,400 observation. Containing-block checks query transform/translate/scale/rotate/perspective/backdropFilter/filter/willChange/contain. API return duration excludes lazy property getter/style/layout cost and is not a layout duration. Classification: **PROPERTY-SPECIFIC COST / expected active popup positioning**, with no closed-popup positioning leak. Correct collision/reposition behavior is preserved; no Floating optimization was justified by this sample.

Geometry publications also rerender unrelated controls: the corrected closed sequence made 32,908 named component calls, including 5,280 Numeric and 1,320 ColorControl calls. The open sequence made 33,241 named calls. This is confirmed shared presentation fanout, rather than effectiveness reanalysis. It remains measured architectural work; the first scoped fix addresses the separately confirmed cascade bottleneck. One accepted Width edit's Code, HTML, Navigator and Changes render counters were zero. Changes' authoritative projection still ran with editor publications; its closed surface did not render. Active Design's collapsed sections keep children mounted and rerender their presentation.

Five warmed Width edits recorded 15 editor publications/1,410 deliveries, five picker publications/40 deliveries, five React commits, five computed snapshots/215 property reads, 20 rectangles and ten RAF callbacks. Three MutationObservers watched 61 targets across their sets and three ResizeObservers watched 49, with the same node possibly watched by multiple owners. Each edit delivered three callbacks of each observer type. Pending RAF/timers returned to zero. The second geometry callback did not publish again after unchanged geometry. No runaway owned-mutation → effectiveness → write loop was observed.

Five diagnostic edits also made 8,420 selector-specificity parses for only 246 unique selector texts, 25,220 expansion lookups (25,215 hits) and 63,995 candidate allocations. These are remaining preparation costs, recorded without speculative metadata/DOM-result caching. Diagnostic stack/timer/proxy overhead materially affects timing; no exact production percentage is assigned from nested marker totals.

### Before / after results

The uninstrumented after-fix series passed **22/22**, retries 0, in 2.8 minutes. Each case retained continuous preview during its first second, the final pointer value and exactly one gesture transaction, then restored its initial computed value through ordinary Undo. The same native four-second schedule and target settings were used. These are descriptive trials on this fixture/browser, not confidence intervals or a claim about every production site. More writes after the fix reflect more live work completed; scripting time must be read alongside that throughput.

| Profile / property | 09B p95 ms | Original 10A p95 ms | Current before p95 ms | After p95 ms | Accepted writes before → after | Script ms before → after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Simple Width | 40.5 | 34.3 | 34.0 | 19.1 | 174 → 176 | 2,269 → 1,619 |
| Simple padding | 39.6 | 33.4 | 29.7 | 25.4 | 174 → 171 | 2,079 → 1,676 |
| Simple margin | 37.9 | 41.3 | 29.5 | 23.6 | 175 → 175 | 2,142 → 1,740 |
| Simple font-size | 41.6 | 42.3 | 46.4 | 32.3 | 166 → 175 | 2,256 → 1,899 |
| Simple line-height | 36.9 | 35.8 | 35.9 | 24.6 | 173 → 173 | 2,274 → 1,777 |
| Simple radius | 33.7 | 36.8 | 33.8 | 17.8 | 175 → 174 | 2,245 → 1,494 |
| Simple box-shadow | 44.1 | 47.8 | 41.7 | 26.8 | 162 → 172 | 2,918 → 2,138 |
| Simple text-shadow | 49.8 | 47.3 | 47.4 | 35.0 | 148 → 173 | 3,009 → 2,550 |
| Simple filter | 43.8 | 49.0 | 43.3 | 35.8 | 160 → 177 | 2,513 → 2,116 |
| Simple color | 29.5 | 29.0 | 24.3 | 16.7 | 156 → 178 | 2,532 → 1,979 |
| Simple gradient | 48.9 | 46.2 | 40.7 | 37.8 | 159 → 169 | 2,624 → 2,701 |
| Heavy Width | 54.3 | 76.0 | 60.1 | 37.7 | 129 → 168 | 2,869 → 2,478 |
| Heavy padding | 66.6 | 66.4 | 64.6 | 35.6 | 132 → 169 | 2,880 → 2,381 |
| Heavy margin | 69.5 | 66.1 | 65.5 | 36.6 | 122 → 172 | 2,992 → 2,508 |
| Heavy font-size | 70.0 | 85.3 | 84.2 | 44.5 | 113 → 155 | 2,891 → 2,460 |
| Heavy line-height | 80.1 | 63.2 | 72.1 | 41.0 | 125 → 165 | 2,997 → 2,486 |
| Heavy radius | 61.0 | 48.7 | 66.5 | 35.1 | 121 → 174 | 3,120 → 2,526 |
| Heavy box-shadow | 75.2 | 65.4 | 81.9 | 42.0 | 103 → 159 | 3,298 → 2,923 |
| Heavy text-shadow | 84.5 | 73.6 | 84.2 | 47.5 | 105 → 141 | 3,213 → 3,000 |
| Heavy filter | 78.8 | 67.4 | 78.3 | 55.5 | 108 → 146 | 3,149 → 2,743 |
| Heavy color | 38.3 | 30.5 | 43.5 | 26.7 | 106 → 144 | 3,044 → 2,523 |
| Heavy gradient | 78.2 | 76.7 | 98.7 | 48.2 | 94 → 141 | 3,315 → 2,934 |

All p95 columns refer to the second-RAF paint-opportunity proxy. The Phase 09B Width column uses its clean explicit remeasurement. Current color columns use the explicit successful cleanup reruns. Complete median/p95/max, input-delivery/write counts, first-RAF, frames, long tasks, queue/tail, browser scripting/style/layout and raw trusted-pointer records are in ignored per-case JSON and `measurement-summary.json`. Simple gradient's total scripting rose slightly as more writes completed; no uniform total-scripting speedup is claimed.

Across all 22 after cases, maximum paint-opportunity latency fell 108.2→74.9ms, input queue delay 32.0→25.4ms, frame interval 66.7→42.6ms and final-write tail 49.5→25.8ms. There were **zero long tasks over 50ms**, zero frame intervals over 50ms and zero corroborated watchdog stalls. Timer heartbeat maximum was 206.1ms. No input remained processing for seconds after pointer-up. Layout/style/paint remain real browser work; the optimization does not suppress them.

| Warm Width operation | Before | After |
| --- | ---: | ---: |
| Cascade target/ancestor resolutions | 6 | 6 |
| Property resolutions | 1,026 | 6 |
| Candidate constructions | 12,799 | 133 |
| Expansion lookups | 5,044 | 4,226 |
| Fresh selector matches | 1,680 | 1,680 |
| Selected computed snapshots / property reads | 1 / 43 | 1 / 43 |
| Rectangle reads | 4 | 4 |
| Editor publications / deliveries | 3 / 282 | 3 / 282 |
| Picker publications / deliveries | 1 / 8 | 1 / 8 |
| Warm React commits | 1 | 1 |
| Geometry RAF callbacks | 2 | 2 |
| Closed Floating / Tooltip updates | 0 / 0 | 0 / 0 |

This removes 99.4% of Width property resolutions and 99.0% of candidate constructions without omitting fresh matching or authoritative updates. The after diagnostic's first edit made two commits; its warmed edit made one, matching the comparable warm sample. Five warmed after inputs resolved 30 properties and built 665 candidates rather than 5,130 and 63,995. A separate heavy-target real CSSOM probe matched full/scoped property evidence and global issues for Width, border (17 contributions), padding (four), font (19), background-image, box-shadow, text-shadow, filter and a custom property, with no differences or page errors.

### Focused Chrome tracing

Separate before/after Width tests captured a four-second move sequence on the active fixture renderer. Both passed. The recorder stops before trace stream I/O/JSON decoding. Trace startup includes an approximately 88ms CPU-profiler start operation in the before capture; it precedes the monitored gesture and is not a CSSForge hang. Nested categories overlap and must not be summed.

| Active renderer category | Before inclusive ms | After inclusive ms |
| --- | ---: | ---: |
| FunctionCall | 3,041.3 | 2,497.3 |
| FireAnimationFrame | 2,963.8 | 2,438.6 |
| UpdateLayoutTree | 101.2 | 105.6 |
| Layout | 112.3 | 107.7 |
| Paint | 225.2 | 266.9 |
| MinorGC | 191.3 | 68.7 |
| EventDispatch | 82.7 | 88.7 |

Scripting/animation-frame work dominates these captures. The after trace completes more live preview work; more painting is expected, not evidence that painting was removed. Actual browser layout stays near the same total. Native EventDispatch is short because the existing control schedules accepted previews through RAF. Plain-build per-case timings above remain the primary latency evidence. Raw traces stay ignored under `.preview/edit-time-performance`; no entire-suite Chrome performance trace was recorded.

### Lifecycle stress and memory boundary

Each eight-cycle scenario selects layout-target, scrubs Width, checks/undoes the final value, opens/closes sections, selects effects-target, edits/opens/closes color, uses Changes, deactivates/reactivates and returns to an identical settled layout-target state. GC and ownership sampling occur outside timed input. Before diagnostic cycles passed after a counter repair, after diagnostic cycles passed in 41.6s, and after plain-build trace plus cycles passed 2/2 in 50.1s.

The first diagnostic cycle assertion failed because its unsubscribe meter decremented only successful Set deletions while production destruction had already called `clear()`. Native counts were flat even in that failed run. Classification: **TEST DEFECT / isolated diagnostic counter**. The copied instrumentation now accounts for actual clear sizes and removes destroyed collection identities. It records real listener Set owners as an independent check. Failed and corrected artifacts are retained.

After all eight diagnostic cycles, settled active ownership is exactly one editor Set/94 listeners, one picker Set/eight listeners, and one UI collection/249 listeners (248 app plus one diagnostic meter). One MutationObserver watches 30 targets and two ResizeObservers watch 25; pending RAF, timer, Floating and Tooltip counts are zero. Deactivation has zero editor/picker owners/listeners, zero observer instances/targets and zero pending callbacks; the UI diagnostic meter alone remains. These values are identical in every cycle.

The main-world test recorder also retained its first control node after `stop()`. It now clears that reference after recording plain identity booleans. Classification: **TEST DEFECT / bounded recorder retention**; it does not change pointer scheduling or production. This reduces absolute native listener/node counts versus the earlier counter run, so that decrease is not attributed to the cascade optimization.

| Plain after-fix phase, all eight cycles | Event listeners | Nodes |
| --- | ---: | ---: |
| Settled active | 811 | 11,460 |
| Deactivated | 451 | 7,784 |

Plain cycle durations were 4.83, 4.30, 4.29, 4.30, 4.34, 4.28, 4.29 and 4.42s. No growing per-cycle slowdown or listener/observer/DOM accumulation was found. The first cycle includes cold work. Browser documents/frames/resources/layout-object counts also remain constant.

**Heap is not flat:** plain post-GC active heap rose 12.32→13.36MB and inactive heap 8.79→9.71MB over eight cycles. Diagnostic copies showed a similar approximately 1MB rise. A read-only ownership audit found two bounded retainers: the test's isolated `__p` holds its current picker through deactivation, and production `focus.ts` retains its last surface opener until a later opening replaces it. Neither proves cumulative growth. Controller caches are per-instance WeakMaps reset on destruction, editor/tree collections clear, the expander Map is capped at 2,000, Recent colors at ten, CDP reads return values and temporary element handles are disposed. The remaining heap increase is **UNCONFIRMED / unattributed**, with no demonstrated plateau or proven product leak. Retainer snapshots would be needed to assign it. This evidence supports bounded measured ownership and cycle cost; it does not claim zero retained references or unlimited-session memory stability.

An additional **32-cycle plain-build check passed, 1/1 in 2.4 minutes, with `--retries=0`**. All cycles used one persistent browser and the same heavy fixture; four rounds reused the existing eight-cycle sequence. The private runner and complete data remain ignored in `extended-e2e` and `after-current10a-memory-32.json`. All 32 active samples had 811 listeners/11,460 nodes, and all 32 deactivated samples had 451/7,784. Documents, frames, resources and layout-object counts also stayed constant. The cold first cycle took 4.687s; subsequent cycles ranged 3.941–4.132s, with 27–29 preview writes each. There was no material accumulating cycle slowdown.

| Cycle | Active post-GC heap, decimal MB | Inactive post-GC heap, decimal MB | Cycle seconds |
| --- | ---: | ---: | ---: |
| 1 | 12.391 | 8.797 | 4.687 |
| 8 | 13.350 | 9.694 | 4.129 |
| 16 | 13.676 | 10.116 | 3.990 |
| 24 | 13.805 | 10.248 | 4.039 |
| 32 | 13.894 | 10.334 | 4.094 |

Total active/inactive growth was 1,503,448/1,537,260 bytes. Within the final eight cycles it was 88,524/72,576 bytes. Growth decelerates substantially, but this is **not a demonstrated plateau**. Constant native ownership and cycle cost do not prove the absence of a memory leak; exact heap attribution remains unconfirmed. The diagnostic ownership run establishes subscriber/observer cleanup independently. No speculative production memory change was made.

### Native regression safety and normal checks

The scoped performance change leaves native ColorControl request identity, semantic refresh tolerance, stale target/binding/context/property/layer/stop guards, active-request-only subscriptions, sampling suspension ownership, focus, one transaction, Undo and Changes paths intact. The earlier actual Windows `#123456` pixel success and OS Escape evidence remain valid historical native checks; the performance change does not modify the platform sampler. Final browser verification reruns all Phase 10A cases below.

Sequential required checks passed: `pnpm typecheck`, **394 unit tests in 24 files**, `pnpm build` and `pnpm zip`. A further typecheck passed after the one-line test-recorder cleanup. The 29 scoped-cascade unit cases plus 28 existing cascade cases all pass. The new native CSSOM browser case matches full/scoped candidates, effects and outside-context evidence across 14 stages/contexts including shorthands, media/pseudo, global uncertainty, later author source/layer promotion, live class matching, disabled edits and open-shadow host mutation. The watchdog semantic browser-suite case also passed; the focused invocation passed 2/2 before primary timing.

### Full critical browser verification and explicit rerun

The current full critical run selected 35 suites, the previous 33 plus `cascade-performance.spec.ts` and `edit-time-performance.spec.ts`, with the historical screenshot-only exclusions and **`--retries=0`**. It includes Phase 08A/08B/09A/09B/10A, source/cascade, author/editing/conflict truth, ColorControl/rich controls, targeting/reconciliation, DOM/text/structure, Changes/Copy/Export, Code/HTML/Navigator, P1/P2, focus, hostile pages, native zoom and performance. Exact invocation and full output remain in ignored `run-critical.ps1` and `final-critical.log`.

**Initial result: 481 passed / one failed, 482 total, 15.3 minutes, exit 1.** Every Phase 10A case passed: 38 EyeDropper integrations, four native feasibility, seven native investigation and three ownership/performance cases (52 total). All 24 new edit-time/watchdog/cycle cases and the native scoped-cascade case passed. The second plain-build 22-workload series inside this run also had no long tasks or watchdog stalls; heavy p95 values ranged 21.3–38.0ms and final-write tail stayed at or below 21.5ms. It provides a separate stability observation, not a replacement for the primary before/after numbers.

The sole failure was `UI03-normal feedback paints behind inspector dock color unit Changes and Navigator`, in the Changes crop. Dimensions/alpha matched, both pixel-ratio budgets passed, and 15 of 347,440 pixels (0.004317%) differed in a 4×6 region; maximum channel difference 46 exceeded the unchanged limit of one. Retained PNGs and exact RGBA decoding show a glyph stem exchanging adjacent columns, with all colors remaining cool gray and RGB shifts agreeing within three levels. Visible text remains `margin-top: Applied`, `Wins supported author cascade`, requested `16px !important`. This supports **FLAKE / localized text rasterization or compositing variation**, rather than a red feedback leak or changed effectiveness state. Screenshots alone cannot prove the precise browser/layout cause.

The unchanged case was then run explicitly with **`--repeat-each=3 --retries=0`** in a distinct output directory: **three passed, 16.3s**. Production, test logic and all raster budgets stayed unchanged. The first failed PNGs, JSON, trace and error context remain preserved in `critical-results`; rerun output is separate. This is not described as a clean 482-pass first invocation. No failure was hidden, no automatic retry enabled and no raster budget widened.

### Root-cause classification and acceptance boundary

| Finding | Classification | Result |
| --- | --- | --- |
| Native request aborted by an identical source refresh | PHASE 10A REGRESSION | Previously reproduced, fixed and preserved in final tests |
| Idle ColorControl picker/UI subscriptions | PHASE 10A REGRESSION | Previously measured, moved to active request ownership and preserved |
| Full unrelated cascade work on every accepted preview | PRE-EXISTING PERFORMANCE BUG | Confirmed across 09B/original/current, fixed with scoped contribution analysis |
| Broad Design/control render fanout on edit/geometry publications | PRE-EXISTING PERFORMANCE ARCHITECTURE | Measured; no accumulating ownership, broader rewrite not justified for this fix |
| Rich parsing and active popup positioning | PROPERTY-SPECIFIC COST | Measured, retained; closed positioning is zero |
| Style/layout/paint after live CSS changes | EXPECTED BROWSER LAYOUT COST | Measured separately, not suppressed |
| Driver, trace boundary, color cleanup and counter mistakes | TEST-FIXTURE ARTIFACT / TEST DEFECT | Preserved and corrected with explicit reruns |
| Multi-second user-reported hang on the original real page | UNCONFIRMED | Did not reproduce across comparative heavy workloads; no claim that its exact real-page trigger was captured |
| Residual post-GC heap growth | UNCONFIRMED | Ownership stays flat; exact heap attribution requires further retainer evidence |

The result meets the request's comparative-evidence path: responsive live preview, exact final values/Undo, materially reduced redundant work, no sustained input backlog or unexplained long stall in the tested heavy fixture, and stable measured ownership across lifecycle cycles. It does not claim browser layout is free, every site is covered, the precise original hang was reproduced, or all retained memory is explained. The known broad presentation/parser costs remain visible in measurements; they are not hidden by deferring edits until mouseup.

### Final package evidence

All six ZIP file entries hash-match the final unpacked build. A directory entry is excluded from file hashing. The manifest still requests only `activeTab`/`scripting`; automatic content scripts are empty, with no host permissions. Production source, entrypoints and content JS contain no diagnostic globals, counters or test switches. Dependency manifests/lockfile, WXT configuration, fonts and notices have no additional changes.

| Final artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `.output/cssforge-0.1.0-chrome.zip` | 462,814 | `BE52C907B2BEDF88ABC7EBFAC3EA5647D7F428812E68E6AFA5D7B0C47C298C91` |
| `content-scripts/content.js` | 1,087,846 | `9E6A2D8230F86C46A43762350A6BC5FFA532E41E5F6DB7284392F421B4FBBB65` |
| `content-scripts/content.css` | 91,996 | `4E54F3F57C0433F177012DD822108ED8DA6657783D815F67BEDAAEDE9C2CB8B3` |

### Final Git and investigation-artifact status

Final read-only checks confirm branch `main`, HEAD `ace3789c4613fe88dc9196f2a67cc11c6d17c599`, and exact tag at HEAD `phase-09b`. The current tree contains 13 modified and 13 untracked files, all intended Phase 10A work; the tracked diff is 118 insertions/25 deletions. No existing changes were discarded. No Git write operation occurred. Dependency manifests/lockfile, WXT configuration, fonts and notices remain unchanged.

| Classification | Files | Contents |
| --- | ---: | --- |
| PRODUCTION | 11 | Existing Phase 10A adapter/control/focus/ownership changes; this investigation changes only `src/engine/cascade/index.ts` and the effectiveness call in `src/picker/controller.ts` |
| TESTS | 12 | Existing rich/EyeDropper/native regression tests plus scoped-cascade units/browser case, two deterministic fixtures and edit-time harness/acceptance cases |
| DOCS | 3 | README, current support contract and this preserved/extended Phase 10A report |
| GENERATED / INVESTIGATION ARTIFACTS | Ignored | `.output` package/build and `.preview` comparisons, profiles, counters, screenshots, partial failures, logs and focused traces |

`git status --short --untracked-files=all` was reviewed and `git diff --check` passed. The final ZIP hash still matches the package table after documentation updates. There are no diagnostic globals in production source, entrypoints or the final bundle. All test browser contexts closed, and the controlled fixture server was stopped; port 5173 has no listener.

### Current readiness decision

**READY FOR REVIEW under the request's comparative-evidence path B; product acceptance remains pending.** A shared edit-time cascade bottleneck was reproduced, bounded with a failing-before regression, fixed without changing live preview or authoritative truth, and measured again on the same simple/heavy inputs. Both final 22-workload series pass, final values and ordinary Undo remain exact, and no sustained input backlog or unexplained long stall occurs in the tested heavy environment. Repeated ownership measurements and 32 additional lifecycle cycles show no accumulating listener/DOM ownership or material cycle slowdown.

This decision preserves the evidence limits: the exact original real-page multi-second hang was not reproduced, residual heap growth is unattributed and no unlimited-session plateau is proved. The full critical run initially passed 481/482; its single localized glyph-raster comparison failure is preserved and classified as a flake supported by three unchanged explicit passing reruns. It is not reported as a clean first run. No new feature, next phase, commit, push or tag follows this investigation.
