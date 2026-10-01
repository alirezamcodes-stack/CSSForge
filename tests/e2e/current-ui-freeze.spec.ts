import { test, expect, type Page, type Locator } from '@playwright/test';
import { setup, pick, dock, inspector, withinViewport } from './extensionHarness';

async function fits(page: Page, node: Locator) {
  await expect.poll(() => node.evaluate(element => {
    const r = element.getBoundingClientRect();
    return r.x >= 0 && r.y >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && element.scrollWidth <= element.clientWidth + 1;
  })).toBe(true);
}

test('freeze built MV3 short viewports retain reachable fields and bounded overlays', async ({}, info) => {
  test.setTimeout(90000);
  const r = await setup(info);
  try {
    await pick(r.page, '#checkout');
    for (const [width, height] of [[390, 280], [1440, 360]]) {
      await r.page.setViewportSize({ width, height }); await withinViewport(r.page);
      const panel = r.page.getByRole('tabpanel', { name: 'Design', exact: true });
      expect(await panel.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
      const size = r.page.getByRole('textbox', { name: 'Font size', exact: true });
      await size.scrollIntoViewIfNeeded(); await expect(size).toBeInViewport();
      await size.fill('21'); await size.press('Enter'); await expect(r.page.locator('#checkout')).toHaveCSS('font-size', '21px');
      await r.page.getByRole('button', { name: 'Text color picker', exact: true }).click();
      await fits(r.page, r.page.getByRole('dialog', { name: 'Text color picker', exact: true })); await r.page.keyboard.press('Escape');
      for (const title of ['Changes', 'Navigator']) {
        await dock(r.page).getByRole('button', { name: `Open ${title}`, exact: true }).click();
        const popup = r.page.getByRole('dialog', { name: title, exact: true }); await fits(r.page, popup);
        await popup.getByRole('button', { name: `Close ${title}`, exact: true }).click();
      }
      await withinViewport(r.page);
    }
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('freeze built MV3 modal contains keyboard and host focus and restores nested opener', async ({}, info) => {
  const r = await setup(info);
  try {
    await pick(r.page, '#checkout');
    const more = dock(r.page).getByRole('button', { name: 'More tools', exact: true });
    for (const [title, action] of [['Changes', 'Session edit controls'], ['Navigator', 'Open Navigator']]) {
      await more.click(); await r.page.getByRole('dialog', { name: 'More tools', exact: true }).getByRole('button', { name: action, exact: true }).click();
      const popup = r.page.getByRole('dialog', { name: title, exact: true }); await expect(popup).toBeVisible();
      for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < 8; i++) {
        await r.page.keyboard.press(key);
        expect(await popup.evaluate(node => node.contains((node.getRootNode() as ShadowRoot).activeElement))).toBe(true);
      }
      await r.page.locator('#host-link').evaluate(node => (node as HTMLElement).focus());
      expect(await r.page.locator('#host-link').evaluate(node => node === document.activeElement)).toBe(false);
      await r.page.keyboard.press('Escape'); await expect(popup).toHaveCount(0); await expect(more).toBeFocused();
      await expect(inspector(r.page)).toBeVisible();
    }
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});
