import { test, expect, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

test.beforeEach(async ({ page }) => { await page.goto('/'); await expect(page.getByRole('tab', { name: 'Design', exact: true })).toBeVisible(); });

test('Shadow Root, tabs, accordions, and honest fixture controls', async ({ page }) => {
  expect(await page.locator('cssforge-ui').evaluate(el => !!el.shadowRoot)).toBe(true);
  await page.getByRole('button', { name: 'Spacing', exact: true }).click();
  await expect(page.getByLabel('Margin top', { exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Spacing', exact: true }).click();
  await page.getByLabel('Padding top', { exact: true }).fill('48');
  await expect(page.getByLabel('Padding top', { exact: true })).toHaveValue('48');
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await expect(page.getByLabel('Enable display', { exact: true })).toBeChecked();
  await page.getByLabel('Enable display', { exact: true }).uncheck();
  await expect(page.getByLabel('Enable display', { exact: true })).not.toBeChecked();
  await page.getByRole('tab', { name: 'HTML', exact: true }).click();
  await expect(page.getByLabel('Fixture element hierarchy')).toBeVisible();
  await page.getByRole('tab', { name: 'HTML', exact: true }).press('Home');
  await expect(page.getByRole('tab', { name: 'Design', exact: true })).toHaveAttribute('aria-selected', 'true');
});

test('shared popovers dismiss, restore focus, and support keyboard navigation', async ({ page }) => {
  const media = page.getByRole('button', { name: 'Media', exact: true });
  await media.click();
  await expect(media).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'Auto · None', exact: true }).press('ArrowDown');
  await expect(page.getByRole('button', { name: 'Desktop · ≥ 1024px', exact: true })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(media).toContainText('Desktop');
  await media.click();
  await page.keyboard.press('Escape');
  await expect(media).toBeFocused();
  await expect(media).toHaveAttribute('aria-expanded', 'false');
  await media.click();
  await page.locator('.site-brand').click();
  await expect(media).toHaveAttribute('aria-expanded', 'false');
});

test('dock surfaces trap focus, close with Escape, and restore the trigger', async ({ page }) => {
  const dock = page.getByRole('navigation', { name: 'CSSForge tools' });
  const navigator = dock.getByRole('button', { name: 'Open Navigator', exact: true });
  await navigator.click();
  await expect(page.getByRole('dialog', { name: 'Navigator', exact: true })).toBeVisible();
  await page.keyboard.press('Shift+Tab');
  await expect(page.getByRole('button', { name: 'Back to canvas' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(navigator).toBeFocused();
  await dock.getByRole('button', { name: 'Open Changes', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Changes', exact: true })).toBeVisible();
  await expect(page.getByText('padding: 24px;', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close Changes' }).click();
  await dock.getByRole('button', { name: 'Hide inspector panel' }).click();
  await expect(page.getByRole('complementary', { name: 'Selected element inspector' })).toBeHidden();
  await dock.getByRole('button', { name: 'Show inspector panel' }).click();
  await expect(page.getByRole('complementary', { name: 'Selected element inspector' })).toBeVisible();
});

async function verifyBounds(page: Page) {
  for (const locator of [page.getByRole('complementary'), page.getByRole('navigation', { name: 'CSSForge tools' })]) {
    const bounds = await locator.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width + 1);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height + 1);
  }
}
for (const viewport of [{ width: 375, height: 667 }, { width: 1440, height: 450 }, { width: 720, height: 450 }, { width: 320, height: 568 }]) {
  test(`viewport ${viewport.width}×${viewport.height} keeps panels and lower controls reachable`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await verifyBounds(page);
    await page.getByRole('slider', { name: 'Sepia', exact: true }).scrollIntoViewIfNeeded();
    await expect(page.getByRole('slider', { name: 'Sepia', exact: true })).toBeInViewport();
    await page.getByRole('button', { name: 'More tools', exact: true }).click();
    const popover = page.getByRole('dialog', { name: 'More tools', exact: true });
    await expect(popover).toBeInViewport();
    const bounds = await popover.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.keyboard.press('Escape');
    const dock = page.getByRole('navigation', { name: 'CSSForge tools' });
    for (const name of ['Changes', 'Navigator']) {
      await dock.getByRole('button', { name: `Open ${name}`, exact: true }).click();
      const surface = page.getByRole('dialog', { name, exact: true });
      const box = await surface.boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(8);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width - 8);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
      if (name === 'Navigator') await expect(page.getByRole('button', { name: 'Back to canvas' })).toBeInViewport();
      await page.keyboard.press('Escape');
    }
  });
}

test('capture final Phase 01 refinement evidence without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await mkdir('artifacts/screenshots/final-pass', { recursive: true });
  await page.setViewportSize({ width: 1440, height: 1800 });
  await page.screenshot({ path: 'artifacts/screenshots/final-pass/01-design-full.png' });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await page.screenshot({ path: 'artifacts/screenshots/final-pass/02-code.png' });
  await page.getByRole('navigation', { name: 'CSSForge tools' }).screenshot({ path: 'artifacts/screenshots/final-pass/03-bottom-dock.png' });
  await page.getByRole('button', { name: 'Open Changes', exact: true }).click();
  await page.screenshot({ path: 'artifacts/screenshots/final-pass/04-changes.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('navigation', { name: 'CSSForge tools' }).getByRole('button', { name: 'Open Navigator', exact: true }).click();
  await page.screenshot({ path: 'artifacts/screenshots/final-pass/05-navigator.png' });
  await page.keyboard.press('Escape');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.screenshot({ path: 'artifacts/screenshots/final-pass/06-narrow.png' });
  expect(errors).toEqual([]);
});
