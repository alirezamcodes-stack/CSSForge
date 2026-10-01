import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { aligned, outline } from './extensionHarness';

// Retained pairs show one-level RGB raster noise: 27 edge pixels in P2, and
// 391 pixels inside the spectrum after palette polish (0.507% of the crop).
// Only gradient surfaces receive the 1% budget. Other opaque UI keeps the
// original 0.1% budget; dimensions/alpha and the one-level ceiling stay exact.
export const feedbackRasterBounds = { maximumChannelDifference: 1, maximumChangedPixelRatio: .01, maximumOutsideGradientPixelRatio: .001 } as const;

export async function feedbackPaintComparison(page: Page, control: Locator, info: TestInfo, name: string) {
  await control.scrollIntoViewIfNeeded();
  await page.mouse.move(0, 0);
  await page.evaluate(() => document.fonts.ready);
  const settle = async () => {
    // Wait for finite hover/selection transitions before either observation.
    // Two frames alone do not finish the UI's existing 120ms state transitions.
    await control.evaluate(async element => {
      const animations = element.getAnimations({ subtree: true }).filter(animation => animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity);
      await Promise.all(animations.map(animation => animation.finished.catch(() => {})));
    });
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
  };
  await settle();
  const box = (await control.boundingBox())!;
  await page.locator('#checkout').evaluate((node, box) => Object.assign((node as HTMLElement).style, {
    position: 'fixed', left: `${box.x + 2}px`, top: `${box.y + Math.min(box.height / 2, 30)}px`,
    width: `${Math.max(20, box.width - 8)}px`, height: '40px', margin: '0',
  }), box);
  await aligned(page, '#checkout');
  await expect(outline(page)).toBeVisible();
  expect(await page.locator('cssforge-overlay').evaluate(node => getComputedStyle(node).pointerEvents)).toBe('none');
  await settle();
  // Rounded corners intentionally expose the page. Only the opaque interior
  // must completely cover an overlapping selection outline and label.
  const inset = Math.min(16, Math.min(box.width, box.height) / 4);
  const clip = { x: box.x + inset, y: box.y + inset, width: box.width - inset * 2, height: box.height - inset * 2 };
  const gradients = await control.locator('.react-colorful__saturation, .react-colorful__hue, .react-colorful__alpha').evaluateAll((nodes, clip) => nodes.map(node => {
    const r = node.getBoundingClientRect();
    return { left: r.left - clip.x, top: r.top - clip.y, right: r.right - clip.x, bottom: r.bottom - clip.y };
  }), clip);
  const before = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
  // Keep the feedback layer visible; hiding it can change Chrome compositing.
  const original = await page.locator('cssforge-overlay').evaluate(node => ['.outline', '.label'].map(selector => {
    const part = node.shadowRoot!.querySelector<HTMLElement>(selector)!;
    const properties = ['background-color', 'outline-color'].map(property => ({
      property, value: part.style.getPropertyValue(property), priority: part.style.getPropertyPriority(property),
    }));
    for (const { property } of properties) part.style.setProperty(property, '#ff0000', 'important');
    return { selector, properties };
  }));
  try {
    await settle();
    const after = await page.screenshot({ clip, animations: 'disabled', caret: 'hide' });
    const difference = await page.evaluate(async ({ buffers, gradients }) => {
      const decode = async (buffer: string) => {
        const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${buffer}`)).blob());
        const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext('2d')!;
        context.drawImage(bitmap, 0, 0); bitmap.close();
        return { width: canvas.width, height: canvas.height, data: context.getImageData(0, 0, canvas.width, canvas.height).data };
      };
      const [a, b] = await Promise.all(buffers.map(decode));
      let maximum = 0, maximumAlpha = 0, changed = 0, changedOutsideGradients = 0;
      let left = a.width, top = a.height, right = -1, bottom = -1;
      for (let pixel = 0; pixel < Math.min(a.data.length, b.data.length); pixel += 4) {
        let different = false;
        for (let channel = 0; channel < 4; channel++) {
          const delta = Math.abs(a.data[pixel + channel] - b.data[pixel + channel]);
          maximum = Math.max(maximum, delta); if (channel === 3) maximumAlpha = Math.max(maximumAlpha, delta);
          different ||= delta > 0;
        }
        if (different) {
          changed++;
          const x = pixel / 4 % a.width, y = Math.floor(pixel / 4 / a.width);
          if (!gradients.some(r => x >= r.left && x < r.right && y >= r.top && y < r.bottom)) changedOutsideGradients++;
          left = Math.min(left, x); top = Math.min(top, y); right = Math.max(right, x); bottom = Math.max(bottom, y);
        }
      }
      return {
        sameSize: a.width === b.width && a.height === b.height, width: a.width, height: a.height,
        pixels: a.width * a.height, changed, maximum, maximumAlpha,
        changedPixelRatio: changed / (a.width * a.height),
        changedOutsideGradients, outsideGradientPixelRatio: changedOutsideGradients / (a.width * a.height),
        changedBounds: changed ? { left, top, right, bottom } : null,
      };
    }, { buffers: [before.toString('base64'), after.toString('base64')], gradients });
    const passes = difference.sameSize && difference.maximumAlpha === 0
      && difference.maximum <= feedbackRasterBounds.maximumChannelDifference
      && difference.changedPixelRatio <= feedbackRasterBounds.maximumChangedPixelRatio
      && difference.outsideGradientPixelRatio <= feedbackRasterBounds.maximumOutsideGradientPixelRatio;
    if (!passes) {
      const prefix = info.outputPath(`feedback-${name.replace(/[^a-z0-9-]/gi, '-')}`);
      await mkdir(dirname(prefix), { recursive: true });
      await writeFile(`${prefix}-before.png`, before); await writeFile(`${prefix}-after.png`, after);
      await writeFile(`${prefix}.json`, JSON.stringify({ name, clip, gradients, difference, bounds: feedbackRasterBounds }, null, 2));
      await info.attach(`${name}: original feedback`, { path: `${prefix}-before.png`, contentType: 'image/png' });
      await info.attach(`${name}: red feedback`, { path: `${prefix}-after.png`, contentType: 'image/png' });
      await info.attach(`${name}: pixel diagnostics`, { path: `${prefix}.json`, contentType: 'application/json' });
    }
    expect(difference.sameSize, `${name}: screenshot dimensions must match`).toBe(true);
    expect(difference.maximumAlpha, `${name}: screenshot alpha must match`).toBe(0);
    expect(difference.maximum, `${name}: opaque UI must cover red feedback`).toBeLessThanOrEqual(feedbackRasterBounds.maximumChannelDifference);
    expect(difference.changedPixelRatio, `${name}: gradient raster noise must remain confined to ≤1% of pixels`).toBeLessThanOrEqual(feedbackRasterBounds.maximumChangedPixelRatio);
    expect(difference.outsideGradientPixelRatio, `${name}: other opaque UI keeps the ≤0.1% raster noise budget`).toBeLessThanOrEqual(feedbackRasterBounds.maximumOutsideGradientPixelRatio);
    return { name, ...difference };
  } finally {
    await page.locator('cssforge-overlay').evaluate((node, original) => {
      for (const { selector, properties } of original) {
        const part = node.shadowRoot!.querySelector<HTMLElement>(selector)!;
        for (const { property, value, priority } of properties) {
          if (value) part.style.setProperty(property, value, priority); else part.style.removeProperty(property);
        }
      }
    }, original);
  }
}
