# CSSForge

CSSForge is a Chrome Manifest V3 extension for inspecting selected page elements and making reversible CSS, literal text and supported DOM structure session edits. It uses WXT, React and TypeScript, with an isolated ShadowRoot inspector and dock.

The current implementation includes a scoped CSSOM source index, a conservative readable-author cascade engine, stable target locators and bounded replacement reconciliation. Normal Design and Code edits use CSSForge-owned stylesheets. An author-mutation engine exists and is regression-tested, but safe-author mode has no normal product control.

The [current support contract](docs/current-support-contract.md) defines supported behavior and limits. The [release contract](docs/current-release-contract.md) defines the local package workflow and outstanding public-distribution requirements. The [Phase 10A report](docs/phase-10a-native-eyedropper.md) records native color sampling, cancellation, target freshness and exact verification results. Historical milestone reports describe their original checkpoints.

## Current workflows

- **Pick and inspect:** explicit element picking, hover feedback, dimensions/fonts, parent/child/sibling navigation and bounded HTML/Navigator trees. Open ShadowRoots and assigned-slot navigation are supported within the documented scope.
- **Design:** geometry, spacing, typography, colors, backgrounds, linear/radial gradients, borders, positioning, multiple box/text shadows and eight filter controls. Numeric/color/token controls validate drafts and use the session Undo/Reset controller.
- **Native color sampling:** open an existing color picker and choose Sample screen color. Where the browser exposes EyeDropper, a trusted activation starts native sampling; one successful opaque sRGB color uses the selected HEX/RGB/HSL format and the existing CSS transaction. Escape cancels native sampling. Changes to the target, physical binding, editing context or control discard pending results. No sampler is added to the dock; unavailable contexts show a disabled reason.
- **Contexts:** separate Base, discovered media and terminal hover/focus/active/before/after edits. Context selection does not force browser state, create generated content or simulate a viewport.
- **Code:** inline authored CSS, readable matching stylesheet rules, referenced keyframes and session overrides; CSSOM values, priorities and supported cascade status; explicit source refresh. Supported declaration edits create session overrides. Authored declarations and keyframes are not a general stylesheet editor.
- **Inline text:** Inspector menu → Edit text safely edits one direct Text node in supported HTML elements. Explicit Apply, Cancel/Escape, multiline input and Ctrl/⌘ Enter use the shared CSS/text Undo history. Nested markup, form values, editable surfaces and unsupported roots are refused. Host updates are preserved as conflicts; replacement text is never guessed.
- **DOM structure:** Inspector menu → Insert element, Duplicate, Delete and Move up/down share the ordered CSS/text history. Allowlisted literal insertion and bounded cloning refuse unsafe IDs/subtrees. Delete/Undo preserves the exact native object and its CSS/text owners; Reorder stays within the exact parent. Changed content/anchors block destructive rollback. Insert/Duplicate keep selection; repick creates fresh ownership. No arbitrary HTML, cross-container movement or framework component editing is promised.
- **Changes:** current CSS declarations, DOM text and structure grouped by logical element, with before/current values and availability/effectiveness. Copy target CSS, Copy all CSS and local `.css` export prepare validated selectors on request. Text and structure omissions are counted separately; DOM-only groups disable CSS output. Disabled declarations, shadow/unavailable targets and author recovery records retain their established CSS exclusions. Undo and Reset remain controller-owned. Clipboard availability depends on the page/browser context; sessions are not persistent.

Accepting an override and proving its effect are separate facts. Stronger author-important rules can beat session edits. The editing workflow distinguishes supported active cascade results from inactive contexts and unverified effects; it does not promise browser-equivalent certainty or escalate selector strength automatically. Browser-computed values remain separate from requested override tokens.

Edits survive selection changes, inspector hiding and tab/context switches within the active session. Reset/deactivation remove CSS session layers and restore safely owned text and structure. Unresolved author/text/structure rollbacks remain in memory in the same document so host changes are preserved and conflicts stay reviewable after reactivation. Reload/navigation retires those references and does not restore edits. No workflow writes original CSS/HTML source files or saves an editing session to disk.

## Run and load locally

Use a Node version supported by the installed toolchain and pnpm. The current local verification environment uses Node 24.19.0 and pnpm 11.19.0; the installed Vite declares Node `^20.19.0 || >=22.12.0`. This is toolchain evidence, not a browser compatibility policy.

```sh
pnpm install --frozen-lockfile
pnpm build
```

In Chrome, open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `.output/chrome-mv3`. Pin CSSForge, open an ordinary HTTP(S) page, and click its toolbar action. Point to an element and click to select it. The dock cursor starts another pick; Escape cancels picking. The dock power button or another toolbar action deactivates CSSForge. Browser/store/restricted pages are unavailable and receive toolbar feedback.

The extension requests `activeTab` and `scripting`, has no host permissions and is injected after toolbar activation. It does not register automatic all-site content scripts. Chrome 154.0.8037.93 is the current verification runtime; lower Chrome versions and other browsers are unverified. A minimum Chrome version is not yet established. EyeDropper capability is feature-detected in the current page context. Real Windows pixel selection and native Escape are verified. The [Phase 10A report](docs/phase-10a-native-eyedropper.md) records the later heavy-page cascade performance fix and stable tested editing/lifecycle workloads. Phase 10A is ready for review; product acceptance is pending, and the exact original real-page hang and residual heap growth remain unconfirmed.

```sh
pnpm zip
```

This invokes WXT's production Chrome MV3 build-and-ZIP workflow and writes `.output/cssforge-0.1.0-chrome.zip` at the current package version. A local ZIP is not a completed Chrome Web Store release. Release icons and distribution review remain outstanding; see the release contract.

For the independent demonstration canvas:

```sh
pnpm preview
```

Open `http://127.0.0.1:5173`. Preview Changes and its copy action use demonstration data; live Changes reviews and copies the controller's current page edits.

## Verify

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

Packaged-extension tests use installed Chrome by default, disposable profiles and the CDP `Extensions.loadUnpacked` API. Set `CSSFORGE_BROWSER_CHANNEL=chromium` only when using a compatible installed Playwright runtime. This test-loading requirement does not establish the extension's minimum Chrome version. Use the current implementation report for exact commands, executed suites, retries and remaining verification limits. Keep browser profiles/output inside ignored `.preview`, `test-results` or `playwright-report` directories.

## Implementation ownership

- `entrypoints/`: toolbar action, runtime injection, ShadowRoot/top-layer UI lifetime and teardown.
- `src/picker/`: DOM ownership, pointer feedback, navigation, lifecycle and bounded trees.
- `src/engine/`: source indexing, cascade/specificity/inheritance, locators, selector descriptions, reconciliation and guarded native author mutation.
- `src/editing/`: property/value models, session overrides, contexts, transaction grouping and Undo/Reset.
- `src/platform/`: the thin native EyeDropper capability/request boundary.
- `src/ui/`, `src/state/`, `src/styles/`: connected surfaces, shared controls, presentation state and centralized semantic tokens.
- `tests/`: unit, native-browser and packaged-extension regressions.

Geist Sans and Geist Mono fonts are bundled and loaded from in-memory font data; UI fonts do not require remote font requests. Lucide supplies the UI icon family. Notices and the Geist license ship in `public/THIRD-PARTY-NOTICES.txt` and `public/Geist-OFL.txt`.

CSSOM inspection preserves browser-normalized authored values, not original formatting/comments/file coordinates. Inaccessible stylesheets, imports, CSS nesting, container/scope semantics, advanced layer ordering, shadow encapsulation, motion and computed-value substitution can prevent cascade certainty. Closed ShadowRoot interiors and iframe interiors are unsupported. See the support contract for the exact boundaries.
