# Current UI functional fixes — P1

Date: 2026-10-01. Scope: the eight P1 findings in the locked [functional audit](C:/Users/alire/Documents/ChatGPT/CSSForge/docs/current-ui-functional-audit.md). P2/P3 findings remain outside this change.

| ID | Fix | Corrected regression expectation |
|---|---|---|
| UI01 | The existing ShadowRoot UI host uses a manual browser popover with a fixed viewport containing block. No page transform is changed or compensated numerically. | Inspector/dock stay within the viewport under translate, scale and combined transforms on html/body, scrolling, drag/clamp, narrow sizes and actual Chrome zoom. Activation also works with both ancestors already transformed. |
| UI02 | The same host lives in the browser top layer, above ordinary document stacking. Its backdrop is hidden and the host ignores pointer input; existing controls retain input. | Maximum-z-index fixed host overlay remains unchanged while inspector editing, dock, color/menu popovers, Changes and Navigator remain reachable. Focus returns to modal openers. |
| UI03 | Picker feedback mounts first; the shell is opened as the following top-layer entry. Feedback remains noninteractive and its native geometry is unchanged. | Recoloring overlapping feedback changes no pixels inside the opaque UI interior, covering inspector, dock, color/unit popovers, Changes/Navigator, narrow view, 200% zoom and hostile stacking. |
| DA01 | Margin/padding unit menus portal into the existing app root inside the same ShadowRoot, outside the compact spacing diagram's paint and clipping context. Other popovers keep their existing ancestry/styling. | Native hit testing and unforced clicks reach every enabled option on all eight spacing sides; computed sizes stay within 0.05px. Keyboard activation, Escape/focus return, scrolling and collision handling still work. |
| CA64 | Navigation parents follow assignedSlot before native parents, matching existing assignedElements/open-shadow child traversal. Existing target identity and tree rendering stay intact. | Assigned nodes appear exactly once in HTML/Navigator after picking, Refresh and Parent/Child navigation, including nested open roots with slots. Ordinary DOM paths still work. |
| J01 | Background tools removed from the production dock. | No control, keyboard stop or fake active popup. |
| J02 | Color tools removed from the production dock. | No control, keyboard stop or fake active popup. |
| J03 | Eyedropper information removed from the production dock. | No control, keyboard stop or fake active popup. Remaining seven controls keep their order and centered geometry. |

No new tools, redesign, host-content resets, conversion changes, target-identity changes or locked editing/engine refactors were made. The existing professional test now expects the locked 0.1em ArrowUp step: 2em → 2.1em, yielding 42px at a 20px reference. Production unitStep is unchanged.

Files changed:

- [entrypoints/content.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/entrypoints/content.tsx): viewport hosting and feedback/shell layer order.
- [src/picker/navigation.ts](C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/navigation.ts), [controller.ts](C:/Users/alire/Documents/ChatGPT/CSSForge/src/picker/controller.ts): shared composed navigation parent policy.
- [src/ui/dock/LiveDock.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/dock/LiveDock.tsx): hide the three empty production tools.
- [src/ui/popovers/Popover.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/popovers/Popover.tsx), [interactions/focus.ts](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/interactions/focus.ts), [shared/NumericScrubber.tsx](C:/Users/alire/Documents/ChatGPT/CSSForge/src/ui/shared/NumericScrubber.tsx): optional ShadowRoot app-root portal, enabled only for spacing unit menus.
- [tests/e2e/current-ui-p1.spec.ts](C:/Users/alire/Documents/ChatGPT/CSSForge/tests/e2e/current-ui-p1.spec.ts): 16 P1 regression cases with actual pointer and paint assertions.
- Current shell, Code/tree and Design audit specs: corrected P1 assertions, hidden-tool inventory, and new evidence destinations so the locked audit artifacts are not overwritten.
- [tests/e2e/professional.spec.ts](C:/Users/alire/Documents/ChatGPT/CSSForge/tests/e2e/professional.spec.ts): obsolete em-step expectation only.
- This report and new [P1 evidence](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/).

## Verification

Actual production Chrome MV3 extension, Chrome **154.0.8037.92**, loaded unpacked and activated through the real extension action. Manifest remains MV3 with activeTab+scripting and no host_permissions.

Production content bundle SHA-256: `c6f591248685dc17a050faddee0b25bea78838663d346113ab0787f3b48c30c3`.

- `pnpm.cmd typecheck`: passed after final changes.
- `pnpm.cmd test`: 251 tests / 17 files passed after final changes.
- `pnpm.cmd build`: passed; the final bundle is the spacing-only portal version.
- Final P1/related Chrome run: **29 passed / 1 initial-activation timeout (30 cases, 7.5m)**. That case failed in setup before applying a transform; unchanged, it subsequently passed **3/3 repetitions (34.9s)**. All 30 unique P1/related cases passed across those runs.
- Existing UI/engine regression run: **256 passed / 6 failed (262 cases, 10.9m)**. Five failures were inspector activation waits; one was the obsolete professional assertion still including the unit in the numeric textbox. After correcting only that assertion to numeric `2.1` plus unit `em`, the six-case rerun passed **6/6 (12.7s)**. All 262 unique cases passed across runs. Original failure traces remain retained; the initial batches are not represented as clean all-green runs.
- Preservation: **601 existing artifacts restored and byte-verified; 33 locked engine/editing/audit files hash-verified unchanged**. Only new P1 evidence is retained as changed artifacts.

Exact Chrome commands:

```powershell
node node_modules/@playwright/test/cli.js test tests/e2e/current-ui-p1.spec.ts tests/e2e/current-ui-shell-audit.spec.ts tests/e2e/current-ui-code-tree-audit.spec.ts tests/e2e/current-ui-design-audit.spec.ts --grep 'UI01-|UI02 |UI03-|DA01-|CA64 |J01-J03 |SH0[1-8]|current UI diagnostic|every enabled unit option|native viewport zoom' --output=.preview/current-ui-p1-verified-results

pnpm.cmd test:e2e tests/e2e/engine-integration.spec.ts tests/e2e/mutation-conflicts.spec.ts tests/e2e/mutation-audit.spec.ts tests/e2e/author-mutation.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/source-index.spec.ts tests/e2e/cascade.spec.ts tests/e2e/selectors.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/editing.spec.ts tests/e2e/code-html.spec.ts tests/e2e/extension.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/rich.spec.ts tests/e2e/typography-polish.spec.ts tests/e2e/background-polish.spec.ts tests/e2e/shadow-polish.spec.ts tests/e2e/filters-polish.spec.ts tests/e2e/units.spec.ts tests/e2e/professional.spec.ts tests/e2e/hierarchy.spec.ts tests/e2e/identity-polish.spec.ts tests/e2e/interactions.spec.ts --output=.preview/current-ui-p1-regression-results

node node_modules/@playwright/test/cli.js test tests/e2e/current-ui-p1.spec.ts --grep 'UI01-body-scale' --repeat-each=3 --output=.preview/current-ui-p1-activation-retry-results

# Original .last-run.json copied into this separate folder before rerunning:
pnpm.cmd test:e2e --last-failed --output=.preview/current-ui-p1-regression-retry-results
```

The original audit-style specs still record P2/P3 observations; their passing execution is not a claim that all remaining UI defects have been fixed. P1 assertions fail on the formerly broken behavior. Only new-phase evidence is accepted; prior phase screenshots/JSON generated by existing regressions are restored to their saved bytes afterward.

The initial paint-test method hid the feedback host and caused Chrome to switch text antialiasing/compositing. The corrected comparison recolors the still-mounted feedback, preserving layers and layout. Rounded transparent corners are excluded from comparison because they intentionally reveal page content. Native pointer hit tests remain separate from the paint assertion.

## Results and remaining scope

- **Zoom:** native 125%, 150%, 200% passed with translated/scaled html/body, drag/clamp, scroll and popup interaction. Narrow 390px and spacing/dock 320px cases passed; existing short-height and 200% regressions passed. The host geometry checks remain intact.
- **Hostile pages:** maximum-z-index fixed overlays cannot intercept CSSForge controls. Host global font/input/button resets remain isolated; document transforms/z-index were not changed by the extension.
- **Paint:** all seven feedback recolor comparisons passed at normal width, narrow width and 200% zoom. Feedback still paints on the canvas and remains pointer-events:none.
- **Slots:** assigned and nested assigned light-DOM nodes appear once, remain selected after Refresh, and navigate coherently through Parent/Child in HTML and Navigator. Ordinary DOM/open-shadow/SVG/reconciliation paths passed.
- **Dock:** only the seven connected production controls remain; keyboard order, focus, centered geometry and deactivate/reactivate passed. Preview fixtures are unchanged.
- **Performance:** built-Chrome T32 records **1,000 raw pointer events with identical before/after engine counters**: zero additional source scans, cascade resolutions, selector work, reconciliation or mutation analyses. Other existing pointer-performance cases also passed. [New T32 evidence](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/performance-T32.json) is retained separately from the locked engine artifacts. No permanent layout polling was introduced; popover observation remains limited to mounted floating controls.
- **Regressions:** no unresolved product assertion failures or remaining confirmed P1 issue in the tested scenarios. Initial extension-action activation flakiness remains a verification caveat, consistent with the locked audit; background activation behavior was not changed as part of these eight fixes. Runtime page-error arrays in accepted P1/audit evidence are empty.

Screenshots and native measurements are in [P1 evidence](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/). The [verification record](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/verification.json) records results, counts, bundle identity and preservation. Representative captures: [transformed narrow shell](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/UI01-html-narrow.png), [host overlay](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/UI02-hostile-overlay.png), [200% feedback ordering](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/UI03-zoom200-feedback-order.png), [narrow unit menu](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/DA01-narrow-unit-menu.png), [nested slotted selection](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/CA64-nested-slotted-navigator.png), [production dock](C:/Users/alire/Documents/ChatGPT/CSSForge/artifacts/diagnostics/current-ui-p1/J01-J03-production-dock.png).

Recommended P2 scope, without starting it: existing color cancellation/token-alpha correctness, gradient-hint/mixed-border presentation, Code draft/focus restoration, tree hierarchy keyboard behavior, numeric/color validation explanations, and truthful Changes summary wording. Keep P3 visual polish separate.

**CURRENT UI FUNCTIONAL FIXES P1 COMPLETE.** No P2 work started.
