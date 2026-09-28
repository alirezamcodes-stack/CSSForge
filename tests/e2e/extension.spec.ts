import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { browser } from 'wxt/browser';
import { setup, pick, aligned, withinViewport, inspector, dock, identity, outline } from './extensionHarness';
declare const chrome: typeof browser;
test('built Chrome picker selects real data, navigates, tracks geometry and captures five Phase 03 views', async ({}, info) => {
  const { context, page, errors } = await setup(info);
  try {
    await mkdir('artifacts/screenshots/phase-03', { recursive: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
    await expect(inspector(page)).toHaveCSS('width', '350px');
    await expect(page.getByRole('tab', { name: 'Design', exact: true })).toHaveCSS('font-size', '13px');
    await page.locator('#checkout').hover();
    await expect(outline(page)).toHaveAttribute('data-mode', 'hover');
    await expect(page.getByTestId('target-label')).toContainText('button#checkout.primary');
    await aligned(page, '#checkout');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/01-hover.png' });
    await page.locator('#checkout').click();
    await expect(identity(page)).toHaveText('button#checkout.primary');
    await expect(page.getByTestId('selected-font')).toHaveText('Arial 18px');
    const rect = (await page.locator('#checkout').boundingBox())!;
    await expect(page.getByTestId('selected-dimensions')).toHaveText(`${Number(rect.width.toFixed(2))} × ${Number(rect.height.toFixed(2))}`);
    expect(await page.evaluate(() => (window as any).hostEvents)).toEqual({ click: 0, pointerdown: 0, mousedown: 0, submit: 0 });
    await page.mouse.move(800, 100); await aligned(page, '#checkout');
    await expect(outline(page)).toHaveAttribute('data-mode', 'selected');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/02-selected-inspector.png' });
    await page.getByRole('button', { name: 'Select parent', exact: true }).click();
    await expect(identity(page)).toHaveText('section#collection.card');
    await expect(page.getByTestId('selected-font')).toHaveText('Georgia 21px');
    await aligned(page, '#collection');
    await page.getByRole('button', { name: 'Select child', exact: true }).click();
    await expect(identity(page)).toHaveText('h2#headline');
    await expect(page.getByTestId('selected-font')).toHaveText('Georgia 28px');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/03-parent-child.png' });
    await page.evaluate(() => scrollTo(0, 190));
    await aligned(page, '#headline');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/04-after-scroll.png' });
    await page.setViewportSize({ width: 1000, height: 800 }); await aligned(page, '#headline');
    const handle = page.getByRole('group', { name: 'Move inspector' });
    const box = (await handle.boundingBox())!;
    await page.mouse.move(box.x + 60, box.y + 18); await page.mouse.down();
    await page.mouse.move(700, 55, { steps: 8 }); await page.mouse.up();
    await aligned(page, '#headline');
    await handle.focus(); await page.keyboard.press('Home');
    await page.setViewportSize({ width: 375, height: 667 });
    await withinViewport(page); await aligned(page, '#headline');
    // Hide the panel to reach a target on a narrow page, then selection restores it.
    await dock(page).getByRole('button', { name: 'Hide inspector panel' }).click();
    await pick(page, '#checkout'); await expect(inspector(page)).toBeVisible();
    await withinViewport(page); await aligned(page, '#checkout');
    await page.screenshot({ path: 'artifacts/screenshots/phase-03/05-narrow.png' });
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('picker excludes all owned UI, respects Escape layers and releases host clicks', async ({}, info) => {
  const { context, page, errors } = await setup(info);
  try {
    await pick(page, '#checkout');
    await dock(page).getByRole('button', { name: 'Pick page element' }).click();
    await page.locator('#headline').hover();
    await page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
    await expect(identity(page)).toHaveText('button#checkout.primary');
    await expect(outline(page)).toHaveAttribute('data-mode', 'selected');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Inspector menu' })).toBeHidden();
    await expect(dock(page).getByRole('button', { name: 'Cancel element picking' })).toBeVisible();
    await dock(page).getByRole('button', { name: 'Open Navigator', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Navigator', exact: true })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dock(page).getByRole('button', { name: 'Cancel element picking' })).toBeVisible();
    await dock(page).getByRole('button', { name: 'Open Changes', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Changes', exact: true })).not.toContainText('Fixture');
    await page.keyboard.press('Escape');
    await page.locator('#headline').hover();
    await page.keyboard.press('Escape');
    await expect(dock(page).getByRole('button', { name: 'Pick page element' })).toBeVisible();
    await expect(identity(page)).toHaveText('button#checkout.primary'); await aligned(page, '#checkout');
    await page.locator('#checkout').click();
    expect(await page.evaluate(() => (window as any).hostEvents)).toEqual({ click: 1, pointerdown: 1, mousedown: 1, submit: 0 });
    await pick(page, '#host-link'); expect(page.url()).not.toContain('#below');
    await pick(page, '#host-check'); await expect(page.locator('#host-check')).not.toBeChecked();
    await page.locator('#host-check').click(); await expect(page.locator('#host-check')).toBeChecked();
    await pick(page, '#submit'); expect(await page.evaluate(() => (window as any).hostEvents.submit)).toBe(0);
    await page.locator('#submit').click(); expect(await page.evaluate(() => (window as any).hostEvents.submit)).toBe(1);
    await pick(page, '#shadow-child'); await expect(identity(page)).toHaveText('button#shadow-child');
    await page.getByRole('button', { name: 'Select parent', exact: true }).click(); await expect(identity(page)).toHaveText('div#open-host');
    await page.getByRole('button', { name: 'Select child', exact: true }).click(); await expect(identity(page)).toHaveText('button#shadow-child');
    await pick(page, '#inside');
    await page.locator('.scrollbox').evaluate(el => { el.scrollTop = 65; }); await aligned(page, '#inside');
    await page.locator('#inside').evaluate(el => { (el as HTMLElement).style.width = '150px'; });
    await expect(page.getByTestId('selected-dimensions')).toHaveText('150 × 80'); await aligned(page, '#inside');
    // Detached targets are cleared on the next geometry event, never inspected again.
    await page.locator('#inside').evaluate(el => el.remove()); await page.evaluate(() => dispatchEvent(new Event('resize')));
    await expect(identity(page)).toHaveText('No element selected'); await expect(outline(page)).toBeHidden();
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});

test('actual action toggles cleanly, preserves host page, and supports real 200% Chrome zoom', async ({}, info) => {
  const { context, page, worker, action, tabId, errors } = await setup(info);
  try {
    const hostBefore = await page.locator('main').evaluate(el => el.outerHTML);
    const debuggerSession = await context.newCDPSession(page);
    const worlds: { id: number; name: string; origin: string }[] = [];
    debuggerSession.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context));
    await debuggerSession.send('Runtime.enable');
    const extensionWorld = worlds.find(world => world.origin.startsWith('chrome-extension://'));
    expect(extensionWorld, JSON.stringify(worlds)).toBeTruthy();
    // Inspect actual registered DOM listeners, including extension isolated worlds.
    const listenerCounts = async () => {
      const counts: Record<string, number> = {};
      for (const expression of ['window', 'document']) {
        const { result } = await debuggerSession.send('Runtime.evaluate', { expression, contextId: extensionWorld!.id });
        const { listeners } = await debuggerSession.send('DOMDebugger.getEventListeners', { objectId: result.objectId! });
        for (const listener of listeners) {
          if (!['pointermove', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'scroll', 'resize', 'blur', 'pointerleave', 'keydown'].includes(listener.type)) continue;
          const key = `${expression}:${listener.type}:${listener.useCapture}`;
          counts[key] = (counts[key] ?? 0) + 1;
        }
        await debuggerSession.send('Runtime.releaseObject', { objectId: result.objectId! });
      }
      return counts;
    };
    const initialListeners = await listenerCounts();
    expect(initialListeners['window:pointermove:true']).toBe(1);
    for (let i = 0; i < 3; i++) {
      await pick(page, '#checkout'); await action();
      await expect(page.locator('cssforge-ui')).toHaveCount(0); await expect(page.locator('cssforge-overlay')).toHaveCount(0);
      expect(await listenerCounts()).toEqual({});
      await page.locator('#checkout').click();
      await action(); await expect(inspector(page)).toBeVisible();
      await expect(page.locator('cssforge-ui')).toHaveCount(1); await expect(page.locator('cssforge-overlay')).toHaveCount(1);
      expect(await listenerCounts()).toEqual(initialListeners);
    }
    expect(await page.evaluate(() => (window as any).hostEvents.click)).toBe(3);
    expect(await page.locator('main').evaluate(el => el.outerHTML)).toBe(hostBefore);
    await worker.evaluate(id => chrome.tabs.setZoom(id, 2), tabId);
    await expect.poll(() => worker.evaluate(id => chrome.tabs.getZoom(id), tabId)).toBe(2);
    await withinViewport(page);
    await dock(page).getByRole('button', { name: 'Hide inspector panel' }).click();
    await pick(page, '#checkout'); await expect(page.getByTestId('selected-font')).toHaveText('Arial 18px');
    await aligned(page, '#checkout'); await withinViewport(page);
    await page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Inspector menu' })).toBeInViewport();
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: 'Inspector menu', exact: true }).focus();
    await dock(page).getByRole('button', { name: 'Deactivate CSSForge' }).click();
    await expect(page.locator('cssforge-ui')).toHaveCount(0); await expect(page.locator('cssforge-overlay')).toHaveCount(0);
    await page.locator('#checkout').click();
    expect(await page.evaluate(() => (window as any).hostEvents.click)).toBe(4);
    // Same tab on a browser internal page: action reports the restriction, without injection.
    await page.goto('chrome://version'); await action();
    await expect.poll(() => worker.evaluate(id => chrome.action.getTitle({ tabId: id }), tabId)).toContain('unavailable');
    expect(await worker.evaluate(id => chrome.action.getBadgeText({ tabId: id }), tabId)).toBe('!');
    await page.goto('/extension-fixture.html'); await action(); await expect(inspector(page)).toBeVisible();
    expect(await worker.evaluate(id => chrome.action.getBadgeText({ tabId: id }), tabId)).toBe('');
    expect(errors).toEqual([]);
  } finally { await context.close(); }
});
