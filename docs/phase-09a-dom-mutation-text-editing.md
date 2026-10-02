# Phase 09A — safe DOM mutation and text editing

**Status: complete and green.** Final checks: typecheck, 309 unit tests in 20
files, build, ZIP, 371 packaged browser cases in 28 files with retries disabled,
and git diff --check. No Phase 09B implementation, staging, commit or push.

## Ownership map and implementation decision (recorded before implementation)

The Phase 08B baseline is main, clean, exact tag phase-08b, HEAD
816ab884094720cf5e4b235c3b3584b79ca2267c.

`editing/session.ts` owns the sole transaction array and monotonically increasing
order. CSS gesture grouping only merges the immediately preceding transaction
with the same target, context and gesture. Undo selects its last entry. Reset
walks history backwards, retains unsafe author rollbacks, and removes owned CSS
layers. Dormant author writes already participate in this same array.

Logical targetId identifies an editing group. Physical bindingGeneration changes
on an explicitly authorized, strong, unique reconciliation. CSS scopes migrate;
native author bindings do not gain authority over replacement nodes. Selection
loss quarantines the old binding before any replacement is considered. Changes
is a read-only projection of owned scopes/history. Deactivation removes CSS and
attempts exact author rollback; the document-local author ledger retains conflicts.
Navigation retires that ledger. Marker attributes are containment tools, never
identity evidence.

The minimum extension is an optional DOM_TEXT_MUTATION entry in this existing
transaction array. A separate narrow DOM domain resolves an eligible exact Text,
issues opaque draft plans, verifies native ownership, performs one data write,
and checks rollback. It has no Undo stack. Records contain exact owner/Text/root,
logical id, generation, before/applied/current strings, transaction order and
availability/conflict. A document-local ownership ledger retains unresolved
records across UI deactivation; the session reconstructs its one ordered history
from these and existing author recovery records. Navigation retires references.

V1 permits one direct Text child and no other children, in an ordinary HTML
element inside this document or an open shadow root. Forms, editable ancestors,
custom-element hosts, canvas, SVG and cross-document/closed-root content fail
closed. No text-node reconciliation is attempted. A replaced equal-string Text
is a different owner. Drafts require the original selected id/generation and
unchanged data at Apply; text records never migrate to a replacement element.

Apply is explicit, Cancel/Escape writes nothing. Native data is stored exactly;
empty strings, spaces, Unicode and multiline strings are valid. CSS exports
remain CSS only with a separate DOM omission count. Changes adds text rows to
the existing logical group. Targeted ownership observers classify host changes
without reapplying. The existing exclusive transaction guard covers DOM writes
and teardown. Text work is allowed only at explicit editing/selection boundaries,
never pointer hover. Text changes invalidate matching/computed inspection caches
without rescanning stylesheet sources. No new permissions or persistence.

## Implemented domain and authority

`src/editing/dom/model.ts` defines DOM_TEXT_MUTATION, opaque TextPlan, failure
results and read-only text rows. `resolve.ts` owns conservative discovery;
`index.ts` owns native writes, exact rollback and document-local recovery;
`draft.ts` preserves textarea/native line-ending differences. UI and CSS output
consume projections, not mutation ownership. No arbitrary HTML/DOM serialization
or speculative structure operations are introduced.

A draft is issued into a WeakSet and frozen. Apply requires that issued plan,
the current selected logical id, the same physical generation and lifecycle
identity, connected exact owner/Text, the original root/document, one direct
Text child, still-supported ancestry/semantics, and exact baseline data. Missing
owners return UNAVAILABLE; invalid/reused or changed-selection plans return
STALE; changed baseline returns CONFLICT; native write/length failure returns
FAILED. Changed data is written through the captured native CharacterData.data
accessor, followed by exact verification. A verified no-op adds no history;
empty-string edits are ordinary recorded mutations. Partial native outcomes
retain a recovery record and report failure rather than a false success.

The record carries the logical target and generation through its plan, exact
owner/Text/root anchors, before/applied/current strings, unique transaction
identity, session owner and monotonically ordered transaction number. Marker
attributes, selector strings, text similarity and labels grant no authority.
The label is presentation metadata only. No full DOM trees are copied or stored.

Only ordinary HTML owners with one direct native Text and no other child nodes
are accepted. Ancestor verification is capped at 64 links. Inputs, textarea,
select/option/optgroup, canvas, iframe, object/embed, script/style/template,
contenteditable ancestry, SVG and customized/custom-element owners are refused.
Open shadow roots use exact root-local anchors and the same exclusions. Closed
interiors and foreign documents cannot qualify. A closed host or iframe border
can still be selected using existing picker behavior, without interior access.

The domain preserves all supplied string code units. Text is capped at 65,536
UTF-16 code units. The textarea exposes LF; the draft adapter preserves original
CR/CRLF in unchanged prefix/suffix regions while newly inserted line breaks use
LF. No trimming, Unicode normalization or HTML parsing occurs. Combining marks,
surrogate pairs, emoji, RTL, leading/trailing spaces and empty text are covered.

## History, conflicts and lifetime

The existing session history array alone selects Undo. A DOM entry interrupts
CSS gesture coalescing naturally because it is the latest transaction with no
CSS gesture. Color → text → padding therefore undoes padding → text → color.
Reset walks DOM/author entries backwards and clears owned CSS layers using the
existing CSS Reset contract. It retains unsafe records, and a blocked newest
Text prevents earlier records on that same Text from being restored accidentally
when a host value happens to equal an older applied value. The domain also rejects
direct rollback of a nonlatest Text record.

Full deactivation attempts text rollback backwards, disconnects its observers,
removes CSS session layers and tears down UI. Safely owned text is restored;
host text is preserved. Unresolved author and DOM ownership sets remain only in
the current live document. These sets have no independent user Undo operation.
Reactivation reconstructs the one session history in recorded order; shared
session/target metadata preserves one logical recovery group across author/text.
The author record gains optional order metadata for this integration; its native
mutation/reconciliation algorithms remain unchanged.

After a conflicted Reset, a fresh explicit repick issues a new logical target.
The old pending recovery group and the new editing group remain separate. Their
current data stays truthful; earlier Text records show `superseded` while a later
transaction owns the same node. Net collapse is within logical target plus exact
Text identity, never across unrelated logical groups. Undoing the newer edit
restores the reviewed host baseline and reveals the older conflict again.

Navigation/pagehide tears down and retires document-local ledgers; disconnected
or foreign-root owners are never written. No storage APIs, durable references,
reload restoration or session persistence are added. Exact data equality is the
rollback contract: this is not a continuous provenance log of every host write.
The host can change text back to the applied string; exact current owner/value
checks can then permit rollback. A replacement node with that string never can.

One targeted MutationObserver per owned element classifies characterData,
child-list and eligibility-related changes. Its subtree observation stays on
that exact owner; there is no document-wide text diff. Own observer notifications
are drained after known native writes, and native state is verified. Host
observers are untouched. MutationObserver delivery occurs at microtask
checkpoints; the same-task host reaction test produces one transaction and a
truthful conflict, without reapplication, recursion, duplicate history or unsafe
migration. The existing session exclusive guard covers writes and deferred
teardown. Own Text data writes leave element reconciliation authority intact.

## Replacement and Changes

Strong element reconciliation is unchanged. A committed CSS scope can migrate
to a proven replacement while the DOM record keeps its original exact Text.
That DOM record becomes unavailable; no text mapping, string-based recovery,
write to replacement B or weakened A→B→C protection is introduced. Drafts keep
their original plan and become disabled/stale when logical selection or physical
generation changes. Apply independently verifies the same authority even if UI
refresh has not yet arrived.

Changes uses the existing logical-target articles, with text original/applied/
current values, DOM_TEXT_MUTATION provenance, explicit unavailable/conflict or
superseded state, and separate edited-element/CSS-declaration/DOM-change counts.
Repeated edits collapse net rows within the same target/native Text. Mixed
blocked CSS and successful text remain independently truthful. Text-only groups
disable Copy target/all and Export CSS. All CSS serializers remain CSS only;
`domOmitted` counts text rows separately from unrepresentable CSS declarations,
and the UI reports those omissions even when no CSS output is available. No
empty CSS rule, HTML output, JSON export or DOM serialization API is added.

## Product UI, accessibility and freshness

Inspector menu → Edit text opens a compact CSSForge-owned Surface and labelled
multiline textarea. Unsupported actions are disabled with a described reason.
Apply writes once, Cancel/Escape discards drafts, ordinary Enter inserts a line,
Ctrl/Meta Enter applies, and composing Enter does not commit. The existing
modal focus manager makes underlying UI inert, contains Tab focus and restores
the Inspector menu opener. Errors are labelled text in a polite live status
associated with the textarea, not color-only feedback. The final suite checks
320/390 CSS-pixel widths, actual Chrome 200% tab zoom, reduced motion, focus
containment and opener restoration. No fake future structure actions appear.

Text commit, rollback and host-conflict callbacks reuse editing refresh paths
for selected geometry, computed fields and effect evidence. SourceIndex adds a
matching-cache invalidation entry point that preserves indexed stylesheet
scopes; cascade caches are invalidated conservatively because text can affect
`:empty`, `:has` and inherited matching. Work is then resolved only for the
selected/currently reviewed edited targets through existing bounded engines.
The `:empty` test verifies fresh computed font size on commit/Undo with zero new
scope scans. DOM-only Changes review skips CSS-effect/source refresh and selector
preparation; opening Code later reuses indexed sources. Raw pointer/geometry
paths do not discover, prepare, write, serialize or refresh DOM edit truth.

The 1,000-event case starts with committed text and compares all domain/source/
cascade/locator/selector/reconciliation/author/export counters before and after
pointer dispatch and settled animation frames: every counter is unchanged. No
DOM serializer exists; no output preparation occurs on hover. Observers and
history still scale with edited owners/records; the existing unbounded ordinary
session-history limitation is not broadened into a new persistent system.

## Verification chronology

Test-first domain work preceded UI exposure: the new suite initially failed to
load the absent domain (19 existing files / 273 tests still passed). Then 28 new
domain cases plus the existing 273 passed (301 total). Two real built-extension
domain cases proved cross-domain order and safe Reset before the editor UI was
added. Later unit additions brought totals to 305 and then 309. The final unit
suite is 309 tests in 20 files: 35 native text/draft cases, 15 Changes/CSS output
cases and the existing remainder. One intermediate typecheck exposed union
narrowing and test-realm `chrome` typing; both were corrected before UI tests.

All browser invocations use `--retries=0`. Failures and explicit reruns:

Runtime: Chrome 154.0.8037.93, Node 24.19.0, pnpm 11.19.0,
WXT 0.20.27, Vite 7.3.6 and Vitest 3.2.7. Chrome is the tested version,
not a newly declared minimum browser version.

| Run | Executed | Passed | Failed | Detail |
| --- | ---: | ---: | ---: | --- |
| Domain before UI | 2 | 2 | 0 | Unified order and conflict Reset |
| First focused UI/domain | 29 | 27 | 2 | Nested center click selected its strong child; iframe center click entered its document |
| First explicit rerun | 29 | 27 | 2 | Locator-relative edge clicks still failed (rounded parent boundary / iframe padding-box coordinates) |
| Corrected fixture cases | 2 | 2 | 0 | Parent navigation and absolute iframe border click; selected identity asserted |
| Focused plus recovery ordering | 31 | 31 | 0 | Blocked older records and mixed author/text recovery |
| Focused plus Reset/repick projection | 32 | 32 | 0 | New logical group vs pending recovery |
| Final focused performance refinement | 32 | 32 | 0 | DOM-only review prepares no selector or root rescan |
| Final packaged current regression | 371 | 371 | 0 | 339 current critical + 32 Phase 09A; 15.1 minutes |

Neither selection failure was a mutation assertion failure or a relaxed safety
check. No existing critical test was removed or weakened. Three historical
capture-only cases retain the Phase 08A/08B grep-invert exclusion; tracked
historical reports/evidence are not regenerated. Normal final checks completed
in order: `pnpm typecheck`, `pnpm test` (309), `pnpm build`, `pnpm zip`.

The final browser command is the Phase 08B current-critical file set plus
`phase-09a-domain.spec.ts` and `phase-09a-text.spec.ts`, with the existing
`--grep-invert 'captures five Phase 03|thirteen focused views|capture Phase 02'`
and `--retries=0`. It executes 371 cases in 28 files against ZIP's completed
rebuild. All 371 passed in 15.1 minutes, exit code 0. Across the eight browser
invocations above, 528 cases were executed: 524 passed and four failed
executions from the two fixture-selection cases in the two early focused runs.
Those cases passed after explicit corrections. No retries masked failures.

## Package and git status

ZIP is `.output/cssforge-0.1.0-chrome.zip`, 456,327 bytes, SHA-256
`2E30747B046A4ED16F00491650952DFA605BFFFC1756417A8CD55226A8069829`.
Every ZIP file's size/hash was compared with the built directory after ZIP
completion: six files plus one directory entry, all equal. Content JS is
1,063,808 bytes / SHA-256
`FBEDED03BC64593CCF403F5685FE474F46F5008C8073446FC2DE559E688E8914`;
CSS is 91,166 bytes / SHA-256
`F1692F464B6C1C03EFDBB908C0A73D21F80A365462AF230DE24A8771B53499EA`.
Manifest remains MV3 0.1.0, permissions exactly activeTab and scripting, no
host_permissions and no static content scripts. Fonts/notices remain packaged.

Current git classification is 26 files, all unstaged:

- **PRODUCTION (19):** content-script ledger lifetime; editing session/Changes;
  four `src/editing/dom` files; two `src/ui/text` files; optional author-order
  metadata; source match invalidation; picker refresh/output preparation; CSS
  serializer/accounting; UI surface state; live Changes; Inspector entry;
  shared compact Surface and its CSS.
- **TESTS (4):** `tests/dom-text.test.ts`, `tests/changes.test.ts`,
  `tests/e2e/phase-09a-domain.spec.ts`, `tests/e2e/phase-09a-text.spec.ts`.
- **DOCS (3):** README, current support contract and this report.
- **GENERATED OUTPUT:** `.output` build/ZIP and `test-results` profiles,
  downloads, diagnostics/traces remain ignored; `.preview` is also ignored.

`git status --short --untracked-files=all` shows 16 modified tracked and 10 new
untracked files. `git diff --check` passes. Main/HEAD/tag remain exactly the
starting Phase 08B checkpoint. Historical reports/audit/artifacts and package,
lockfile and build config have no diff. Phase 08A report SHA-256 remains
`A10D8992CE7F4E19CBF7139056E9A69EDC79778F7031C00D7C05F58684900D29`;
Phase 08B is `3EFCF7B30DBE42BC8B13AFF4DA7200675F7C18227BD800DD27F5D0A3601FCB85`;
historical audit remains
`8AA41B7E39049442118E91053B5316E71AF34CF136D62802EFD03695AA7AD854`.
Post-browser-run fingerprints match the ZIP-verified values above. No add,
commit, push, reset or clean has been performed. Current support and README
describe the conservative scope.

## Remaining limitations and next phase

This is safe inline text editing for supported exact native targets. It is not
a full DOM editor: nested/rich text, form values, unsupported SVG/custom owners,
closed/frame interiors, text rebinding, persistent sessions, Redo and structure
editing remain unavailable. Long ordinary history is existing debt. Host CSSOM
changes and every unrelated DOM state are not universally observed. No public
distribution policy/icon requirement is closed by this implementation.

Phase 09A is fully green. Recommend reviewing Phase 09B
Insert/Duplicate/Delete/Reorder. No Phase 09B code is implemented; stop here.
