# CSSForge — Phase 01

WXT + React + TypeScript, Manifest V3. A fixture-backed visual foundation, with a Shadow Root inspector, Design / Code / HTML tasks, global dock, Navigator, Changes, and shared Floating UI popovers. No CSS analysis or page-editing engine is included.

## Run

Requires Node 22+ and pnpm. The supplied `cssforge-reference-v1` directory is read-only design evidence and has not been changed.

```sh
pnpm install
pnpm preview
```

Open `http://127.0.0.1:5173` for the independent fixture canvas. Its inspector uses the same React components and Shadow DOM styles as the extension.

```sh
pnpm build
```

In Chrome, open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `.output/chrome-mv3` in this project. Pin CSSForge, open an ordinary HTTP(S) page, and click its toolbar icon. Click again to hide or reopen it. Chrome internal pages and the Chrome Web Store do not allow content-script injection.

The extension requests only `activeTab` and `scripting`. It does not run automatically across websites, scan the DOM, poll, or modify host styles.

## Check

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

The browser suite covers tabs, accordions, fixture inputs, Escape, outside-click dismissal, focus restoration, menu arrow keys, dialog focus, Navigator, Changes, narrow/short viewports, style isolation, actual extension-action activation, and 200% Chrome zoom. The packaged-extension test needs a current installed Chrome with the CDP Extensions API; it uses a fresh disposable profile. Set `CSSFORGE_BROWSER_CHANNEL=chromium` to use a compatible Playwright Chrome for Testing runtime instead. The local machine's downloaded Chrome for Testing had a Windows side-by-side startup failure; installed Chrome 154 passed the integration test.

## Files

- `entrypoints/`: action-triggered extension injection and WXT Shadow Root mount.
- `src/ui/`: focused inspector, Design, Code, HTML, dock, popover, Navigator, and Changes components.
- `src/ui/ui.module.css`: scoped visual styles and design tokens.
- `src/fixtures/`: selected-element, stylesheet, DOM, and diff fixtures.
- `src/state/ui.ts`: small Zustand UI store.
- `src/preview.tsx`, `src/styles/preview.css`: standalone demonstration canvas.
- `tests/`: Vitest and Playwright checks.
- `artifacts/screenshots/`: reviewed visual evidence.

Fixture control values are local previews and may reset when switching tasks or hiding the inspector. They never change the actual page. Code toggles do not generate a stylesheet; DOM selection does not inspect the page; Changes always displays a fixed example. “Copy fixture CSS” really copies that example. Unimplemented dock tools explain their fixture scope.

## Visual review

The seven permitted references informed the 350px panel, header hierarchy, underline tabs, spatial spacing control, compact typography, green section rhythm, effect cards, code coloring, and capsule/circle dock. Screenshot review prompted larger inspector/code text and a wider central dock. Branding, canvas, icons, preset artwork, and fixture content are original.

Evidence: `01-design-full.png`, `02-design-effects.png`, `03-code.png`, `04-bottom-dock.png`, `05-changes.png`, `06-navigator.png`, `07-extension-200-percent.png`, `08-narrow.png`.

Remaining visual differences are minor: original outlined icons, a smaller example preset collection, and simplified background/text-shadow editor interiors. There are no known blocking Phase 01 structural gaps. Inspector dragging and all real inspection/editing functionality remain outside this phase.

Implementation references: [WXT Shadow Root UI](https://wxt.dev/guide/essentials/content-scripts.html#shadow-root), [Floating UI focus management](https://floating-ui.com/docs/floatingfocusmanager).
