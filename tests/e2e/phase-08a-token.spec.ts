import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { setup, fixture, pick, dock } from './extensionHarness';

const tokenFixture = fixture.replace('</style>', '.primary{background-image:radial-gradient(ellipse at center,red,blue);background-position:10% 20%;background-size:40% 50%;background-repeat:no-repeat}@media(min-width:1000px){.primary{letter-spacing:0}} </style>');
const field = (page: Page, label: string) => page.getByRole('textbox', { name: label, exact: true });

async function launch(info: TestInfo) {
  const runtime = await setup(info, tokenFixture);
  await pick(runtime.page, '#checkout');
  const cdp = await runtime.context.newCDPSession(runtime.page);
  const worlds: { id: number; origin: string }[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context }) => worlds.push(context));
  await cdp.send('Runtime.enable');
  const world = worlds.find(item => item.origin.startsWith('chrome-extension://'))!;
  const read = async <T = any>(expression: string): Promise<T> => {
    const result = await cdp.send('Runtime.evaluate', { contextId: world.id, expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  await read(`globalThis.__tokenPicker=(()=>{const n=document.querySelector('cssforge-ui').shadowRoot.querySelector('[data-cssforge]');let f=n[Object.getOwnPropertyNames(n).find(k=>k.startsWith('__reactFiber$'))];for(let d=0;f&&d<32;d++,f=f.return){if(f.memoizedProps?.picker)return f.memoizedProps.picker;if(f.memoizedProps?.value?.picker)return f.memoizedProps.value.picker;}throw Error('Built picker missing');})();true`);
  const history = () => read<number>('__tokenPicker.editor.getSnapshot().undoCount');
  return { ...runtime, read, history };
}

async function associatedError(input: ReturnType<typeof field>) {
  await expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(await input.evaluate(node => {
    const id = node.getAttribute('aria-describedby');
    const error = id ? (node.getRootNode() as ShadowRoot).querySelector(`[id="${CSS.escape(id)}"]`) : null;
    return error?.textContent?.trim() ?? '';
  })).not.toBe('');
}

test('D02 valid token previews form one Enter-committed gesture and Undo restores the baseline', async ({}, info) => {
  const r = await launch(info);
  try {
    const input = field(r.page, 'Background size'), target = r.page.locator('#checkout');
    const before = await r.history();
    await input.fill('50%');
    await input.fill('60% 70%');
    await expect(target).toHaveCSS('background-size', '60% 70%');
    await input.press('Enter');
    await expect(input).not.toBeFocused();
    expect(await r.history()).toBe(before + 1);
    await r.read('__tokenPicker.editor.undo();true');
    await expect(target).toHaveCSS('background-size', '40% 50%');
    await expect(input).toHaveValue('40% 50%');
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('D02 rejected tokens preserve page state and retain a field-associated accessible error on blur', async ({}, info) => {
  const r = await launch(info);
  try {
    const input = field(r.page, 'Background size'), target = r.page.locator('#checkout');
    const before = await r.history();
    await input.fill('not-a-size');
    await expect(target).toHaveCSS('background-size', '40% 50%');
    expect(await r.history()).toBe(before);
    await associatedError(input);
    await input.press('Enter');
    await expect(input).toHaveValue('not-a-size');
    await associatedError(input);
    await input.fill('calc(100% - 2px) auto');
    await input.press('Enter');
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await expect(input).toHaveValue('calc(100% - 2px) auto');
    expect(await r.history()).toBe(before + 1);
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('D02 Tab preserves rejected drafts and ends accepted gestures before the next focus', async ({}, info) => {
  const r = await launch(info);
  try {
    const input = field(r.page, 'Background size'), target = r.page.locator('#checkout');
    const before = await r.history();
    await input.fill('not-a-size');
    await input.press('Tab');
    await expect(input).not.toBeFocused();
    await expect(input).toHaveValue('not-a-size');
    await associatedError(input);
    await expect(target).toHaveCSS('background-size', '40% 50%');
    expect(await r.history()).toBe(before);
    await input.fill('50%');
    await input.fill('60% 70%');
    await input.press('Tab');
    await expect(input).not.toBeFocused();
    await expect(input).toHaveValue('60% 70%');
    await expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await expect(target).toHaveCSS('background-size', '60% 70%');
    expect(await r.history()).toBe(before + 1);
    await input.fill('80% 90%');
    await input.press('Tab');
    expect(await r.history()).toBe(before + 2);
    await r.read('__tokenPicker.editor.undo();true');
    await expect(target).toHaveCSS('background-size', '60% 70%');
    await r.read('__tokenPicker.editor.undo();true');
    await expect(target).toHaveCSS('background-size', '40% 50%');
    expect(await r.history()).toBe(before);
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('D02 Escape restores the focus baseline for position and custom font tokens', async ({}, info) => {
  const r = await launch(info);
  try {
    const target = r.page.locator('#checkout'), position = field(r.page, 'Background position');
    const before = await r.history();
    await position.fill('calc(50% - 2px) 10px');
    await expect(target).toHaveCSS('background-position', 'calc(50% - 2px) 10px');
    await position.fill('25% 30%');
    await position.press('Escape');
    await expect(target).toHaveCSS('background-position', '10% 20%');
    await expect(position).toHaveValue('10% 20%');
    expect(await r.history()).toBe(before);
    await r.page.getByRole('button', { name: 'Font family', exact: true }).click();
    const font = field(r.page, 'Custom font family'), original = await font.inputValue();
    await font.fill('"Audit Font", serif');
    await expect(target).toHaveCSS('font-family', '"Audit Font", serif');
    await font.fill('Arial; display:none');
    await associatedError(font);
    await expect(target).toHaveCSS('font-family', '"Audit Font", serif');
    await font.press('Escape');
    await expect(font).toHaveValue(original);
    expect(await r.history()).toBe(before);
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('D02 radial and image URL tokens share rejection, grouping and Escape without weakening HTTP(S) safety', async ({}, info) => {
  const r = await launch(info);
  try {
    const shape = field(r.page, 'Gradient shape / position'), target = r.page.locator('#checkout');
    const original = await target.evaluate(node => getComputedStyle(node).backgroundImage);
    const before = await r.history();
    await shape.fill('circle at calc(50% - 2px) 20%');
    await shape.press('Enter');
    await expect(target).toHaveCSS('background-image', /circle at calc\(50% - 2px\) 20%/);
    expect(await r.history()).toBe(before + 1);
    await r.read('__tokenPicker.editor.undo();true');
    await expect(target).toHaveCSS('background-image', original);
    await r.page.getByRole('button', { name: 'Background layer type', exact: true }).click();
    await r.page.getByRole('dialog', { name: 'Background layer type', exact: true }).getByRole('button', { name: 'Image URL', exact: true }).click();
    const url = field(r.page, 'Image URL');
    await url.fill('javascript:alert(1)');
    await associatedError(url);
    await expect(target).toHaveCSS('background-image', original);
    await r.page.route('**/token-image.svg', route => route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="4" height="4"/>' }));
    await url.fill('http://127.0.0.1:5173/token-image.svg');
    await expect(target).toHaveCSS('background-image', /token-image.svg/);
    await url.press('Escape');
    await expect(target).toHaveCSS('background-image', original);
    expect(await r.history()).toBe(before);
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});

test('D02 target, context and reconciled binding changes retire a pending token draft', async ({}, info) => {
  const r = await launch(info);
  try {
    const size = field(r.page, 'Background size');
    await size.fill('60% 70%');
    await size.fill('not-a-size');
    const before = await r.history();
    await r.read(`__tokenPicker.editor.setContext({media:[],pseudo:':hover'});true`);
    await expect(size).toHaveValue('60% 70%');
    await expect(size).not.toHaveAttribute('aria-invalid', 'true');
    await size.press('Enter');
    expect(await r.history()).toBe(before);
    await r.read(`__tokenPicker.editor.setContext({media:[],pseudo:''});true`);
    await size.fill('not-a-size');
    await r.page.locator('#checkout').evaluate(node => { node.outerHTML = '<button id="checkout" class="primary">Replacement</button>'; });
    await expect.poll(() => r.read('__tokenPicker.reconciliation().state')).toBe('migrated');
    await expect(size).toHaveValue('60% 70%');
    await expect(size).not.toHaveAttribute('aria-invalid', 'true');
    await size.press('Escape');
    await expect(r.page.locator('#checkout')).toHaveCSS('background-size', '60% 70%');
    expect(await r.history()).toBe(before);
    await size.fill('not-a-size');
    await dock(r.page).getByRole('button', { name: 'Pick page element', exact: true }).click();
    await r.page.locator('#headline').click();
    await expect(r.page.getByTestId('selected-identity')).toHaveText('h2#headline');
    expect(await r.history()).toBe(before);
    expect(await r.read('__tokenPicker.editor.getSnapshot().overrides.length')).toBe(0);
    expect(r.errors).toEqual([]);
  } finally { await r.context.close(); }
});
