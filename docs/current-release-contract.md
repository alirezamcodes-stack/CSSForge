# Current CSSForge release contract

Initial package target: **Chrome Manifest V3**, currently package version **0.1.0**. This contract establishes local unpacked/ZIP packaging; it does not claim a completed store release, browser compatibility certification or privacy/legal certification.

## Local build and package

```sh
pnpm install --frozen-lockfile
pnpm typecheck
pnpm test
pnpm build
pnpm zip
```

- `pnpm build` uses the current WXT configuration and produces `.output/chrome-mv3` for Chrome **Load unpacked**.
- `pnpm zip` runs `wxt zip -b chrome --mv3`. WXT performs a production build and archives its output; no custom release infrastructure or publishing action is involved.
- WXT's default filename template is `{{name}}-{{version}}-{{browser}}.zip`: currently `.output/cssforge-0.1.0-chrome.zip`. Version/filename follows the package/manifest version.
- Chrome packaging does not enable a separate sources ZIP by default. No sources ZIP, upload, signing, version automation, store API or CI release system is added.
- `.output` is ignored generated output. The ZIP contains the built extension, not the preview/reference/history directories. Verify the exact output manifest and ZIP contents for the release candidate; use [the Phase 08A report](phase-08a-editing-truth-release-hardening.md) for recorded results.

The command is provided by the installed WXT CLI (`zip [root]`, browser and MV3 options); its implementation builds before archiving the configured output directory. It does not rely on an invented external packaging service.

## Manifest / runtime boundary

The current generated Chrome MV3 manifest has a background service worker, `activeTab` and `scripting`, no `host_permissions`, and no static content scripts. The toolbar action initiates top-document runtime injection. The content stylesheet is a dynamic-URL web-accessible resource for HTTP(S) pages; those resource matches do not grant automatic all-site inspection.

Native ShadowRoot/top-layer UI and owned stylesheet edits intentionally operate on the inspected page. Iframe/closed-shadow interiors and restricted pages are outside the current support contract. Phase 08A unpacked operation is verified on Chrome 154.0.8037.93; no lower Chrome minimum or Firefox support is established. A minimum remains unresolved because lower runtimes have not been tested against the actual API/dependency combination. CDP `Extensions.loadUnpacked` is used by tests, not by users loading/activating the extension.

## Assets and notices

`src/assets/fonts` contains the bundled Geist font files. `public` currently contains `THIRD-PARTY-NOTICES.txt` and `Geist-OFL.txt`. UI Lucide icons are component artwork; no suitable existing CSSForge release-icon set was found in those asset paths.

**Remaining asset requirement:** supply approved CSSForge release icon files, then wire the required manifest/action icon entries and verify packaging. No logo or brand asset is invented in Phase 08A. The current manifest has no release icon entries. Existing notices/licenses must remain included.

## Technical data and network observations

These are observations from current production source, not a store policy declaration or certification:

- No telemetry client, analytics endpoint, browsing-data backend or durable session/history storage path was found in current `src`/`entrypoints` code. UI/controller data and live DOM/CSSOM handles remain in memory.
- Extension messages currently carry the toolbar toggle between background and content script. The declared permissions remain `activeTab` and `scripting`.
- UI font data is bundled and loaded in memory; no remote UI-font request is required.
- Editing a background to an accepted HTTP(S) image URL can make the host page/browser request that image. Arbitrary browser-valid CSS entered in supported properties can also reference resources; no blanket “network-free” claim is made. The existing host page's requests are outside this extension-source observation.
- Dependency behavior and every browser/site/CSP condition have not been certified. Package notices are not a substitute for store disclosure/privacy review.

## Outstanding public-distribution requirements

Local build/ZIP generation does not close these requirements:

1. Approved release icon assets and verified manifest/action references.
2. An evidence-based supported/minimum Chrome policy, or an explicitly reviewed current-version-only support policy; no guessed manifest minimum.
3. Manual Chrome Web Store submission/listing, required disclosures/privacy determination and release review. No store copy or certification is fabricated here.
4. Review the exact candidate's verification report, generated manifest, notices and ZIP contents before distribution.

Historical audit findings remain intact. The [current support contract](current-support-contract.md) describes product capability; [the Phase 08A report](phase-08a-editing-truth-release-hardening.md) records what was actually verified for this implementation.
