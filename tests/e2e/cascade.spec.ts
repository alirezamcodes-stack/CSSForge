import { test, expect } from '@playwright/test';
import { setup, pick } from './extensionHarness';

const fixture = `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
body { margin:0; } main { padding:60px; width:700px; } #parent { color:navy; font:22px Georgia; --token:2rem; }
@layer reset, theme;
@layer reset { #checkout { color:red!important; background-color:red; } }
@layer theme { #checkout { color:blue!important; background-color:blue; } }
span { letter-spacing:9px; }
.primary { display:block; margin:1px 2px; padding:3px; border:1px solid red; background:linear-gradient(red, blue) yellow; width:300px; letter-spacing:8px; }
#checkout { margin-top:7px; padding-left:9px; border-left-width:5px; background-color:black; letter-spacing:4px; color:green!important; }
.primary { text-align:left; } .primary { text-align:right; }
@media(min-width:800px) { .primary { text-transform:uppercase; } }
@media(min-width:9999px) { #checkout { text-transform:lowercase; } }
@supports(display:grid) { .primary { outline-width:6px; } }
.primary:hover { padding-top:13px; } .primary:focus { padding-top:17px; }
.primary::before { content:"Before "; color:purple; }
.wide { width:inherit; } .reset { color:unset; padding:unset; }
</style></head><body><main><section id="parent"><span id="checkout" class="primary" style="opacity:.6;margin-bottom:11px!important">Cascade target</span><span id="inherited">Inherited child</span></section></main></body></html>`;

test('built extension exposes certain/inactive/overridden status, keeps editing working and refreshes uncertainty', async ({}, info) => {
  const { context, page, errors } = await setup(info, fixture, async page => {
    await page.route('http://styles.test/cascade.css', route => route.fulfill({ contentType: 'text/css', body: '#checkout { opacity:.2!important }' }));
  });
  try {
    await pick(page, '#checkout'); await page.getByRole('tab', { name: 'Code', exact: true }).click();
    const code = page.getByTestId('live-code'), rules = code.getByRole('region', { name: 'Readable matching CSS' });
    await expect(page.getByTestId('cascade-summary')).toContainText('Readable author cascade');
    await expect(rules.locator('[data-property="color"][data-cascade-status="winning"]')).toHaveCount(1);
    await expect(rules.locator('[data-property="color"][data-cascade-status="overridden"]')).toHaveCount(2);
    await expect(rules.locator('[data-property="padding-top"][data-cascade-status="inactive"]')).toHaveCount(2);
    await expect(rules.locator('[data-property="text-transform"][data-cascade-status="inactive"]')).toHaveCount(1);
    await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(255, 0, 0)');
    const inline = code.getByRole('region', { name: 'Inline authored CSS' });
    await inline.getByRole('button', { name: 'Edit opacity', exact: true }).click();
    const input = inline.getByRole('textbox', { name: 'CSS value opacity', exact: true }); await input.fill('.8'); await input.press('Enter');
    const own = code.getByRole('region', { name: 'CSSForge overrides', exact: true });
    await expect(own.locator('[data-property="opacity"]')).toHaveAttribute('data-cascade-status', 'winning');
    await expect(inline.locator('[data-property="opacity"]')).toHaveAttribute('data-cascade-status', 'overridden');
    await expect(page.locator('#checkout')).toHaveCSS('opacity', '0.8');
    await own.getByRole('button', { name: 'Add session declaration' }).click();
    await own.getByRole('textbox', { name: 'CSS property', exact: true }).fill('color');
    await own.getByRole('textbox', { name: 'New CSS value' }).fill('gold'); await own.getByRole('button', { name: 'Apply', exact: true }).click();
    await expect(own.locator('[data-property="color"]')).toHaveAttribute('data-cascade-status', 'overridden');
    await expect(page.locator('#checkout')).toHaveCSS('color', 'rgb(255, 0, 0)');
    await page.evaluate(() => { const style = document.createElement('style'); style.textContent = '.primary { opacity:.4!important }'; document.head.append(style); });
    await code.getByRole('button', { name: 'Refresh sources' }).click();
    await expect(page.locator('#checkout')).toHaveCSS('opacity', '0.4');
    await expect(own.locator('[data-property="opacity"]')).toHaveAttribute('data-cascade-status', 'overridden');
    await page.evaluate(async () => { const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = 'http://styles.test/cascade.css'; const loaded = new Promise<void>(resolve => { link.onload = () => resolve(); }); document.head.append(link); await loaded; });
    await code.getByRole('button', { name: 'Refresh sources' }).click();
    await expect(page.getByTestId('cascade-summary')).toContainText('Inaccessible sources prevent a certain winner');
    await expect(code.locator('[data-cascade-status="winning"]')).toHaveCount(0);
    await expect(own.locator('[data-property="opacity"]')).toHaveAttribute('data-cascade-status', 'unresolved');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('native CSSOM resolves layers, normalized shorthand conflicts, inheritance and explicit pseudo/media contexts', async ({ page }) => {
  await page.route('**/cascade-native.html', route => route.fulfill({ contentType: 'text/html', body: fixture }));
  await page.goto('/cascade-native.html');
  const result = await page.evaluate(async () => {
    const sourcePath = '/src/engine/sources/index.ts', cascadePath = '/src/engine/cascade/index.ts';
    const { createSourceIndex } = await import(sourcePath), { createCascade } = await import(cascadePath);
    const index = createSourceIndex(document), engine = createCascade(document, index);
    const el = document.querySelector('#checkout')!;
    const base = engine.read(el), hover = engine.read(el, { media: [], pseudo: ':hover' }), focus = engine.read(el, { media: [], pseudo: ':focus' });
    const before = engine.read(el, { media: [], pseudo: '::before' });
    const inherited = engine.read(document.querySelector('#inherited')!);
    const summary = (result: any, property: string) => {
      const value = result.properties[property];
      return { winner: value?.winner?.value, confidence: value?.confidence, inherited: value?.inherited?.declaration?.value, authored: value?.winner?.declaration.property, reasons: value?.overridden.map((item: any) => item.reason) };
    };
    return {
      base: Object.fromEntries(['color', 'margin-top', 'margin-bottom', 'margin-left', 'padding-left', 'padding-top', 'border-left-width', 'border-right-color', 'background-color', 'background-image', 'text-align', 'text-transform', 'outline-width'].map(property => [property, summary(base, property)])),
      inherited: Object.fromEntries(['color', 'font-size', 'font-family', '--token'].map(property => [property, summary(inherited, property)])),
      hover: summary(hover, 'padding-top'), focus: summary(focus, 'padding-top'), before: summary(before, 'color'),
      scans: index.getStats().scopeScans,
    };
  });
  const winners: Record<string, string> = { color: 'red', 'margin-top': '7px', 'margin-bottom': '11px', 'margin-left': '2px', 'padding-left': '9px', 'padding-top': '3px', 'border-left-width': '5px', 'border-right-color': 'red', 'background-color': 'black', 'background-image': 'linear-gradient(red, blue)', 'text-align': 'right', 'text-transform': 'uppercase', 'outline-width': '6px' };
  for (const [property, value] of Object.entries(winners)) expect(result.base[property], property).toMatchObject({ winner: value, confidence: 'resolved' });
  expect(result.base['padding-top'].authored).toBe('padding');
  expect(result.base['text-align'].reasons).toContain('source-order');
  expect(result.base.color.reasons).toContain('layer-order');
  for (const [property, value] of Object.entries({ color: 'navy', 'font-size': '22px', 'font-family': 'Georgia', '--token': '2rem' })) expect(result.inherited[property], property).toMatchObject({ inherited: value, confidence: 'resolved' });
  expect(result.hover).toMatchObject({ winner: '13px', confidence: 'resolved' });
  expect(result.focus).toMatchObject({ winner: '17px', confidence: 'resolved' });
  expect(result.before).toMatchObject({ winner: 'purple', confidence: 'resolved' });
  expect(result.scans).toBe(1);
});
