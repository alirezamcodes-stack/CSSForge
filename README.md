# CSSForge — Phase 03

WXT + React + TypeScript, Manifest V3. Real, read-only element picking in the accepted Shadow Root inspector and dock. The independent preview retains the locked Phase 01/02 fixture UI. No CSS analysis or page-editing engine is included.

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

In Chrome, open `chrome://extensions`, enable Developer mode, select **Load unpacked**, and choose `.output/chrome-mv3` in this project. Pin CSSForge, open an ordinary HTTP(S) page, and click its toolbar icon. Point to an element and click to select it. Use the cursor button to pick again, or Select parent / Select child to navigate. Escape cancels picking while keeping the previous selection. The dock power button or another toolbar click deactivates CSSForge. On restricted pages, the toolbar shows `!` and an explanatory tooltip.

The extension requests only `activeTab` and `scripting`. It does not run automatically across websites, scan the DOM, poll, or modify host styles.

## Check

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

For Phase 03 checks without recapturing the locked Phase 02 evidence:

```sh
pnpm test:e2e --grep-invert "capture Phase 02"
```

The browser suite covers the existing interaction shell plus real picker activation, hover, owned-UI exclusion, selection, link/button/checkbox/form interception, identity/dimensions/fonts, Escape priority, parent/child navigation, open shadow roots, scroll/resize, target removal, lifecycle cleanup, narrow viewports, and actual 200% Chrome zoom. The packaged-extension tests need a current installed Chrome with the CDP Extensions API and use fresh disposable profiles with the original minimal-permission manifest. Listener cleanup is checked directly in the extension's isolated execution context. The performance test dispatches 2,000 pointer events: one hover geometry read, zero computed-style reads, and zero UI publications; selection then performs one computed-style read. Set `CSSFORGE_BROWSER_CHANNEL=chromium` to use a compatible Playwright Chrome for Testing runtime instead. Installed Chrome 154 passed here.

## Files

- `entrypoints/`: action-triggered extension injection and WXT Shadow Root mount.
- `src/picker/`: DOM controller, frame gate, overlay, safe display labels, page support checks, and React snapshot adapter.
- `src/ui/`: focused inspector, Design, Code, HTML, dock, popover, Navigator, and Changes components.
- `src/ui/ui.module.css`: scoped visual styles and design tokens.
- `src/fixtures/`: selected-element, stylesheet, DOM, and diff fixtures.
- `src/state/ui.ts`: small Zustand UI store.
- `src/preview.tsx`, `src/styles/preview.css`: standalone demonstration canvas.
- `tests/`: Vitest and Playwright checks.
- `artifacts/screenshots/`: reviewed visual evidence.

In the standalone preview only, fixture controls retain their local values and scroll position across task switches and inspector hiding while React remains mounted. In the extension, the header and read-only summary show actual selected-element data. Unimplemented task/surface content explains its availability instead of displaying mock controls, CSS, trees, or changes. The existing shell geometry, tabs, popovers, drag interactions, and modal focus management are retained.

## Picker architecture

`src/picker/controller.ts` owns transient DOM references and subscriptions separately from the Zustand UI store. Pointer events use composed paths and explicit UI/overlay ownership; they never run computed-style inspection or publish React state. A single pending animation frame draws a fixed, pointer-transparent Shadow Root overlay. Same-target pointer movement does no extra geometry work. Selection takes one snapshot (identity, rectangle, computed font family/size), publishes it through `useSyncExternalStore`, and returns to normal page interaction.

Capturing listeners intercept only the primary picking gesture; links, forms, and checkboxes work normally after selection or cancellation. Scroll (including nested scroll containers), window/visual viewport resize, selected-element ResizeObserver notifications, and completed inspector movement schedule geometry refreshes. There is no polling, stylesheet indexing, or mutation scanning. The fixed UI ownership host and overlay stay out of page layout.

Deactivation cancels pending animation work, disconnects the target observer, removes all picker/React interaction listeners, removes overlay and UI roots, and releases target references. A single dormant extension-message listener remains so the toolbar can reactivate the UI. No DOM elements or snapshots are persisted.

## Phase 03 limits

- Normal document elements and straightforward open shadow roots are supported. Closed shadow roots expose only their host; iframe documents and cross-frame inspection are unsupported. An iframe element can be reached through document parent/child navigation.
- Identity is a bounded display label, not a unique CSS selector. Font data is the browser-computed family stack and size, not per-glyph font resolution or font discovery. Fonts are sampled on selection.
- Overlay geometry follows scroll, resize and selected size changes; it does not continuously track animations or unrelated layout shifts. Detached selections are cleared on the next geometry update. Non-rendered children marked `hidden` and metadata/script nodes are skipped; this is basic element navigation, not a full visibility/tree engine.
- CSSForge cannot undo a host listener that ran earlier at window-capture phase, or draw above browser top-layer/fullscreen UI. It does not inspect closed shadows or frame contents by pretending they are ordinary document nodes.
- No CSS editing, cascade engine, authored Code editor, real document tree, or Changes transactions. Phase 04 has not started.

Phase 03 evidence is limited to `artifacts/screenshots/phase-03/01-hover.png`, `02-selected-inspector.png`, `03-parent-child.png`, `04-after-scroll.png`, and `05-narrow.png`.

## Interaction foundation

- Drag the inspector header away from its action buttons. Pointer capture keeps the gesture stable; Escape cancels it. Transient movement writes the panel position once per animation frame, then commits a stable position on release. Viewport changes remeasure the original CSS geometry and clamp the panel above the dock.
- The header also accepts keyboard focus: arrows move by 10px, Shift+arrows by 40px, and Home restores its default position.
- Tabs support Left/Right/Home/End. Accordions and mounted task panels preserve fixture state.
- Menus share Floating UI positioning, arrow/Home/End navigation, outside-pointer dismissal, and focus restoration. Icon tooltips appear on delayed hover or keyboard focus.
- Escape closes one active layer: popover first, then an active drag or dedicated surface, then active picking, then a tooltip. It leaves the base inspector and persistent selection intact.
- Navigator and Changes use Floating UI modal focus management with inert background content. Menu-opened surfaces restore focus to the surviving menu trigger.
- The dock keeps a single temporary tool active; opening the inspector clears paused state. Events originating inside the UI do not bubble keyboard/click/pointer-down/up actions into page controls.

Interaction-shell implementation lives in `src/ui/interactions/`, `src/state/ui.ts`, and the existing popover, inspector, and surface components.

## Visual review

The seven permitted references informed the 350px panel, header hierarchy, underline tabs, spatial spacing control, compact typography, green section rhythm, effect cards, code coloring, and capsule/circle dock. Screenshot review prompted larger inspector/code text and a wider central dock. Branding, canvas, icons, preset artwork, and fixture content are original.

Evidence: `01-design-full.png`, `02-design-effects.png`, `03-code.png`, `04-bottom-dock.png`, `05-changes.png`, `06-navigator.png`, `07-extension-200-percent.png`, `08-narrow.png`.

Phase 01's final images remain in `artifacts/screenshots/final-pass/`. The six Phase 02 regression views remain in `artifacts/screenshots/phase-02/`: Design, Code, dock, Changes, Navigator, and narrow viewport. These locked views were not recaptured during Phase 03.

Implementation references: [WXT Shadow Root UI](https://wxt.dev/guide/essentials/content-scripts.html#shadow-root), [Floating UI focus management](https://floating-ui.com/docs/floatingfocusmanager).
