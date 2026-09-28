import { test, expect, type Page } from '@playwright/test';

test.beforeEach(async ({ page }) => { await page.goto('/'); });
const inspector = (page: Page) => page.getByRole('complementary', { name: 'Selected element inspector' });
const dock = (page: Page) => page.getByRole('navigation', { name: 'CSSForge tools' });
async function dragTo(page: Page, x: number, y: number) {
  const handle = page.getByRole('group', { name: 'Move inspector' });
  const box = await handle.boundingBox();
  await page.mouse.move(box!.x + 60, box!.y + 20);
  await page.mouse.down();
  await page.mouse.move(x, y, { steps: 10 });
  await page.mouse.up();
}
async function withinViewport(page: Page) {
  const box = (await inspector(page).boundingBox())!;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(8);
  expect(box.y).toBeGreaterThanOrEqual(8);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width - 7);
  expect(box.y + box.height).toBeLessThanOrEqual((await dock(page).boundingBox())!.y);
}

test('all tab keys preserve fixture input and accordion state', async ({ page }) => {
  await page.getByLabel('Padding top', { exact: true }).fill('48');
  await page.getByRole('button', { name: 'Typography', exact: true }).click();
  const design = page.getByRole('tab', { name: 'Design', exact: true });
  await design.focus();
  for (const [key, name] of [['ArrowRight', 'Code'], ['ArrowRight', 'HTML'], ['ArrowRight', 'Design'], ['End', 'HTML'], ['Home', 'Design'], ['ArrowLeft', 'HTML']] as const) {
    await page.keyboard.press(key);
    const tab = page.getByRole('tab', { name, exact: true });
    await expect(tab).toBeFocused();
    await expect(tab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tabpanel')).toHaveAttribute('id', await tab.getAttribute('aria-controls') as string);
  }
  await design.click();
  await expect(page.getByLabel('Padding top', { exact: true })).toHaveValue('48');
  await expect(page.getByRole('button', { name: 'Typography', exact: true })).toHaveAttribute('aria-expanded', 'false');
  await page.getByRole('button', { name: 'Typography', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Typography', exact: true })).toHaveAttribute('aria-expanded', 'true');
});

test('media, pseudo and font choices persist; exclusive popovers support keys and cancellation', async ({ page }) => {
  const media = page.getByRole('button', { name: 'Media', exact: true });
  const pseudo = page.getByRole('button', { name: 'State or pseudo', exact: true });
  await media.press('ArrowDown');
  await page.getByRole('button', { name: 'Auto · None', exact: true }).press('End');
  await page.keyboard.press('Enter');
  await expect(media).toContainText('Mobile');
  await expect(media).toBeFocused();
  await media.click();
  await pseudo.click();
  await expect(page.getByRole('dialog', { name: 'Media', exact: true })).toBeHidden();
  await page.getByRole('button', { name: ':hover', exact: true }).click();
  await expect(pseudo).toContainText(':hover');
  await pseudo.click();
  await page.keyboard.press('End');
  await page.keyboard.press('Escape');
  await expect(pseudo).toBeFocused();
  await expect(pseudo).toContainText(':hover');
  const font = page.getByRole('button', { name: 'Font family', exact: true });
  await font.scrollIntoViewIfNeeded();
  await font.click();
  await page.getByRole('button', { name: 'Inter, -apple-system, sans-serif', exact: true }).press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(font).toContainText('Arial');
  await expect(font).toBeFocused();
  await page.getByRole('tab', { name: 'Code', exact: true }).click();
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(font).toContainText('Arial');
  await media.scrollIntoViewIfNeeded();
  await expect(media).toContainText('Mobile');
  await expect(pseudo).toContainText(':hover');
  await media.click();
  await page.locator('.site-brand').click();
  await expect(page.getByRole('dialog', { name: 'Media', exact: true })).toBeHidden();
  await expect(inspector(page)).toBeVisible();
});

test('drag clamps all edges, preserves position and input, and reflows after resize', async ({ page }) => {
  await page.getByLabel('Padding top', { exact: true }).fill('48');
  const initial = (await inspector(page).boundingBox())!;
  await dragTo(page, 450, 90);
  const moved = (await inspector(page).boundingBox())!;
  expect(moved.x).toBeLessThan(initial.x - 300);
  await withinViewport(page);
  await dock(page).getByRole('button', { name: 'Hide inspector panel' }).click();
  await dock(page).getByRole('button', { name: 'Show inspector panel' }).click();
  expect((await inspector(page).boundingBox())!.x).toBe(moved.x);
  await expect(page.getByLabel('Padding top', { exact: true })).toHaveValue('48');
  for (const [x, y] of [[-400, -400], [1800, -400], [-400, 1500], [1800, 1500]]) {
    await dragTo(page, x, y);
    await withinViewport(page);
  }
  await page.setViewportSize({ width: 375, height: 480 });
  await withinViewport(page);
  await expect(page.getByRole('button', { name: 'Hide inspector', exact: true })).toBeInViewport();
  await page.getByRole('slider', { name: 'Sepia', exact: true }).scrollIntoViewIfNeeded();
  await expect(page.getByRole('slider', { name: 'Sepia', exact: true })).toBeInViewport();
});

test('drag cancellation, action exclusion and keyboard movement', async ({ page }) => {
  const handle = page.getByRole('group', { name: 'Move inspector' });
  const original = (await inspector(page).boundingBox())!;
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 50, box.y + 20);
  await page.mouse.down();
  await page.mouse.move(400, 200, { steps: 5 });
  await page.keyboard.press('Escape');
  await page.mouse.up();
  expect((await inspector(page).boundingBox())!.x).toBe(original.x);
  await handle.focus();
  await page.keyboard.press('ArrowLeft');
  expect((await inspector(page).boundingBox())!.x).toBe(original.x - 10);
  await page.keyboard.press('Home');
  expect((await inspector(page).boundingBox())!.x).toBe(original.x);
  await page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Inspector menu', exact: true })).toBeVisible();
  expect((await inspector(page).boundingBox())!.x).toBe(original.x);
  await page.keyboard.press('Escape');
  await expect(inspector(page)).toBeVisible();
});

test('surface opened through a menu restores the surviving origin and blocks background focus', async ({ page }) => {
  const more = page.getByRole('button', { name: 'More tools', exact: true });
  await more.click();
  await page.getByRole('button', { name: 'Review fixture changes', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Changes', exact: true });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('button', { name: 'Close Changes' })).toBeFocused();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate(el => el.contains((el.getRootNode() as ShadowRoot).activeElement))).toBe(true);
  }
  await page.locator('.site-brand').evaluate((el: HTMLElement) => el.focus());
  expect(await dialog.evaluate(el => el.contains((el.getRootNode() as ShadowRoot).activeElement))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(more).toBeFocused();
  await expect(inspector(page)).toBeVisible();
  await dock(page).getByRole('button', { name: 'Open Navigator', exact: true }).click();
  const node = page.getByRole('dialog', { name: 'Navigator' }).getByRole('button', { name: '<h1>', exact: true });
  await node.click();
  await expect(node).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Back to canvas' }).click();
  await dock(page).getByRole('button', { name: 'Open Navigator', exact: true }).click();
  await expect(node).toHaveAttribute('aria-pressed', 'true');
});

test('dock tool state, pause state and tooltips remain consistent', async ({ page }) => {
  const measure = page.getByRole('button', { name: 'Measurement tools', exact: true });
  await measure.hover();
  await expect(page.getByRole('tooltip', { name: 'Measurement tools' })).toBeVisible();
  await measure.click();
  await expect(measure).toHaveAttribute('aria-expanded', 'true');
  await expect(measure).toHaveAttribute('data-active', 'true');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await page.getByRole('button', { name: 'Color tools', exact: true }).click();
  await expect(measure).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
  await expect(inspector(page)).toBeVisible();
  await dock(page).getByRole('button', { name: 'Pause fixture preview' }).click();
  await expect(inspector(page)).toBeHidden();
  await dock(page).getByRole('button', { name: 'Show inspector panel' }).click();
  await expect(dock(page).getByRole('button', { name: 'Pause fixture preview' })).toHaveAttribute('aria-pressed', 'false');
  const power = dock(page).getByRole('button', { name: 'Hide fixture UI panels' });
  await page.keyboard.press('Tab');
  await expect(power).toBeFocused();
  await expect(page.getByRole('tooltip', { name: 'Hide fixture UI panels' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toBeHidden();
  await expect(inspector(page)).toBeVisible();
});

test('UI keyboard events stay in the Shadow Root; page Escape leaves base inspector open', async ({ page }) => {
  await page.evaluate(() => {
    const host = document.querySelector('.site-brand')!;
    host.setAttribute('data-page-keys', '0');
    host.setAttribute('data-page-clicks', '0');
    document.addEventListener('keydown', () => host.setAttribute('data-page-keys', String(Number(host.getAttribute('data-page-keys')) + 1)));
    document.addEventListener('click', () => host.setAttribute('data-page-clicks', String(Number(host.getAttribute('data-page-clicks')) + 1)));
  });
  await page.getByRole('tab', { name: 'Design', exact: true }).press('ArrowRight');
  await expect(page.locator('.site-brand')).toHaveAttribute('data-page-keys', '0');
  await page.getByRole('tab', { name: 'Design', exact: true }).click();
  await expect(page.locator('.site-brand')).toHaveAttribute('data-page-clicks', '0');
  await page.locator('.site-brand').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.site-brand')).toHaveAttribute('data-page-keys', '1');
  await expect(inspector(page)).toBeVisible();
});

test('font picker stays clamped at an edge and interactions support reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 320, height: 450 });
  const font = page.getByRole('button', { name: 'Font family', exact: true });
  await font.scrollIntoViewIfNeeded();
  await font.click();
  const popup = page.getByRole('dialog', { name: 'Font family', exact: true });
  const bounds = (await popup.boundingBox())!;
  expect(bounds.x).toBeGreaterThanOrEqual(8);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(312);
  expect(bounds.y).toBeGreaterThanOrEqual(8);
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(442);
  await expect(page.getByRole('button', { name: 'Inter, -apple-system, sans-serif', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');
  await expect(font).toBeFocused();
  expect(await font.evaluate(el => getComputedStyle(el).transitionDuration)).toBe('0s');
});
