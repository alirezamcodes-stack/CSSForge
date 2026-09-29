import { test, expect } from '@playwright/test';
import { setup, fixture, pick } from './extensionHarness';

const sourceFixture = fixture.replace('</style>', `
.primary { --text-primary: #345678; color: var(--text-primary); width: calc(100% - 2rem); animation: gentle 2s paused; }
@media (min-width: 800px) { @media (max-width: 2000px) { .primary:hover { letter-spacing: 2px; } } }
@media (min-width: 9999px) { @supports (display:grid) { @layer theme { .primary { --inactive: 12px; } } } }
@container card (width > 20px) { .primary { --container: 1rem; } }
@keyframes gentle { from { opacity: .8; } to { opacity: 1; } }
</style><link rel="stylesheet" href="/source-author.css"><link rel="stylesheet" href="http://styles.test/source-locked.css">`)
  .replace('id="checkout"', 'id="checkout" style="font-size:2rem!important;--inline-token:12px;padding:1em 2em"')
  .replace('</script>', `
const adopted = new CSSStyleSheet(); adopted.replaceSync('.primary { --adopted: 25%; }'); document.adoptedStyleSheets = [adopted];
const shadow = document.querySelector('#open-host').shadowRoot;
const shadowStyle = document.createElement('style'); shadowStyle.textContent = '#shadow-child { --shadow-token: 3rem; }'; shadow.append(shadowStyle);
const shadowAdopted = new CSSStyleSheet(); shadowAdopted.replaceSync('#shadow-child { --shadow-adopted: 4px; }'); shadow.adoptedStyleSheets = [shadowAdopted];
</script>`);

test('built extension Code uses centralized authored sources, nested contexts, adopted sheets and explicit refresh', async ({}, info) => {
  const { context, page, errors } = await setup(info, sourceFixture, async page => {
    await page.route('**/source-author.css', route => route.fulfill({ contentType: 'text/css', body: '.primary { --linked: 8px; }' }));
    await page.route('http://styles.test/source-locked.css', route => route.fulfill({ contentType: 'text/css', body: '.primary { outline-offset: 2px; }' }));
  });
  try {
    await pick(page, '#checkout'); await page.getByRole('tab', { name: 'Code', exact: true }).click();
    const code = page.getByTestId('live-code'), rules = code.getByRole('region', { name: 'Readable matching CSS' });
    const inline = code.getByRole('region', { name: 'Inline authored CSS' });
    await expect(inline).toContainText('2rem'); await expect(inline).toContainText('!important');
    await expect(inline).toContainText('--inline-token'); await expect(inline).toContainText('1em 2em');
    for (const text of ['var(--text-primary)', 'calc(100% - 2rem)', '--linked', '--adopted', '25%', '.primary:hover', '@media (min-width: 800px)', '@media (max-width: 2000px)', '@supports (display:grid)', '@layer theme', '@container card', '--inactive']) await expect(rules).toContainText(text);
    await expect(code).toContainText('Inaccessible stylesheet: http://styles.test/source-locked.css');
    await expect(code.getByRole('region', { name: 'Readable keyframes' })).toContainText('@keyframes gentle');
    await expect(rules.getByRole('button', { name: 'Edit --inactive', exact: true })).toBeDisabled();
    await page.evaluate(() => document.styleSheets[0].insertRule('.primary { --refreshed: 7rem; }', document.styleSheets[0].cssRules.length));
    await expect(rules).not.toContainText('--refreshed');
    await code.getByRole('button', { name: 'Refresh sources' }).click(); await expect(rules).toContainText('--refreshed');
    await pick(page, '#shadow-child');
    await expect(rules).toContainText('--shadow-token'); await expect(rules).toContainText('--shadow-adopted');
    await expect(rules).not.toContainText('--linked'); await expect(rules).not.toContainText('--adopted:');
    await expect(rules).not.toContainText('cssforge'); expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('native CSSOM engine retains ownership, nested groups, keyframe declarations and scoped identities', async ({ page }) => {
  await page.route('**/engine-native.html', route => route.fulfill({ contentType: 'text/html', body: sourceFixture }));
  await page.route('**/source-author.css', route => route.fulfill({ contentType: 'text/css', body: '.primary { --linked: 8px; }' }));
  await page.route('http://styles.test/source-locked.css', route => route.fulfill({ contentType: 'text/css', body: '.primary { outline-offset: 2px; }' }));
  await page.goto('/engine-native.html');
  const result = await page.evaluate(async () => {
    const modulePath = '/src/engine/sources/index.ts';
    const { createSourceIndex } = await import(modulePath);
    const index = createSourceIndex(document), target = document.querySelector('#checkout')!;
    const first = index.read(target);
    const nested = first.matches.find((match: any) => match.rule.declarations.some((item: any) => item.property === '--inactive'));
    const native = document.styleSheets[0], original = first.matches[0].rule.id;
    native.insertRule('.unrelated { color: blue }', 0);
    const cached = index.read(target) === first; index.invalidate();
    const refreshed = index.read(target);
    return {
      inline: first.inline.rules[0].declarations,
      kinds: first.sheets.map((item: any) => item.kind), access: first.sheets.find((item: any) => item.url?.includes('source-locked'))?.accessibility,
      nested: nested.rule.contexts, path: nested.rule.path,
      frames: first.keyframes[0].children.map((item: any) => ({ key: item.keyText, declarations: item.declarations })),
      stable: refreshed.matches[0].rule.id === original, cached, scans: index.getStats().scopeScans,
    };
  });
  // Chrome serializes important declarations after normal declarations; preserve its exposed order.
  expect(result.inline.map((item: any) => [item.property, item.value, item.important])).toEqual([['--inline-token', '12px', false], ['padding', '1em 2em', false], ['font-size', '2rem', true]]);
  expect(result.kinds).toEqual(['style', 'linked', 'linked', 'adopted']);
  expect(result.access).toMatchObject({ readable: false, reason: 'security' });
  expect(result.nested.map((item: any) => [item.kind, item.matches])).toEqual([['media', false], ['supports', true], ['layer', null]]);
  expect(result.path).toHaveLength(4);
  expect(result.frames.map((item: any) => item.key)).toEqual(['0%', '100%']);
  expect(result.frames[0].declarations[0]).toMatchObject({ property: 'opacity', value: '0.8', important: false });
  expect(result.cached).toBe(true); expect(result.stable).toBe(true); expect(result.scans).toBe(2);
});
