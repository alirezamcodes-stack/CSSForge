# CSSForge — Phase 05

WXT + React + TypeScript, Manifest V3. Real element picking and reversible core/rich Design editing in the accepted Shadow Root inspector and dock. The independent preview retains the locked Phase 01/02 fixture UI. No authored declaration extraction, stylesheet index, or cascade engine is included.

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

The extension requests only `activeTab` and `scripting`. It does not run automatically across websites, index stylesheets, poll, or rewrite author styles. After picking an element, edit the Design controls directly. Use **Undo last edit** or **Reset session edits** in the inspector menu, at the bottom of Design, or in Changes. Deactivating CSSForge restores the page by removing its session overrides.

## Check

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

For Phase 05 checks without recapturing historical evidence:

```sh
pnpm test:e2e --grep-invert "capture Phase 02|captures five Phase 03"
```

Phase 04's functional tests still run; their screenshot writes are opt-in with `CSSFORGE_CAPTURE_PHASE=04`. Phase 05 writes only its seven requested evidence images.

The browser suite covers the existing interaction shell plus real picker activation, hover, owned-UI exclusion, selection, link/button/checkbox/form interception, identity/dimensions/fonts, Escape priority, parent/child navigation, open shadow roots, scroll/resize, target removal, lifecycle cleanup, narrow viewports, and actual 200% Chrome zoom. The packaged-extension tests need a current installed Chrome with the CDP Extensions API and use fresh disposable profiles with the original minimal-permission manifest. Listener cleanup is checked directly in the extension's isolated execution context. The performance test dispatches 2,000 pointer events: one hover geometry read, zero computed-style reads, and zero UI publications; selection then performs one computed-style read. Set `CSSFORGE_BROWSER_CHANNEL=chromium` to use a compatible Playwright Chrome for Testing runtime instead. Installed Chrome 154 passed here.

## Files

- `entrypoints/`: action-triggered extension injection and WXT Shadow Root mount.
- `src/picker/`: DOM controller, frame gate, overlay, safe display labels, page support checks, and React snapshot adapter.
- `src/editing/`: supported property/value model and the reversible session stylesheet controller.
- `src/ui/design/LiveDesignView.tsx`, `EditControls.tsx`, `SpacingEditor.tsx`: real values in the existing Design layout and spatial controls.
- `src/ui/`: focused inspector, Design, Code, HTML, dock, popover, Navigator, and Changes components.
- `src/ui/ui.module.css`: scoped visual styles and design tokens.
- `src/fixtures/`: selected-element, stylesheet, DOM, and diff fixtures.
- `src/state/ui.ts`: small Zustand UI store.
- `src/preview.tsx`, `src/styles/preview.css`: standalone demonstration canvas.
- `tests/`: Vitest and Playwright checks.
- `artifacts/screenshots/`: reviewed visual evidence.

In the standalone preview only, fixture controls retain their local values and scroll position across task switches and inspector hiding while React remains mounted. In the extension, the header and Design controls show real selected-element data. Unimplemented task/surface content explains its availability instead of displaying mock controls, CSS, trees, or changes. The existing shell geometry, tabs, popovers, drag interactions, and modal focus management are retained.

## Core Design editing

Supported core properties: width/height where the element has an editable box, opacity, all four margin and padding sides, font-family, font-weight, font-size, line-height, color, text-align, letter-spacing, background-color, display, border-width/style/color/radius, and position. Position offsets are omitted because the accepted Positioning UI has no offset controls.

`src/editing/session.ts` owns all page writes. It retains real Element references and allocates random, collision-checked temporary attributes only on edit. A CSSForge-owned style element in each edited target's document/open shadow root holds an important declaration rule. Values are validated with the browser and assigned through CSSStyleDeclaration rather than interpolated into CSS text. Host stylesheet rules and style attributes are never rewritten. Targets are never recovered through selectors, and disconnected or reparented targets cannot receive a new edit. Copied ownership markers are removed before subsequent writes and during cleanup.

Each field separates the browser-computed value, the presented editor token, and the optional session override. Explicit inline non-px tokens are retained where available; stylesheet-authored tokens are not extracted. Hovering a field reports computed and override values. Bare lengths become px; line-height retains its explicit px unit or accepts a unitless multiplier. Valid edits apply immediately. Invalid drafts stay in the field with an error and do not alter the page or history. Colors accept browser-valid CSS syntax, including alpha/named colors, through the existing compact swatch/text control. Font-family accepts local CSS stacks; no fonts are downloaded.

Transactions record target, editing context, property changes, previous overrides, new values, and sequence. Core field typing and filter slider gestures are grouped into one undo operation. Structured rich inputs commit each valid update; layer operations are atomic across background properties. Undo restores previous overrides, or removes them when there were none. Reset removes all session style layers and markers across every edited target and context. Picker cancellation, inspector hiding, tab changes, and selection changes preserve edits. Full deactivation performs the same cleanup and drops history. React rerenders never own or recreate the edit layer.

Design sampling occurs only on selection/navigation and explicit edit/undo/reset refresh. It reuses the picker's computed-style read; raw hover still performs zero computed-style reads and no Design sampling. Geometry continues to refresh through the existing frame gate.

Editing limitations: this is a session override layer, not a cascade engine. Inline `!important` declarations are protected and reported; stronger author-important rules, transitions, or layout constraints can affect the rendered result. The computed field value remains available separately. Attribute-copying host scripts can temporarily duplicate a rule match until the next edit/cleanup; no DOM mutation observer is installed. Width/height are disabled for non-replaced inline elements and `display: contents`. Inherited properties retain normal CSS inheritance. Design snapshots do not continuously track unrelated script/style changes. Closed shadows and frame contents remain unsupported.

Six Phase 04 screenshots: `artifacts/screenshots/phase-04/01-real-design.png`, `02-spacing-edit.png`, `03-typography-edit.png`, `04-background-border-edit.png`, `05-undo-reset.png`, and `06-narrow.png`.

## Rich Design editing

The same session controller now keys overrides by target plus media conditions plus pseudo suffix. Base rules precede conditional rules. `applyBatch` records multi-property background operations atomically; undo/reset and teardown use the existing lifecycle. Context selection changes editor tokens without simulating a viewport or browser state. A pending slider cannot write into a different target/context.

- **Media:** bounded selection-time CSSOM traversal finds directly matching readable rules within `@media` and supported `@supports` groups. It inspects at most 50 stylesheets, 2,000 rules, and six nested levels, without collecting declarations or resolving the cascade. Base is always available; queries are offered only when proven or retained from a session override. Nested media conditions stay nested. Cross-origin sheets, imports, container/layer/scope rules, selector nesting, inherited relevance and inactive interactive selectors can be unavailable; the UI reports partial discovery. This is not winning-rule provenance.
- **States:** `:hover`, `:focus`, and `:active` are real conditional CSS selectors, applied only when the browser naturally matches them. No pseudo-state forcing or fake simulation is performed. `::before` and `::after` style existing generated content through owned rules; no content is inserted. The overlay and header still identify the originating element. Inactive media/state contexts show their override tokens alongside current rendered browser values.
- **Backgrounds:** add/select/reorder/hide/show/remove layers; edit linear/radial type, direction or shape/position, color stops and stop positions; add/remove stops; apply real presets; edit position, size and repeat per layer. Companion lists move with images. Hidden images use a transparent gradient plus an encoded CSS comment carrying the original token, so hiding participates in undo. HTTP(S) image URLs are accepted explicitly; script/file/data URLs are rejected. Complex unparsed images remain untouched until intentionally replaced. On-canvas gradient handles and advanced interpolation/hints/conic editing are deferred.
- **Shadows:** real box/text preset cards, multiple shadow selection/add/remove, x/y/blur/color, and box spread/inset. Unsupported shadow syntax is preserved until replaced; structured length editing supports ordinary px/em/rem values. None removes the CSSForge shadow result through the same transaction model.
- **Filters:** blur, contrast, brightness, saturate, invert, grayscale and sepia initialize from real values. Function order and unsupported functions such as hue-rotate/drop-shadow remain intact. Repeated or complex values disable only the ambiguous slider. Local drag feedback is immediate; one scheduled frame applies the combined filter. Pending frames are cancelled on unmount/context changes, and a burst test verifies one selected-style refresh for 100 input events.

Rich CSS parsing lives in `src/editing/rich.ts`; bounded context discovery is in `src/editing/contexts.ts`; presentation uses `RichContextControls`, `RichBackground`, `RichShadow`, and `RichFilters` within the existing Design sections. Hover still performs zero computed-style reads and no rich parsing.

Seven Phase 05 screenshots: `artifacts/screenshots/phase-05/01-media.png`, `02-state.png`, `03-background-gradient.png`, `04-box-shadow.png`, `05-text-shadow.png`, `06-filters.png`, and `07-narrow.png`. Phase 06 has not started.

## Picker architecture

`src/picker/controller.ts` owns transient DOM references and subscriptions separately from the Zustand UI store. Pointer events use composed paths and explicit UI/overlay ownership; they never run computed-style inspection or publish React state. A single pending animation frame draws a fixed, pointer-transparent Shadow Root overlay. Same-target pointer movement does no extra geometry work. Selection takes one snapshot (identity, rectangle, computed font family/size), publishes it through `useSyncExternalStore`, and returns to normal page interaction.

Capturing listeners intercept only the primary picking gesture; links, forms, and checkboxes work normally after selection or cancellation. Scroll (including nested scroll containers), window/visual viewport resize, selected-element ResizeObserver notifications, and completed inspector movement schedule geometry refreshes. There is no polling, stylesheet indexing, or mutation scanning. The fixed UI ownership host and overlay stay out of page layout.

Deactivation cancels pending animation work, disconnects the target observer, removes all picker/React interaction listeners, removes overlay and UI roots, and releases target references. A single dormant extension-message listener remains so the toolbar can reactivate the UI. No DOM elements or snapshots are persisted.

## Picker limits

- Normal document elements and straightforward open shadow roots are supported. Closed shadow roots expose only their host; iframe documents and cross-frame inspection are unsupported. An iframe element can be reached through document parent/child navigation.
- Identity is a bounded display label, not a unique CSS selector. Font data is the browser-computed family stack and size, not per-glyph font resolution or font discovery. Fonts are sampled on selection.
- Overlay geometry follows scroll, resize and selected size changes; it does not continuously track animations or unrelated layout shifts. Detached selections are cleared on the next geometry update. Non-rendered children marked `hidden` and metadata/script nodes are skipped; this is basic element navigation, not a full visibility/tree engine.
- CSSForge cannot undo a host listener that ran earlier at window-capture phase, or draw above browser top-layer/fullscreen UI. It does not inspect closed shadows or frame contents by pretending they are ordinary document nodes.
- No cascade engine, authored Code editor, real document tree, or full Changes/history/export system. Phase 05 extends the same session editing model described above.

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
