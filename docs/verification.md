# CSSForge verification contract

[CURRENT-STATE](CURRENT-STATE.md) is authoritative for current results and limits. The post-10A audit and milestone reports/captures remain historical evidence. A successful measurement collection is not a blanket correctness, performance, memory or accessibility certification.

## Correctness gates

Run `pnpm typecheck`, `pnpm test`, then `pnpm build` before packaged-extension browser gates. `pnpm test:e2e` uses the default Playwright configuration: assertions determine pass/fail, retries are zero, and `@diagnostic`/`@historical` cases are excluded. `pnpm test:e2e --list` shows the selected cases. Evidence attachments accompanying assertive tests do not turn those tests into collectors.

The relevant gate retains all 175 prior Phase 10B.4 cases and adds the corrected identity regression, portable structural invariants and one legacy professional capture case to exercise fresh evidence routing (178 cases). The critical gate adds only the two maintenance gates to the prior 539-case matrix (541 cases). Exact commands are below. Its three original screenshot/milestone-only exclusions are unchanged; this is not a full default-discovery run.

```sh
pnpm exec playwright test tests/e2e/code-html.spec.ts tests/e2e/current-ui-p2.spec.ts tests/e2e/interactions.spec.ts tests/e2e/phase-08a-token.spec.ts tests/e2e/phase-09b-structure.spec.ts tests/e2e/phase-10a-eyedropper.spec.ts tests/e2e/phase-10a-performance.spec.ts tests/e2e/phase-10b-interaction.spec.ts tests/e2e/phase-10b-ownership.spec.ts tests/e2e/phase-10b-resource-policy.spec.ts tests/e2e/phase-10b-ux-a11y.spec.ts tests/e2e/professional.spec.ts tests/e2e/rich.spec.ts tests/e2e/units.spec.ts tests/e2e/identity-polish.spec.ts tests/e2e/current-ui-structural.spec.ts --retries=0
```

```sh
pnpm exec playwright test tests/e2e/phase-10b-ux-a11y.spec.ts tests/e2e/phase-10b-interaction.spec.ts tests/e2e/phase-10b-resource-policy.spec.ts tests/e2e/phase-10b-ownership.spec.ts tests/e2e/phase-10a-native-investigation.spec.ts tests/e2e/phase-10a-performance.spec.ts tests/e2e/phase-10a-native-feasibility.spec.ts tests/e2e/phase-10a-eyedropper.spec.ts tests/e2e/phase-09b-structure.spec.ts tests/e2e/phase-09a-domain.spec.ts tests/e2e/phase-09a-text.spec.ts tests/e2e/phase-08b-changes.spec.ts tests/e2e/phase-08a-effectiveness.spec.ts tests/e2e/phase-08a-token.spec.ts tests/e2e/phase-08a-replacement.spec.ts tests/e2e/source-index.spec.ts tests/e2e/engine-integration.spec.ts tests/e2e/mutation-conflicts.spec.ts tests/e2e/current-ui-p2.spec.ts tests/e2e/author-mutation.spec.ts tests/e2e/mutation-audit.spec.ts tests/e2e/cascade.spec.ts tests/e2e/target-locator.spec.ts tests/e2e/selectors.spec.ts tests/e2e/reconciliation.spec.ts tests/e2e/targeting-hardening.spec.ts tests/e2e/selection-audit.spec.ts tests/e2e/current-ui-p1.spec.ts tests/e2e/code-html.spec.ts tests/e2e/editing.spec.ts tests/e2e/rich.spec.ts tests/e2e/units.spec.ts tests/e2e/professional.spec.ts tests/e2e/extension.spec.ts tests/e2e/picker-performance.spec.ts tests/e2e/interactions.spec.ts tests/e2e/foundation.spec.ts tests/e2e/edit-time-performance.spec.ts tests/e2e/cascade-performance.spec.ts tests/e2e/identity-polish.spec.ts tests/e2e/current-ui-structural.spec.ts --grep-invert 'captures five Phase 03|thirteen focused views|capture Phase 02' --retries=0
```

Do not substitute default-discovery totals for these named gates. Preserve each first failure and its output directory. Classify only PRODUCT DEFECT, TEST DEFECT, FLAKE, ENVIRONMENT or UNRESOLVED. Do not loosen assertions, skip product failures, add retries, change raster tolerances or rerun an entire failed gate to get a green total. Narrow unchanged diagnostics may classify raster/focus failures; passing them never changes the failed gate result.

## Observational collectors

`pnpm test:e2e:diagnostics` uses `playwright.diagnostics.config.ts` and selects the four `current-ui-*-audit` collector files (24 cases). Their names explicitly identify them as observational. They retain catches, recorded mismatches and local assertions. Completion means collection and those explicit assertions succeeded, not that every recorded observation matched the product contract. Review fresh JSON for errors, mismatches, failed/blocked observations and browser errors; report collector counts separately from gate counts.

For the F19 shell workflow, run `pnpm test:e2e:diagnostics tests/e2e/current-ui-shell-audit.spec.ts --grep SH04`. Its current label is “Session edit controls.” SH01's `(2,2)` iframe coordinate is relative to the padding box and is labeled accordingly; SH08 records actual exterior border clicks. Current assertive picker/ownership regressions remain gates. No collector was converted from an assertive regression to hide a failure.

## Explicit historical comparisons

The default structural case asserts current source grouping identity, declaration presence, selected token contrast and absence of runtime errors. It does not read a milestone baseline. Selected token/base-surface contrast is narrower than complete rendered contrast or screen-reader certification.

The historical density case is separate and tagged `@historical`. Set `CSSFORGE_STRUCTURAL_BASELINE` to an explicit immutable density JSON, then run `pnpm test:e2e:historical`. The preserved input is `artifacts/diagnostics/current-ui-visual-polish/structural-semantic/before/density.json`, with its original Chrome version provenance. Original declaration/order and density-improvement assertions remain intact. Missing input configuration fails explicitly; current results must never be used to manufacture a new “before” baseline.

## Evidence ownership

Normal runs generate a unique root `.preview/verification/<UTC timestamp>-<process ID>`. Workers share that root. Playwright profiles/traces/results and legacy PNG/JSON/performance writers use the same root through `tests/e2e/evidence.ts`. If a named phase/attempt root is needed, set `CSSFORGE_EVIDENCE_DIR` to a fresh directory inside `.preview`; use a different directory for every attempt. The helper rejects historical roots, absolute child paths and traversal outside the run. Keep command logs/verification markdown in that attempt's generated directory. No ignore change or historical untracking is required.

Tracked `artifacts/` files and the historical audit are immutable inputs during ordinary verification. They are not refreshed by tests. Existing snapshot/restore utilities in `scripts/` are historical archival tools, not normal verification steps; do not use them to conceal unexpected test writes or restore unknown work. Historical inputs are read only by explicit comparisons. Disposable generated evidence may be regenerated; retained first-failure directories must not be reused.

Record `git status --short` before tests, after focused checks and after final verification; compare tracked historical file hashes when auditing ownership. Unexpected historical modifications require identifying the exact writer and preserving fresh evidence before restoring only proven accidental generated changes. Never use broad restore/clean commands.

