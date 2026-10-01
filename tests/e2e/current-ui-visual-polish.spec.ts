import { test, expect, type Locator, type Page } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { setup, fixture, pick, dock, inspector, withinViewport } from './extensionHarness';

const phase = process.env.CSSFORGE_POLISH_STAGE ?? 'final';
const out = `artifacts/diagnostics/current-ui-visual-polish/${phase}`;
const html = fixture.replace('</style>', '#checkout{border:1px solid #84a897;background-image:linear-gradient(110deg,#315943 0%,#638470 55%,#a2b89f 100%);box-shadow:0 4px 12px #17332930;text-shadow:0 1px 2px #17332940;letter-spacing:.2px}@media(min-width:800px){#checkout{max-width:360px}}#checkout:hover{border-color:#afcbb9}</style>');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });
const field = (page: Page, name: string) => page.getByRole('textbox', { name, exact: true });
async function sections(page: Page, names: string[]) {
  for (const section of await page.locator('[data-section]').all()) {
    const name = (await section.getAttribute('data-section'))!, toggle = section.getByRole('button', { name, exact: true });
    if (await toggle.getAttribute('aria-expanded') !== String(names.includes(name))) await toggle.click();
  }
  await page.getByRole('tabpanel', { name: 'Design', exact: true }).evaluate(node => node.scrollTop = 0);
}
async function fits(node: Locator) {
  await expect.poll(() => node.evaluate(element => {
    const r = element.getBoundingClientRect();
    return r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && element.scrollWidth <= element.clientWidth + 1;
  })).toBe(true);
}
async function appearance(node: Locator) {
  return node.evaluate(element => {
    const s = getComputedStyle(element), r = element.getBoundingClientRect();
    return { width: r.width, height: r.height, font: s.fontFamily, size: s.fontSize, weight: s.fontWeight, lineHeight: s.lineHeight, padding: s.padding, gap: s.gap, radius: s.borderRadius, background: s.backgroundColor, color: s.color, border: s.borderColor, shadow: s.boxShadow };
  });
}
async function shot(page: Page, name: string) {
  await page.mouse.move(0, 0); await page.evaluate(() => document.fonts.ready);
  await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  await page.screenshot({ path: `${out}/${name}.png`, animations: 'disabled', caret: 'hide' });
}

test('production visual inventory, reference density and representative screens', async ({}, info) => {
  test.setTimeout(120000); await mkdir(out, { recursive: true });
  const r = await setup(info, html), { page } = r;
  try {
    await page.setViewportSize({ width: 1440, height: 1000 }); await pick(page, '#checkout');
    await sections(page, ['Spacing', 'Typography']); await shot(page, '01-inspector-design');
    const inventory: Record<string, unknown> = {
      chrome: r.context.browser()!.version(), inspector: await appearance(inspector(page)),
      section: await appearance(button(page, 'Typography')), headerAction: await appearance(button(page, 'Inspector menu')),
      tab: await appearance(page.getByRole('tab', { name: 'Design', exact: true })),
      numeric: await appearance(field(page, 'Font size')), unit: await appearance(button(page, 'Font size unit')),
      dock: await appearance(dock(page)), dockAction: await appearance(dock(page).getByRole('button', { name: 'Open Changes', exact: true })),
      geometry: await field(page, 'Width').evaluate(element => {
        const input = element as HTMLInputElement, style = getComputedStyle(input), canvas = document.createElement('canvas'), context = canvas.getContext('2d')!;
        const font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        context.font = font;
        return { value: input.value, width: input.clientWidth, textWidth: context.measureText(input.value).width, padding: parseFloat(style.paddingLeft) + parseFloat(style.paddingRight), font };
      }),
    };
    if (phase === 'final' || phase === 'structural-semantic/final') {
      const geometry = inventory.geometry as { width: number; textWidth: number; padding: number };
      expect(geometry.textWidth + geometry.padding, 'Representative geometry value is fully readable').toBeLessThanOrEqual(geometry.width);
    }
    for (const [section, file] of [['Typography', '02-typography'], ['Spacing', '03-spacing'], ['Background', '04-background-gradient'], ['Box shadow', '05-box-shadow'], ['Filters', '06-filters']]) {
      await sections(page, [section]); await page.locator(`[data-section="${section}"]`).evaluate(node => node.scrollIntoView({ block: 'start' }));
      if (section === 'Filters') { await field(page, 'Contrast value').fill('120%'); await field(page, 'Contrast value').press('Enter'); }
      await shot(page, file);
      if (section === 'Typography') inventory.typography = await appearance(page.locator('[data-section="Typography"]'));
      if (section === 'Filters') inventory.filters = await appearance(page.locator('[data-section="Filters"]'));
    }
    await page.getByRole('tab', { name: 'Code', exact: true }).click(); await shot(page, '07-code');
    await page.getByRole('tab', { name: 'HTML', exact: true }).click(); await shot(page, '08-html');
    await dock(page).getByRole('button', { name: 'Open Navigator', exact: true }).click();
    inventory.navigator = await appearance(page.getByRole('dialog', { name: 'Navigator', exact: true })); await shot(page, '09-navigator'); await page.keyboard.press('Escape');
    await dock(page).getByRole('button', { name: 'Open Changes', exact: true }).click();
    inventory.changes = await appearance(page.getByRole('dialog', { name: 'Changes', exact: true })); await shot(page, '10-changes'); await page.keyboard.press('Escape');
    await page.getByRole('tab', { name: 'Design', exact: true }).click();
    await sections(page, ['Display', 'Border', 'Positioning', 'Box shadow', 'Text shadow']);
    await page.locator('[data-section="Display"]').evaluate(node => node.scrollIntoView({ block: 'start' }));
    await shot(page, '18-design-effects-lower');
    const colors: Record<string, unknown> = {};
    for (const [section, label] of [['Typography', 'Text color'], ['Background', 'Background color'], ['Border', 'Border color'], ['Box shadow', 'Box shadow color'], ['Text shadow', 'Text shadow color'], ['Background', 'Stop 1 color']]) {
      await sections(page, [section]); const trigger = button(page, `${label} picker`);
      const closed = await appearance(field(page, label)), swatch = await appearance(trigger.locator('span').last());
      await trigger.click(); const popup = page.getByRole('dialog', { name: `${label} picker`, exact: true }); await fits(popup);
      const selected = popup.getByRole('button', { name: 'HEX', exact: true });
      colors[label] = { closed, swatch, popup: await appearance(popup), format: await appearance(selected), input: await appearance(field(page, `${label} HEX`)), spectrum: await appearance(popup.locator('.react-colorful')), alpha: await appearance(field(page, `${label} alpha`)) };
      if (label === 'Text color') await shot(page, '11-color-control');
      await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
    }
    inventory.colors = colors;
    if (phase === 'final' || phase === 'structural-semantic/final') {
      const values = Object.values(colors) as any[];
      for (const value of values.slice(1)) for (const key of ['closed', 'swatch', 'popup', 'format', 'input', 'spectrum', 'alpha']) {
        for (const property of ['font', 'size', 'weight', 'radius', 'background', 'padding', 'height']) {
          if (key === 'swatch' && property === 'background') continue; // The context's real color is intentional.
          expect(value[key][property], `${key}.${property} shared ColorControl`).toEqual(values[0][key][property]);
        }
      }
    }
    await dock(page).screenshot({ path: `${out}/12-dock.png`, animations: 'disabled' });
    // Same approximately 350×1110 inspector scale as the supplied references.
    await page.setViewportSize({ width: 1440, height: 1228 });
    await sections(page, ['Spacing', 'Typography']); await inspector(page).evaluate(node => node.scrollTop = 0); await shot(page, '15-reference-design');
    await page.screenshot({ path: `${out}/15-reference-design-inspector.png`, clip: (await inspector(page).boundingBox())!, animations: 'disabled', caret: 'hide' });
    await page.getByRole('tab', { name: 'Code', exact: true }).click(); await inspector(page).evaluate(node => node.scrollTop = 0); await page.getByRole('tabpanel', { name:'Code', exact:true }).evaluate(node => node.scrollTop = 0); await shot(page, '16-reference-code');
    await page.screenshot({ path: `${out}/16-reference-code-inspector.png`, clip: (await inspector(page).boundingBox())!, animations: 'disabled', caret: 'hide' });
    await page.getByRole('tab', { name: 'Design', exact: true }).click();
    await sections(page, ['Typography']);
    const responsive = [];
    for (const [width, height, zoom] of [[390, 844, 1], [320, 568, 1], [390, 280, 1], [1440, 360, 1], [1440, 1000, 1.25], [1440, 1000, 1.5], [1440, 1000, 2]]) {
      await page.setViewportSize({ width, height });
      await r.worker.evaluate(async ({ id, zoom }) => (globalThis as any).chrome.tabs.setZoom(id, zoom), { id: r.tabId, zoom });
      await expect.poll(() => r.worker.evaluate(async id => (globalThis as any).chrome.tabs.getZoom(id), r.tabId)).toBe(zoom);
      await withinViewport(page); await fits(page.getByRole('tabpanel', { name: 'Design', exact: true }));
      await button(page, 'Text color picker').click(); const popup = page.getByRole('dialog', { name: 'Text color picker', exact: true }); await fits(popup);
      await field(page, 'Text color HEX').fill('invalid'); await expect(field(page, 'Text color HEX')).toHaveAttribute('aria-invalid', 'true'); await fits(popup);
      if (width === 320) await shot(page, '13-narrow-320');
      if (width === 390 && height === 844) await shot(page, '17-narrow-390');
      if (zoom === 2) await shot(page, '14-zoom-200');
      responsive.push({ width, height, zoom, inspector: await inspector(page).boundingBox(), popup: await popup.boundingBox(), noOverflow: true });
      await page.keyboard.press('Escape'); await expect(button(page, 'Text color picker')).toBeFocused();
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(dock(page).getByRole('button', { name: 'More tools', exact: true })).toHaveCSS('transition-duration', '0s');
    await r.worker.evaluate(async id => (globalThis as any).chrome.tabs.setZoom(id, 1), r.tabId);
    await expect.poll(() => r.worker.evaluate(async id => (globalThis as any).chrome.tabs.getZoom(id), r.tabId)).toBe(1);
    await page.setViewportSize({ width: 320, height: 844 }); await sections(page, ['Filters']);
    await page.locator('[data-section="Filters"]').evaluate(node => node.scrollIntoView({ block: 'start' }));
    await fits(page.getByRole('tabpanel', { name: 'Design', exact: true })); await shot(page, '19-filters-narrow-320');
    await writeFile(`${out}/inventory.json`, JSON.stringify({ inventory, responsive }, null, 2)); expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});
