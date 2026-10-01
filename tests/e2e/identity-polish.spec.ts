import { test, expect, type Page, type Locator } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, pick, dock, inspector, withinViewport, fixture } from './extensionHarness';
declare const chrome: typeof browser;
const output = 'artifacts/screenshots/phase-06.5.3';
async function shot(page: Page, name: string) { await page.mouse.move(0, 0); await page.screenshot({ path: `${output}/${name}.png`, animations: 'disabled' }); }
async function fits(page: Page, element: Locator) {
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  const b = (await element.boundingBox())!;
  expect(b.x).toBeGreaterThanOrEqual(0); expect(b.y).toBeGreaterThanOrEqual(0);
  expect(b.x + b.width).toBeLessThanOrEqual(viewport.width + 1); expect(b.y + b.height).toBeLessThanOrEqual(viewport.height + 1);
}
async function chromeFits(page: Page) {
  await withinViewport(page);
  const header = page.getByRole('group', { name: 'Move inspector' });
  const bounds = await header.locator('button').evaluateAll(nodes => nodes.map(node => { const r = node.getBoundingClientRect(); return { x:r.x, right:r.right, width:r.width, height:r.height }; }));
  expect(bounds).toHaveLength(3);
  expect(bounds.every((b,i) => b.width >= 30 && b.height >= 30 && (!i || b.x >= bounds[i-1].right))).toBe(true);
  expect(await inspector(page).evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
  for (const icon of await dock(page).locator('svg').all()) await fits(page, icon);
}

test('Phase 06.5.3 identity, real fonts, seven views, narrow and zoom', async ({}, info) => {
  // No font URL is permitted: bundled buffer-backed UI fonts must still render.
  const { page, context, worker, tabId, errors, action } = await setup(info, fixture.replace('<head>', '<head><meta http-equiv="Content-Security-Policy" content="font-src \'none\'">'));
  try {
    await mkdir(output, { recursive: true });
    await page.setViewportSize({ width: 1440, height: 1100 }); await pick(page, '#checkout');
    const hostFont = await page.locator('#checkout').evaluate(node => getComputedStyle(node).fontFamily);
    await expect.poll(() => page.evaluate(() => Array.from(document.fonts).filter(face => face.family.startsWith('CSSForge Geist')).map(face => face.status))).toEqual(['loaded','loaded']);
    const sans = /CSSForge Geist Sans/, mono = /CSSForge Geist Mono/;
    await expect(inspector(page)).toHaveCSS('font-family', sans);
    await expect(dock(page)).toHaveCSS('font-family', sans);
    await expect(page.getByTestId('selected-identity')).toHaveCSS('font-family', mono);
    for (const section of await page.locator('[data-section]').all()) {
      const name = (await section.getAttribute('data-section'))!;
      const header = section.getByRole('button', { name, exact:true });
      if (await header.getAttribute('aria-expanded') !== String(name === 'Typography')) await header.click();
    }
    const design = page.getByRole('tabpanel', { name:'Design', exact:true });
    await design.evaluate(node => node.scrollTop = 0);
    await expect(page.getByRole('textbox', { name:'Font size', exact:true })).toHaveCSS('font-family', mono);
    // Verify Chrome's actual rendered font, not just a declared token.
    const cdp = await context.newCDPSession(page); await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
    const documentTree = await cdp.send('DOM.getDocument', { depth:-1, pierce:true });
    type Node = typeof documentTree.root;
    const find = (node: Node): Node | undefined => node.attributes?.includes('selected-identity') ? node : [...(node.children ?? []), ...(node.shadowRoots ?? [])].map(find).find(Boolean);
    const rendered = await cdp.send('CSS.getPlatformFontsForNode', { nodeId:find(documentTree.root)!.nodeId });
    expect(rendered.fonts.some(font => font.isCustomFont && /Geist/.test(font.familyName) && font.glyphCount > 0)).toBe(true);
    await shot(page,'01-inspector-design');
    const codeTab = page.getByRole('tab', { name:'Code', exact:true });
    await page.getByRole('tab', { name:'Design', exact:true }).focus(); await page.keyboard.press('ArrowRight');
    await expect(codeTab).toBeFocused(); await expect(codeTab).toHaveAttribute('aria-selected','true');
    await expect(page.locator('[data-property="font"]').first()).toBeVisible();
    const declaration = page.locator('[data-property]').first(); await expect(declaration).toHaveCSS('font-family', mono);
    await shot(page,'02-code');
    await page.keyboard.press('ArrowRight'); await expect(page.getByRole('tab', { name:'HTML', exact:true })).toBeFocused();
    await expect(page.getByRole('treeitem').first()).toHaveCSS('font-family', mono);
    await dock(page).getByRole('button', { name:'Open Navigator', exact:true }).click();
    await expect(page.getByRole('dialog', { name:'Navigator', exact:true })).toHaveCSS('font-family', sans);
    await shot(page,'03-html-navigator'); await page.keyboard.press('Escape');
    await dock(page).getByRole('button', { name:'Open Changes', exact:true }).click();
    await expect(page.getByRole('dialog', { name:'Changes', exact:true })).toHaveCSS('font-family', sans);
    await page.keyboard.press('Escape');
    await page.getByRole('tab', { name:'Design', exact:true }).click(); await design.evaluate(node => node.scrollTop = 0);
    const media = page.getByRole('button', { name:'Media', exact:true }); await media.click();
    const mediaPopup = page.getByRole('dialog', { name:'Media', exact:true });
    await expect(mediaPopup).toHaveCSS('font-family', sans); await fits(page,mediaPopup); await shot(page,'04-media-popover');
    await page.keyboard.press('Escape'); await expect(media).toBeFocused();
    const color = page.getByRole('button', { name:'Text color picker', exact:true }); await color.click();
    const colorPopup = page.getByRole('dialog', { name:'Text color picker', exact:true });
    await expect(colorPopup).toHaveCSS('font-family', sans); await fits(page,colorPopup); await shot(page,'05-color-popover');
    await page.keyboard.press('Escape'); await expect(color).toBeFocused();
    await dock(page).screenshot({ path:`${output}/06-bottom-dock.png` });
    await page.setViewportSize({ width:390,height:844 }); await design.evaluate(node => node.scrollTop = 0); await chromeFits(page); await shot(page,'07-narrow-viewport');
    for (const width of [320,390]) {
      await page.setViewportSize({ width,height:844 }); await chromeFits(page);
      for (const label of ['Media','State or pseudo','Font family','Text color picker']) {
        const trigger = page.getByRole('button', { name:label,exact:true }); await trigger.click();
        await fits(page,page.getByRole('dialog', { name:label,exact:true })); await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
      }
      const measure = dock(page).getByRole('button', { name:'Measurement tools',exact:true });
      await measure.focus(); const tooltip = page.getByRole('tooltip', { name:'Measurement tools',exact:true });
      await expect(tooltip).toBeVisible(); await expect(tooltip).toHaveCSS('font-family',sans); await fits(page,tooltip);
      await measure.click(); await expect(tooltip).toBeHidden(); await expect(measure).toHaveAttribute('data-active','true');
      await fits(page,page.getByRole('dialog', { name:'Measurement tools',exact:true })); await page.keyboard.press('Escape');
    }
    await page.setViewportSize({width:1440,height:1000}); await worker.evaluate(id => chrome.tabs.setZoom(id,2),tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id),tabId)).toBe(2); await chromeFits(page);
    await media.click(); await fits(page,mediaPopup); await page.keyboard.press('Escape');
    await color.click(); await fits(page,colorPopup); await page.keyboard.press('Escape');
    await page.emulateMedia({ reducedMotion:'reduce' });
    const measure = dock(page).getByRole('button', {name:'Measurement tools',exact:true}); await measure.focus();
    const tooltip = page.getByRole('tooltip', {name:'Measurement tools',exact:true}); await expect(tooltip).toBeVisible(); await fits(page,tooltip);
    await expect(tooltip).toHaveCSS('animation-duration','0s'); await expect(measure).toHaveCSS('transition-duration','0s');
    expect(await page.locator('#checkout').evaluate(node => getComputedStyle(node).fontFamily)).toBe(hostFont);
    expect(errors).toEqual([]);
    await action(); await expect(inspector(page)).toBeHidden();
    expect(await page.evaluate(() => Array.from(document.fonts).filter(face => face.family.startsWith('CSSForge Geist')).length)).toBe(0);
  } finally { await context.close(); }
});
