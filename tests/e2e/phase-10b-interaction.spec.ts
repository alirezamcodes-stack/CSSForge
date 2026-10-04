import { test, expect, type Page } from '@playwright/test';
import { launch, html } from './mutationHarness';
import { pick, inspector } from './extensionHarness';

const popup = (page: Page) => page.getByRole('dialog', { name: 'Text color picker', exact: true });
const scene = '<section id="scene"><span id="before">Before</span><button id="target">Target</button><span id="after">After</span></section>';
const refusal = 'The parent or exact insertion anchors changed.';

for (const name of ['Color', 'Hue', 'Alpha'] as const) {
  test(`10B.3 F04 ${name} slider retains repeated adjustment keys and characterizes Home/End`, async ({}, info) => {
    const r = await launch(info, html('#target{color:#33669980}'));
    try {
      await pick(r.page, '#target');
      await r.page.getByRole('button', { name: 'Text color picker', exact: true }).click();
      const slider = popup(r.page).getByRole('slider', { name, exact: true });
      const value = () => slider.getAttribute(name === 'Color' ? 'aria-valuetext' : 'aria-valuenow');
      await slider.focus();
      for (const key of ['ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight', 'ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp', 'Home', 'Home', 'End', 'End']) {
        const before = await value(), css = await r.page.locator('#target').evaluate(node => getComputedStyle(node).color);
        await r.page.keyboard.press(key);
        // react-colorful consumes all arrows, but Hue/Alpha only adjust horizontally.
        // Home/End have no slider handler; they must not become popup button navigation.
        const changes = key.startsWith('Arrow') && (name === 'Color' || key === 'ArrowLeft' || key === 'ArrowRight');
        if (changes) {
          expect(await value(), `${name} ${key} value`).not.toBe(before);
          expect(await r.page.locator('#target').evaluate(node => getComputedStyle(node).color)).not.toBe(css);
        } else expect(await value(), `${name} ${key} unchanged`).toBe(before);
        await expect(slider, `${name} ${key} focus`).toBeFocused();
      }
      expect((await r.status()).undo).toBe(1);
      expect(r.errors).toEqual([]);
    } finally { await r.context.close(); }
  });
}

test('10B.3 F04 popup buttons, text caret, Tab/ShiftTab, pointer, formats, recent colors and Escape remain owned', async ({}, info) => {
  const r = await launch(info, html('#target{color:#33669980}'));
  try {
    await pick(r.page, '#target');
    const trigger = r.page.getByRole('button', { name: 'Text color picker', exact: true });
    await trigger.press('ArrowDown');
    const p = popup(r.page), hex = p.getByRole('button', { name: 'HEX', exact: true }), rgb = p.getByRole('button', { name: 'RGB', exact: true });
    await hex.focus(); await r.page.keyboard.press('ArrowDown'); await expect(rgb).toBeFocused();
    await r.page.keyboard.press('ArrowUp'); await expect(hex).toBeFocused();
    await r.page.keyboard.press('Home');
    await expect(p.getByRole('button').first()).toBeFocused();
    await r.page.keyboard.press('End'); await expect(p.getByRole('button').last()).toBeFocused();
    await hex.focus(); await r.page.keyboard.press('Tab'); await expect(rgb).toBeFocused();
    await r.page.keyboard.press('Shift+Tab'); await expect(hex).toBeFocused();
    const input = p.getByRole('textbox', { name: 'Text color HEX', exact: true });
    await input.focus(); await r.page.keyboard.press('Home'); await expect(input).toBeFocused();
    expect(await input.evaluate(node => (node as HTMLInputElement).selectionStart)).toBe(0);
    await r.page.keyboard.press('End'); await expect(input).toBeFocused();
    expect(await input.evaluate(node => (node as HTMLInputElement).selectionStart)).toBe((await input.inputValue()).length);
    const before = await input.inputValue(), box = (await p.getByRole('slider', { name: 'Color', exact: true }).boundingBox())!;
    await r.page.mouse.click(box.x + box.width * .25, box.y + box.height * .25);
    expect(await input.inputValue()).not.toBe(before);
    for (const format of ['RGB', 'HSL', 'HEX']) {
      await p.getByRole('button', { name: format, exact: true }).click();
      await expect(p.getByRole('textbox', { name: `Text color ${format}`, exact: true })).toBeVisible();
    }
    await p.getByRole('slider', { name: 'Alpha', exact: true }).press('ArrowLeft');
    await expect(p.getByRole('button', { name: /^Use #/ }).first()).toBeVisible();
    await r.page.keyboard.press('Escape'); await expect(p).toHaveCount(0); await expect(trigger).toBeFocused();
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('10B.3 F04 native sampling Escape cancels first, then popup Escape returns focus', async ({}, info) => {
  const r = await launch(info);
  try {
    await pick(r.page, '#target');
    // Substitute only the OS sampling boundary; the built UI and session remain real.
    await r.read(`globalThis.__sample=null;Object.defineProperty(globalThis,'EyeDropper',{configurable:true,value:class{open({signal}){globalThis.__sample=signal;return new Promise(()=>{});}}});true`);
    const trigger = r.page.getByRole('button', { name: 'Text color picker', exact: true });
    await trigger.click();
    const sample = popup(r.page).getByRole('button', { name: 'Sample text color from screen', exact: true });
    await sample.click(); await expect(sample).toHaveAttribute('aria-busy', 'true');
    await r.page.keyboard.press('Escape');
    expect(await r.read('__sample.aborted')).toBe(true);
    await expect(popup(r.page)).toBeVisible(); await expect(sample).toBeFocused();
    expect((await r.status()).undo).toBe(0);
    await r.page.keyboard.press('Escape'); await expect(popup(r.page)).toHaveCount(0); await expect(trigger).toBeFocused();
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

for (const tab of ['HTML', 'Design', 'Code'] as const) {
  test(`10B.3 F05 ${tab} retains exact-gap refusal after menu closure and a fresh Move succeeds`, async ({}, info) => {
    const r = await launch(info, html(undefined, scene));
    try {
      await pick(r.page, '#target');
      // One ordinary edit makes existing Design/Code session controls visible.
      const width = r.page.getByRole('textbox', { name: 'Width', exact: true });
      await width.fill('200px'); await width.press('Enter');
      await r.page.getByRole('tab', { name: tab, exact: true }).click();
      const before = (await r.status()).undo;
      await r.page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
      const move = r.page.getByRole('button', { name: 'Move down', exact: true });
      await expect(move).toBeEnabled();
      // Host changes precisely the prepared destination gap, after public menu preparation.
      await r.page.locator('#after').evaluate(node => { const host = document.createElement('i'); host.id = 'host'; host.textContent = 'Host'; node.after(host); });
      const order = () => r.page.locator('#scene').evaluate(node => Array.from(node.children).map(child => child.id));
      expect(await order()).toEqual(['before', 'target', 'after', 'host']);
      await move.click();
      await expect(r.page.getByRole('dialog', { name: 'Inspector menu', exact: true })).toHaveCount(0);
      expect(await order()).toEqual(['before', 'target', 'after', 'host']);
      expect((await r.status()).undo).toBe(before);
      expect(await r.read('__p.editor.structureMutation.getStats().writes')).toBe(0);
      expect(await r.read('__p.editor.getSnapshot().changes.flatMap(g=>g.structures??[]).length')).toBe(0);
      expect((await r.status()).error).toBe(refusal);
      const alert = inspector(r.page).getByRole('alert');
      await expect(alert).toHaveCount(1); await expect(alert).toHaveText(refusal); await expect(alert).toBeVisible();
      await r.page.getByRole('button', { name: 'Inspector menu', exact: true }).focus();
      await expect(alert).toBeVisible();
      await r.page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
      if (tab === 'HTML') await expect(inspector(r.page).getByRole('alert')).toHaveCount(1);
      await r.page.getByRole('button', { name: 'Move down', exact: true }).click();
      expect(await order()).toEqual(['before', 'after', 'target', 'host']);
      expect((await r.status()).undo).toBe(before + 1);
      expect(await r.read('__p.editor.structureMutation.getStats().writes')).toBe(1);
      await expect(alert).toHaveCount(0); expect((await r.status()).error).toBeNull();
      await r.page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
      await r.page.getByRole('dialog', { name: 'Inspector menu', exact: true }).getByRole('button', { name: 'Undo last edit', exact: true }).click();
      expect(await order()).toEqual(['before', 'target', 'after', 'host']);
      expect((await r.status()).undo).toBe(before); expect(r.errors).toEqual([]);
    } finally { await r.context.close(); }
  });
}
