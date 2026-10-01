import { test, expect } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { setup, fixture, pick, inspector } from './extensionHarness';

const phase = process.env.CSSFORGE_STRUCTURAL_STAGE ?? 'final';
const out = `artifacts/diagnostics/current-ui-visual-polish/structural-semantic/${phase}`;
// Adjacent readable rules with shared context and a distinct same-label sheet:
// grouping must never infer stylesheet identity from the human-readable label.
const html = fixture.replace('</style>', `
#checkout{border:1px solid #84a897;background-image:linear-gradient(110deg,#315943 0%,#638470 55%,#a2b89f 100%);box-shadow:0 4px 12px #17332930;text-shadow:0 1px 2px #17332940;letter-spacing:.2px}
@media(min-width:800px){.primary{max-width:360px}#checkout{line-height:1.4}.primary#checkout{letter-spacing:.2px}}
@media print{.primary{padding:0}#checkout{border:0}.primary#checkout{color:black}}
</style><style>@media print{#checkout{opacity:.9}}</style>`);

test('reference-scale structural density and truthful adjacent source presentation', async ({}, info) => {
  test.setTimeout(90000); await mkdir(out, { recursive: true });
  const r = await setup(info, html), { page } = r;
  try {
    await page.setViewportSize({ width: 1440, height: 1228 }); await pick(page, '#checkout');
    for (const section of await page.locator('[data-section]').all()) {
      const name = (await section.getAttribute('data-section'))!, toggle = section.getByRole('button', { name, exact: true });
      const open = ['Spacing', 'Typography'].includes(name);
      if (await toggle.getAttribute('aria-expanded') !== String(open)) await toggle.click();
    }
    const panel = page.getByRole('tabpanel', { name: 'Design', exact: true });
    await panel.evaluate(node => node.scrollTop = 0);
    await page.mouse.move(0, 0); await page.evaluate(() => document.fonts.ready);
    const design = await panel.evaluate(node => {
      const clip = node.getBoundingClientRect(), visible = (e: Element) => { const r = e.getBoundingClientRect(); return r.top >= clip.top && r.bottom <= clip.bottom && r.height > 0; };
      const fields = [...node.querySelectorAll('[data-scrubbing],button[aria-haspopup],input[aria-label="Text color"],[role="group"][aria-label="Text alignment"]')].filter(visible);
      return {
        typographyHeight: node.querySelector('[data-section="Typography"]')!.getBoundingClientRect().height,
        visibleSections: [...node.querySelectorAll('[data-section]')].filter(e => visible(e.querySelector('button')!)).map(e => e.getAttribute('data-section')),
        visiblePropertyRows: new Set(fields.map(e => Math.round(e.getBoundingClientRect().top / 4) * 4)).size,
        largeFieldCardContainers: [...node.querySelectorAll('*')].filter(e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return visible(e) && r.width >= 150 && r.height >= 40 && (parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none') && s.backgroundColor !== 'rgba(0, 0, 0, 0)'; }).length,
      };
    });
    await page.screenshot({ path: `${out}/reference-design.png`, clip: (await inspector(page).boundingBox())!, animations: 'disabled', caret: 'hide' });
    await page.getByRole('tab', { name: 'Code', exact: true }).click();
    await inspector(page).evaluate(node => node.scrollTop = 0);
    const codePanel = page.getByRole('tabpanel', { name: 'Code', exact: true }); await codePanel.evaluate(node => node.scrollTop = 0);
    const code = await codePanel.evaluate(node => {
      const clip = node.getBoundingClientRect(), visible = (e: Element) => { const r = e.getBoundingClientRect(); return r.top >= clip.top && r.bottom <= clip.bottom && r.height > 0; };
      const matching = node.querySelector('section[aria-label="Readable matching CSS"]')!;
      const meta = [...node.querySelectorAll('[class*="caption_"],[class*="mode_"],[class*="summary_"],h3,[class*="selector_"],[class*="brace_"],small[title],[class*="context_"],[class*="notices_"]')].filter(e => getComputedStyle(e).position !== 'absolute' && !e.parentElement?.closest('[class*="notices_"]'));
      const ranges = meta.map(e => e.getBoundingClientRect()).filter(r => r.bottom > clip.top && r.top < clip.bottom).map(r => [Math.max(r.top, clip.top), Math.min(r.bottom, clip.bottom)]).sort((a,b) => a[0]-b[0]);
      let pixels = 0, end = clip.top; for (const [top, bottom] of ranges) { pixels += Math.max(0, bottom - Math.max(top, end)); end = Math.max(end, bottom); }
      const media = [...matching.querySelectorAll('[class*="context_"]')].map(e => e.textContent!.replace(/\s*\{$/, '').trim());
      const sources = [...matching.querySelectorAll('small[title]')].map(e => e.getAttribute('title'));
      return {
        visibleDeclarations: [...node.querySelectorAll('[data-code-focus]')].filter(visible).length,
        totalDeclarations: node.querySelectorAll('[data-code-focus]').length,
        mediaHeaders: media.length, repeatedMediaHeaders: media.length - new Set(media).size,
        sourceLabels: sources.length, repeatedSourceLabels: sources.length - new Set(sources).size,
        largeRuleContainers: [...matching.querySelectorAll('[data-source-rule],:scope > div:not([data-source-run])')].filter(e => e.getBoundingClientRect().height >= 60).length,
        metadataExplanationPixels: Math.round(pixels), totalMetadataExplanationPixels: Math.round(meta.reduce((sum, e) => sum + e.getBoundingClientRect().height, 0)),
        records: [...matching.querySelectorAll('[data-code-focus]')].map(e => ({ key: e.getAttribute('data-code-focus'), property: e.getAttribute('data-property'), text: e.textContent })),
      };
    });
    expect(code.totalDeclarations).toBeGreaterThan(20);
    // An outer presentation run is permitted only when every original row has
    // the same known source identity. Individual selectors/rules remain nodes.
    for (const run of await page.locator('[data-source-run]').all()) {
      const identities = await run.locator('[data-code-focus]').evaluateAll(rows => rows.map(row => JSON.parse(row.getAttribute('data-code-focus')!)[2]));
      expect(identities.every(Boolean)).toBe(true); expect(new Set(identities).size).toBe(1);
      expect(await run.locator('[data-source-rule]').count()).toBeGreaterThan(0);
    }
    if (phase === 'final') {
      const baseline = JSON.parse(await readFile('artifacts/diagnostics/current-ui-visual-polish/structural-semantic/before/density.json', 'utf8'));
      expect(code.records, 'Every original declaration, source/rule/context identity and order remains unchanged').toEqual(baseline.code.records);
      expect(code.visibleDeclarations).toBeGreaterThan(baseline.code.visibleDeclarations);
      expect(code.repeatedMediaHeaders).toBeLessThan(baseline.code.repeatedMediaHeaders);
      expect(design.typographyHeight).toBeLessThan(baseline.design.typographyHeight);
    }
    await page.mouse.move(0, 0);
    await page.screenshot({ path: `${out}/reference-code.png`, clip: (await inspector(page).boundingBox())!, animations: 'disabled', caret: 'hide' });
    const shell = await inspector(page).evaluate(node => ({ scrollTop: node.scrollTop, children: [...node.children].map(e => ({ tag: e.tagName, class: e.className, scrollTop:e.scrollTop, height:e.getBoundingClientRect().height, y:e.getBoundingClientRect().y, flexShrink:getComputedStyle(e).flexShrink })) }));
    const theme = await inspector(page).evaluate(node => {
      const style = getComputedStyle(node), roles = ['surface','raised','popover-surface','text','text-secondary','text-muted','accent','accent-bright','accent-interaction','context-media','context-state','context-pseudo','syntax-selector','syntax-property','syntax-value','syntax-keyword','syntax-source','syntax-important','focus-ring','success','warning','error'];
      const colors = Object.fromEntries(roles.map(role => [role, style.getPropertyValue(`--${role}`).trim()]));
      const luminance = (hex:string) => { const channels = hex.slice(1).match(/../g)!.slice(0,3).map(c => parseInt(c,16)/255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4); return channels[0]*.2126+channels[1]*.7152+channels[2]*.0722; };
      const contrast = Object.fromEntries(roles.filter(role => !['surface','raised','popover-surface'].includes(role)).map(role => { const a = luminance(colors[role]), b = luminance(colors.surface); return [role, Math.round((Math.max(a,b)+.05)/(Math.min(a,b)+.05)*100)/100]; }));
      return { colors, contrastAgainstBase: contrast };
    });
    if (phase === 'final') for (const [role, ratio] of Object.entries(theme.contrastAgainstBase)) expect(ratio, `${role} contrast against base surface`).toBeGreaterThanOrEqual(4.5);
    await writeFile(`${out}/density.json`, JSON.stringify({ chrome: r.context.browser()!.version(), inspector: await inspector(page).boundingBox(), design, code, shell, theme }, null, 2));
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});
