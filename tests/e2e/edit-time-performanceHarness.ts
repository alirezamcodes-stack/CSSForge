import { chromium, expect, type CDPSession, type Page, type TestInfo } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { performance as nodePerformance } from 'node:perf_hooks';
import type { browser } from 'wxt/browser';
import { parse, formatRgb } from 'culori';
import { dock, inspector } from './extensionHarness';

declare const chrome: typeof browser;
export type Profile = 'simple' | 'heavy';
export type Workload = { id: string; label: string; section?: string; target: '#layout-target' | '#effects-target'; property: string; kind?: 'filter' | 'color' };
export const workloads: Workload[] = [
  { id: 'width', label: 'Width', target: '#layout-target', property: 'width' },
  { id: 'padding', label: 'Padding top', section: 'Spacing', target: '#layout-target', property: 'padding-top' },
  { id: 'margin', label: 'Margin left', section: 'Spacing', target: '#layout-target', property: 'margin-left' },
  { id: 'font-size', label: 'Font size', section: 'Typography', target: '#layout-target', property: 'font-size' },
  { id: 'line-height', label: 'Line height', section: 'Typography', target: '#layout-target', property: 'line-height' },
  { id: 'radius', label: 'Geometry radius', target: '#layout-target', property: 'border-radius' },
  { id: 'box-shadow', label: 'Box shadow blur', section: 'Box shadow', target: '#effects-target', property: 'box-shadow' },
  { id: 'text-shadow', label: 'Text shadow blur', section: 'Text shadow', target: '#effects-target', property: 'text-shadow' },
  { id: 'filter', label: 'Blur', section: 'Filters', target: '#effects-target', property: 'filter', kind: 'filter' },
  { id: 'color', label: 'Text color', section: 'Typography', target: '#effects-target', property: 'color', kind: 'color' },
  { id: 'gradient', label: 'Gradient direction', section: 'Background', target: '#effects-target', property: 'background-image' },
];

export const durationMs = 4000;
export const emittedMoves = 240;
export const settlingMs = 500;
type CapturedInput = { type: string; time: number; stamp: number; queueDelay: number; trusted: boolean; label: string | null; x?: number; buttons?: number; pointerId?: number; connected?: boolean; sameControl?: boolean; focused?: string | null };
type Write = { time: number; latestInput: number | null; firstRaf?: number; secondRaf?: number; layers: number };
type Monitor = { start: number; stop: number; inputs: CapturedInput[]; writes: Write[]; frames: number[]; heartbeats: number[]; longTasks: { start: number; duration: number }[]; eventTimings: { name: string; duration: number; processingStart: number; start: number }[]; events?: Record<string, number> };
type DriverEvent = { index: number; planned: number; issued: number; acknowledged?: number; x: number; y: number };
type DriverData = { duration: number; plannedMoves: number; events: DriverEvent[]; totalWallMs: number; acknowledgementTimeout?: boolean; acknowledgementPhase?: string };

async function bounded<T>(promise: Promise<T>, milliseconds: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error(`TEST DIAGNOSTICS TIMEOUT: ${label}`)), milliseconds); })]); }
  finally { clearTimeout(timer); }
}

// These detect a severe stall, after the pre-fix matrix established maxima of
// 66.7ms frame, 32ms input queue, 359.2ms timer gap and 49.5ms settling. They are
// test-only diagnostic limits, not claimed passing frame/latency ceilings.
export function classifyWatchdog(data: { heartbeats: number[]; longTasks: { duration: number }[]; inputs: { type: string; time: number; queueDelay: number }[] } | undefined, acknowledgementTimeout = false) {
  const moves = data?.inputs.filter(item => item.type === 'pointermove') ?? [];
  const heartbeatGapMs = Math.max(0, ...(data?.heartbeats ?? []));
  const longTaskMs = Math.max(0, ...(data?.longTasks.map(item => item.duration) ?? []));
  const inputQueueMs = Math.max(0, ...moves.map(item => item.queueDelay));
  const inputDeliveryGapMs = Math.max(0, ...moves.slice(1).map((item, index) => item.time - moves[index].time));
  return { confirmedStall: acknowledgementTimeout || heartbeatGapMs > 1000 && (longTaskMs > 1000 || inputQueueMs > 1000 || inputDeliveryGapMs > 1000), acknowledgementTimeout, heartbeatGapMs, longTaskMs, inputQueueMs, inputDeliveryGapMs, thresholdMs: 1000, acknowledgementThresholdMs: 20000, dataAvailable: data !== undefined, note: 'A timer gap alone does not establish a main-thread stall; long-task/input evidence must corroborate it.' };
}

// Passive browser timing only. This never calls an editor API, reads computed
// styles during the gesture, or changes a control's scheduler.
function installMonitor() {
  const runtime = globalThis as typeof globalThis & { __editPerf?: { start: () => void; stop: () => Monitor; read: () => Monitor } };
  let active = false, raf = 0, interval: ReturnType<typeof setInterval> | undefined, initialControl: EventTarget | undefined;
  let lastFrame = 0, lastHeartbeat = 0;
  let data: Monitor = { start: 0, stop: 0, inputs: [], writes: [], frames: [], heartbeats: [], longTasks: [], eventTimings: [] };
  const capture = (event: Event) => {
    if (!active) return;
    const pointer = event as PointerEvent;
    if (event.type === 'pointermove' && pointer.buttons !== 1) return;
    if (!event.composedPath().some(node => node instanceof HTMLElement && node.localName === 'cssforge-ui')) return;
    const target = event.composedPath().find(node => node instanceof HTMLElement && node.hasAttribute('aria-label')) as HTMLElement | undefined;
    const now = performance.now();
    if (event.type === 'pointerdown') initialControl = event.composedPath()[0];
    const ui = document.querySelector('cssforge-ui')?.shadowRoot;
    data.inputs.push({ type: event.type, time: now, stamp: event.timeStamp, queueDelay: Math.max(0, now - event.timeStamp), trusted: event.isTrusted, label: target?.getAttribute('aria-label') ?? null, ...(event.type.includes('pointer') ? { x: pointer.clientX, buttons: pointer.buttons, pointerId: pointer.pointerId, connected: initialControl instanceof Node && initialControl.isConnected, sameControl: event.composedPath()[0] === initialControl, focused: ui?.activeElement?.getAttribute('aria-label') ?? null } : {}) });
  };
  const frame = (time: number) => {
    if (!active) return;
    if (lastFrame) data.frames.push(time - lastFrame);
    lastFrame = time; raf = requestAnimationFrame(frame);
  };
  const mutation = new MutationObserver(records => {
    if (!active) return;
    let layers = 0;
    for (const record of records) for (const node of record.addedNodes) if (node instanceof HTMLStyleElement && node.hasAttribute('data-cssforge-edit-layer')) layers++;
    if (!layers) return;
    const write: Write = { time: performance.now(), latestInput: data.inputs.at(-1)?.time ?? null, layers };
    data.writes.push(write);
    // First RAF is a before-paint opportunity; second RAF is a conservative
    // proxy after at least one paint opportunity, not an OS pixel observation.
    requestAnimationFrame(time => { write.firstRaf = time; requestAnimationFrame(next => { write.secondRaf = next; }); });
  });
  const longTasks = PerformanceObserver.supportedEntryTypes.includes('longtask') ? new PerformanceObserver(list => {
    for (const entry of list.getEntries()) if (active && entry.startTime >= data.start) data.longTasks.push({ start: entry.startTime, duration: entry.duration });
  }) : undefined;
  const eventTimings = PerformanceObserver.supportedEntryTypes.includes('event') ? new PerformanceObserver(list => {
    for (const entry of list.getEntries() as PerformanceEventTiming[]) if (active && entry.startTime >= data.start) data.eventTimings.push({ name: entry.name, duration: entry.duration, processingStart: entry.processingStart, start: entry.startTime });
  }) : undefined;
  const types = ['pointerdown', 'pointermove', 'pointerup', 'gotpointercapture', 'lostpointercapture', 'pointercancel', 'dragstart', 'drop', 'input', 'keydown'];
  runtime.__editPerf = {
    start() {
      if (active) throw Error('Timing window already active');
      data = { start: performance.now(), stop: 0, inputs: [], writes: [], frames: [], heartbeats: [], longTasks: [], eventTimings: [] };
      lastFrame = 0; lastHeartbeat = data.start; initialControl = undefined; active = true;
      for (const type of types) window.addEventListener(type, capture, { capture: true, passive: true });
      mutation.observe(document.head, { childList: true });
      longTasks?.observe({ type: 'longtask', buffered: false });
      eventTimings?.observe({ type: 'event', buffered: false, durationThreshold: 16 } as PerformanceObserverInit);
      raf = requestAnimationFrame(frame);
      interval = setInterval(() => { const now = performance.now(); if (lastHeartbeat) data.heartbeats.push(now - lastHeartbeat); lastHeartbeat = now; }, 25);
    },
    stop() {
      data.stop = performance.now(); active = false;
      cancelAnimationFrame(raf); clearInterval(interval);
      mutation.disconnect(); longTasks?.disconnect(); eventTimings?.disconnect();
      for (const type of types) window.removeEventListener(type, capture, true);
      initialControl = undefined;
      return data;
    },
    read() { return data; },
  };
}

export async function launchEditingPerformance(info: TestInfo, profile: Profile) {
  const build = path.resolve(process.env.CSSFORGE_EDIT_PERF_BUILD ?? '.output/chrome-mv3');
  const fixturePath = process.env.CSSFORGE_EDIT_PERF_FIXTURE ?? `tests/e2e/fixtures/design-performance-${profile}.html`;
  const fixtureHTML = await readFile(fixturePath, 'utf8');
  const manifest = JSON.parse(await readFile(path.join(build, 'manifest.json'), 'utf8'));
  expect(manifest.permissions).toEqual(['activeTab', 'scripting']);
  const context = await chromium.launchPersistentContext(info.outputPath('profile'), { channel: process.env.CSSFORGE_BROWSER_CHANNEL ?? 'chrome', headless: true, viewport: { width: 1440, height: 1100 }, ignoreDefaultArgs: ['--disable-extensions'], args: ['--enable-unsafe-extension-debugging'] });
  const page = await context.newPage(), browserCDP = await context.browser()!.newBrowserCDPSession();
  page.setDefaultTimeout(15000);
  const { id } = await browserCDP.send('Extensions.loadUnpacked', { path: build });
  const worker = context.serviceWorkers().find(item => item.url().startsWith(`chrome-extension://${id}/`)) ?? await context.waitForEvent('serviceworker', item => item.url().startsWith(`chrome-extension://${id}/`));
  await expect.poll(() => worker.evaluate(() => chrome.action.onClicked.hasListeners()), { timeout: 10000 }).toBe(true);
  await worker.evaluate(() => {
    const state = (globalThis as any).__performanceAction = { pending: 0, titles: 0 };
    for (const name of ['setBadgeText', 'setBadgeBackgroundColor', 'setTitle']) {
      const api = chrome.action as any, original = api[name];
      api[name] = (...args: any[]) => { const result = original.apply(chrome.action, args); state.pending++; void result.finally(() => { state.pending--; if (name === 'setTitle') state.titles++; }); return result; };
    }
  });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.addInitScript(installMonitor);
  await page.route('**/design-performance-fixture.html', route => route.fulfill({ contentType: 'text/html', body: fixtureHTML }));
  await page.goto('http://127.0.0.1:5173/design-performance-fixture.html');
  const { targetInfos } = await browserCDP.send('Target.getTargets', { filter: [{ type: 'tab', exclude: false }] });
  const browserTargetId = targetInfos.find(target => target.url.includes('design-performance-fixture.html'))!.targetId;
  const action = async () => {
    const before = await worker.evaluate(() => (globalThis as any).__performanceAction.titles);
    await browserCDP.send('Extensions.triggerAction', { id, targetId: browserTargetId });
    await expect.poll(() => worker.evaluate(() => { const state = (globalThis as any).__performanceAction; return { pending: state.pending, titles: state.titles }; })).toEqual({ pending: 0, titles: before + 1 });
  };
  await action(); await expect(inspector(page)).toBeVisible();
  const cdp = await context.newCDPSession(page);
  const worlds: { id: number; origin: string }[] = [];
  cdp.on('Runtime.executionContextCreated', ({ context: execution }) => worlds.push(execution));
  await cdp.send('Runtime.enable'); await cdp.send('Performance.enable');
  let world = worlds.find(item => item.origin.startsWith('chrome-extension://'))!;
  const read = async <T = any>(expression: string): Promise<T> => {
    const result = await cdp.send('Runtime.evaluate', { contextId: world.id, expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
    return result.result.value;
  };
  const bind = async () => {
    world = worlds.filter(item => item.origin.startsWith('chrome-extension://')).at(-1)!;
    await read(`globalThis.__p=(()=>{const n=document.querySelector('cssforge-ui').shadowRoot.querySelector('[data-cssforge]');let f=n[Object.getOwnPropertyNames(n).find(k=>k.startsWith('__reactFiber$'))];for(let d=0;f&&d<32;d++,f=f.return){if(f.memoizedProps?.picker)return f.memoizedProps.picker;if(f.memoizedProps?.value?.picker)return f.memoizedProps.value.picker;}throw Error('Built picker missing');})();true`);
  };
  await bind();
  // Passive isolated-world event delivery is separately named. It is not an
  // assertion that React's downstream input handler or a CSS edit completed.
  await read(`globalThis.__isolatedInputs=[];globalThis.__isolatedRecording=false;globalThis.__isolatedCapture=event=>{if(!__isolatedRecording||event.type==='pointermove'&&event.buttons!==1||!event.composedPath().some(n=>n instanceof HTMLElement&&n.localName==='cssforge-ui'))return;const target=event.composedPath().find(n=>n instanceof HTMLElement&&n.hasAttribute('aria-label'));__isolatedInputs.push({type:event.type,time:performance.now(),stamp:event.timeStamp,trusted:event.isTrusted,label:target?.getAttribute('aria-label')??null});};for(const type of ['pointerdown','pointermove','pointerup','input','keydown'])window.addEventListener(type,__isolatedCapture,{capture:true,passive:true});true`);
  const pickTarget = async (selector: Workload['target']) => {
    const start = dock(page).getByRole('button', { name: 'Pick page element', exact: true });
    if (await start.count()) await start.click();
    await page.locator(selector).click({ position: { x: 4, y: 4 } });
    await expect.poll(() => read(`__p.targetLocator()?.identity.element.id`)).toBe(selector.slice(1));
  };
  const undoCount = () => read<number>('__p.editor.getSnapshot().undoCount');
  const metrics = async () => Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(item => [item.name, item.value]));
  const metadata = { profile, build, fixture: path.resolve(fixturePath), browser: context.browser()!.version(), viewport: { width: 1440, height: 1100 }, zoom: 1, nodes: await page.evaluate(() => document.querySelectorAll('*').length) };
  return { context, page, cdp, browserCDP, read, bind, action, pickTarget, undoCount, metrics, metadata, errors };
}
export type EditingRuntime = Awaited<ReturnType<typeof launchEditingPerformance>>;

export async function configureSections(page: Page, section?: string) {
  for (const name of ['Spacing', 'Typography', 'Background', 'Display', 'Border', 'Positioning', 'Box shadow', 'Text shadow', 'Filters']) {
    const header = page.locator(`[data-section="${name}"]`).getByRole('button', { name, exact: true });
    if (await header.getAttribute('aria-expanded') !== String(name === section)) await header.click();
  }
  await page.getByRole('tabpanel', { name: 'Design', exact: true }).evaluate(node => { node.scrollTop = 0; });
}

export async function undoThroughUI(page: Page) {
  await page.getByRole('button', { name: 'Inspector menu', exact: true }).click();
  await page.getByRole('dialog', { name: 'Inspector menu', exact: true }).getByRole('button', { name: 'Undo last edit', exact: true }).click();
  await page.keyboard.press('Escape');
}

export async function sustainedDrag(cdp: CDPSession, start: { x: number; y: number }, delta: number, milliseconds = durationMs, count = emittedMoves) {
  const events: DriverEvent[] = [], pending: Promise<void>[] = [];
  let wallStart = nodePerformance.now();
  const acknowledge = async (promise: Promise<unknown>, phase: string) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => {
      const driver: DriverData = { duration: milliseconds, plannedMoves: count, events, totalWallMs: nodePerformance.now() - wallStart, acknowledgementTimeout: true, acknowledgementPhase: phase };
      reject(Object.assign(Error(`TEST WATCHDOG: ${phase} acknowledgements did not settle within 20 seconds`), { driver }));
    }, 20000); })]); }
    finally { clearTimeout(timer); }
  };
  // Match normal pointer ownership before the independently scheduled stream.
  // Preparing hover/down is outside the move workload; move acknowledgements
  // still cannot backpressure its fixed schedule.
  await acknowledge(cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: start.x, y: start.y, buttons: 0, button: 'none' }), 'pointer hover');
  wallStart = nodePerformance.now();
  const send = (type: 'mousePressed' | 'mouseMoved' | 'mouseReleased', x: number, index: number, planned: number) => {
    const record: DriverEvent = { index, planned, issued: nodePerformance.now() - wallStart, x, y: start.y }; events.push(record);
    const issued = cdp.send('Input.dispatchMouseEvent', { type, x, y: start.y, buttons: type === 'mouseReleased' ? 0 : 1, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1, timestamp: Date.now() / 1000 }).then(() => { record.acknowledged = nodePerformance.now() - wallStart; });
    pending.push(issued);
  };
  // The command schedule is independent of acknowledgements. Sending one move
  // only after the previous move returns would hide the user's input backlog.
  send('mousePressed', start.x, -1, 0);
  await acknowledge(pending[0], 'pointer down');
  for (let index = 0; index < count; index++) {
    const planned = milliseconds * (index + 1) / count;
    const progress = (index + 1) / count;
    const x = start.x + (index === count - 1 ? delta : Math.round(delta * (1 - Math.cos(progress * Math.PI * 6)) / 2));
    pending.push(new Promise<void>(resolve => setTimeout(() => { send('mouseMoved', x, index, planned); resolve(); }, planned)));
  }
  await new Promise<void>(resolve => setTimeout(() => { send('mouseReleased', start.x + delta, count, milliseconds + 8); resolve(); }, milliseconds + 8));
  await acknowledge(Promise.all(pending), 'scheduled pointer stream');
  return { duration: milliseconds, plannedMoves: count, events, totalWallMs: nodePerformance.now() - wallStart };
}

export function distribution(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b), at = (fraction: number) => sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * fraction) - 1)] : 0;
  return { count: sorted.length, mean: sorted.length ? sorted.reduce((a, b) => a + b, 0) / sorted.length : 0, median: at(.5), p95: at(.95), max: sorted.at(-1) ?? 0 };
}

async function startTrace(cdp: CDPSession) {
  await cdp.send('Tracing.start', { categories: 'devtools.timeline,disabled-by-default-devtools.timeline,blink.user_timing,toplevel,v8,disabled-by-default-v8.cpu_profiler', options: 'record-continuously', transferMode: 'ReturnAsStream' });
}
async function endTrace(cdp: CDPSession, filename: string) {
  const completed = new Promise<{ stream?: string }>(resolve => cdp.once('Tracing.tracingComplete', resolve));
  await cdp.send('Tracing.end'); const { stream } = await completed;
  if (!stream) throw Error('Performance trace produced no stream');
  let contents = '';
  for (;;) { const chunk = await cdp.send('IO.read', { handle: stream }); contents += chunk.base64Encoded ? Buffer.from(chunk.data, 'base64').toString('utf8') : chunk.data; if (chunk.eof) break; }
  await cdp.send('IO.close', { handle: stream }); await writeFile(filename, contents);
  const trace = JSON.parse(contents) as { traceEvents: { name: string; ph: string; dur?: number; tid: number; pid: number; args?: any }[] };
  const frame = trace.traceEvents.flatMap(event => event.name === 'TracingStartedInBrowser' ? event.args?.data?.frames ?? [] : []).find(item => item.url?.includes('design-performance-fixture.html'));
  const threads = trace.traceEvents.filter(event => event.name === 'thread_name' && event.args?.name === 'CrRendererMain');
  const scriptingByThread = new Map<string, number>();
  for (const event of trace.traceEvents) if (event.ph === 'X' && ['RunTask', 'FunctionCall', 'EventDispatch'].includes(event.name)) { const key = `${event.pid}:${event.tid}`; scriptingByThread.set(key, (scriptingByThread.get(key) ?? 0) + (event.dur ?? 0)); }
  const thread = threads.find(event => event.pid === frame?.processId) ?? threads.sort((a, b) => (scriptingByThread.get(`${b.pid}:${b.tid}`) ?? 0) - (scriptingByThread.get(`${a.pid}:${a.tid}`) ?? 0))[0];
  const totals: Record<string, { count: number; inclusiveMs: number; maxMs: number }> = {};
  for (const event of trace.traceEvents) {
    if (event.ph !== 'X' || !event.dur || thread && (event.tid !== thread.tid || event.pid !== thread.pid)) continue;
    const total = totals[event.name] ??= { count: 0, inclusiveMs: 0, maxMs: 0 }; total.count++; total.inclusiveMs += event.dur / 1000; total.maxMs = Math.max(total.maxMs, event.dur / 1000);
  }
  return { file: filename, bytes: Buffer.byteLength(contents), mainThread: thread ? { pid: thread.pid, tid: thread.tid } : null, inclusiveEventTotals: Object.fromEntries(Object.entries(totals).sort((a, b) => b[1].inclusiveMs - a[1].inclusiveMs).slice(0, 25)), note: 'Nested durations are inclusive and must not be summed across categories.' };
}

export async function measureWorkload(r: EditingRuntime, info: TestInfo, workload: Workload) {
  const { page } = r;
  await r.pickTarget(workload.target); await configureSections(page, workload.section);
  const target = page.locator(workload.target);
  let initialCSS = await target.evaluate((node, property) => getComputedStyle(node).getPropertyValue(property), workload.property);
  let beforeUndo = await r.undoCount();
  let input = page.getByRole('textbox', { name: workload.label, exact: true });
  let start: { x: number; y: number }, expectedNumeric: number | undefined, expectedHue: number | undefined;
  const delta = 32;
  if (workload.kind === 'color') {
    // Establish a nonwhite public-control baseline outside the timing window;
    // hue is inert when saturation is zero. The timed drag itself remains one
    // ordinary gesture and one Undo restores this precise starting color.
    await input.fill('#336699ff'); await input.press('Enter');
    initialCSS = await target.evaluate((node, property) => getComputedStyle(node).getPropertyValue(property), workload.property);
    beforeUndo = await r.undoCount();
    await page.getByRole('button', { name: `${workload.label} picker`, exact: true }).click();
    const popup = page.getByRole('dialog', { name: `${workload.label} picker`, exact: true });
    const hue = popup.getByRole('slider', { name: 'Hue', exact: true }), box = (await hue.boundingBox())!;
    start = { x: box.x + box.width * .15, y: box.y + box.height / 2 };
    expectedHue = 360 * (.15 + delta / box.width);
  } else if (workload.kind === 'filter') {
    const slider = page.getByRole('slider', { name: workload.label, exact: true }); await slider.scrollIntoViewIfNeeded();
    const box = (await slider.boundingBox())!; start = { x: box.x + 16, y: box.y + box.height / 2 };
  } else {
    await input.scrollIntoViewIfNeeded(); const initialValue = parseFloat(await input.inputValue());
    const box = (await input.boundingBox())!; const calibration = { x: box.x + 8, y: box.y + box.height / 2 };
    await page.mouse.move(calibration.x, calibration.y); await page.mouse.down(); await page.mouse.move(calibration.x + 5, calibration.y); await page.mouse.up();
    await expect.poll(async () => parseFloat(await input.inputValue())).not.toBe(initialValue);
    const step = (parseFloat(await input.inputValue()) - initialValue) / 5;
    await undoThroughUI(page); await expect.poll(async () => parseFloat(await input.inputValue())).toBe(initialValue);
    await input.scrollIntoViewIfNeeded();
    await input.evaluate(node => (node as HTMLInputElement).setSelectionRange(0, 0));
    const actualBox = (await input.boundingBox())!; start = { x: actualBox.x + 8, y: actualBox.y + actualBox.height / 2 }; expectedNumeric = initialValue + delta * step;
  }
  await page.waitForTimeout(200);
  const label = (process.env.CSSFORGE_EDIT_PERF_LABEL ?? 'current').replace(/[^\w-]/g, '-');
  const directory = path.resolve('.preview/edit-time-performance'); await mkdir(directory, { recursive: true });
  const filename = path.join(directory, `${label}-${r.metadata.profile}-${workload.id}.json`);
  const tracing = process.env.CSSFORGE_EDIT_PERF_TRACE === '1' && r.metadata.profile === 'heavy' && workload.id === 'width';
  const diagnosticAvailable = await r.read<boolean>('typeof globalThis.__editPerf?.reset === "function" && typeof globalThis.__editPerf?.snapshot === "function"');
  if (diagnosticAvailable) await r.read('__editPerf.reset();true');
  const performanceBefore = await r.metrics();
  if (tracing) await startTrace(r.browserCDP);
  await r.read('__isolatedInputs=[];__isolatedRecording=true;true');
  await page.evaluate(() => (globalThis as any).__editPerf.start());
  let driver: DriverData | undefined, trace: Awaited<ReturnType<typeof endTrace>> | undefined, failure: unknown;
  let monitor: Monitor | undefined, diagnostic: unknown, performanceAfter: Record<string, number> = {};
  const collectionErrors: string[] = [];
  try { driver = await sustainedDrag(r.cdp, start, delta); await page.waitForTimeout(settlingMs); }
  catch (error) { failure = error; driver = (error as Error & { driver?: DriverData }).driver; }
  finally {
    // End timing before trace stream IO/JSON decoding. That diagnostics work
    // must never masquerade as page heartbeat stalls or editing backlog.
    try { monitor = await bounded(page.evaluate(() => (globalThis as any).__editPerf.stop()), 5000, 'stop main-world recorder') as Monitor; } catch (error) { collectionErrors.push(String(error)); }
    try { await bounded(r.read('__isolatedRecording=false;true'), 5000, 'stop isolated-world recorder'); } catch (error) { collectionErrors.push(String(error)); }
    try { performanceAfter = await bounded(r.metrics(), 5000, 'collect renderer metrics'); } catch (error) { collectionErrors.push(String(error)); }
    if (diagnosticAvailable) try { diagnostic = await bounded(r.read('__editPerf.snapshot()'), 5000, 'collect diagnostic counters'); } catch (error) { collectionErrors.push(String(error)); }
    if (tracing) try { trace = await bounded(endTrace(r.browserCDP, path.join(directory, `${label}-heavy-width.trace.json`)), 10000, 'collect short browser trace'); } catch (error) { collectionErrors.push(String(error)); }
  }
  const recordedDriver = driver;
  const inputCounts = recordedDriver ? { plannedMoves: recordedDriver.plannedMoves, emittedMoves: recordedDriver.events.filter(item => item.index >= 0 && item.index < recordedDriver.plannedMoves).length } : {};
  if (failure || !monitor || collectionErrors.length) {
    const watchdog = classifyWatchdog(monitor, driver?.acknowledgementTimeout);
    const failed = { metadata: r.metadata, workload, failure: String(failure ?? 'Diagnostic collection failed'), input: inputCounts, watchdog, collectionErrors, raw: { driver, monitor }, trace, diagnostic, note: 'Unavailable measurements remain absent; partial host-side input records are retained even if renderer evaluation cannot respond.' };
    await writeFile(filename, JSON.stringify(failed, null, 2)); await info.attach('edit-time-watchdog-failure', { path: filename, contentType: 'application/json' });
    throw failure ?? Error(`Timing diagnostics unavailable: ${collectionErrors.join('; ')}`);
  }
  const isolatedInputs = await r.read<CapturedInput[]>('__isolatedInputs');
  const metricDelta = Object.fromEntries(Object.keys(performanceAfter).map(key => [key, performanceAfter[key] - (performanceBefore[key] ?? 0)]));
  const finalCSS = await target.evaluate((node, property) => getComputedStyle(node).getPropertyValue(property), workload.property);
  const finalUndo = await r.undoCount(), pointerUp = monitor.inputs.filter(item => item.type === 'pointerup').at(-1)?.time ?? monitor.stop;
  const paintLatencies = monitor.writes.flatMap(write => write.latestInput !== null && write.secondRaf !== undefined ? [write.secondRaf - write.latestInput] : []);
  const firstRafLatencies = monitor.writes.flatMap(write => write.latestInput !== null && write.firstRaf !== undefined ? [write.firstRaf - write.latestInput] : []);
  const deliveredMoves = monitor.inputs.filter(item => item.type === 'pointermove');
  const evidence = {
    metadata: r.metadata, workload, initialCSS, finalCSS, beforeUndo, finalUndo, expectedNumeric, expectedHue,
    input: { ...inputCounts, mainWorldCapture: deliveredMoves.length, isolatedWorldCapture: isolatedInputs.filter(item => item.type === 'pointermove').length, trustedOnly: monitor.inputs.every(item => item.trusted) && isolatedInputs.every(item => item.trusted), acceptedCSSLayerWrites: monitor.writes.reduce((sum, item) => sum + item.layers, 0), driverScheduleSlip: distribution(driver?.events.map(item => item.issued - item.planned) ?? []), commandAcknowledgement: distribution(driver?.events.flatMap(item => item.acknowledged !== undefined ? [item.acknowledged - item.issued] : []) ?? []), queueDelay: distribution(deliveredMoves.map(item => item.queueDelay)), captureGap: distribution(deliveredMoves.slice(1).map((item, index) => item.time - deliveredMoves[index].time)) },
    timing: { eventToFirstRaf: distribution(firstRafLatencies), eventToPaintOpportunity: distribution(paintLatencies), frames: distribution(monitor.frames), slowFramesOver50ms: monitor.frames.filter(item => item > 50).length, longTasks: monitor.longTasks, heartbeat: distribution(monitor.heartbeats), writesAfterPointerUp: monitor.writes.filter(item => item.time > pointerUp).length, settleAfterPointerUpMs: Math.max(0, (monitor.writes.at(-1)?.time ?? pointerUp) - pointerUp), cssWritesDuringFirstSecond: monitor.writes.filter(item => item.time - monitor.start < 1000).length },
    watchdog: classifyWatchdog(monitor, driver?.acknowledgementTimeout), metrics: metricDelta, trace, diagnostic, raw: { driver, monitor, isolatedInputs }, notes: ['Main/isolated capture count is passive event delivery, not React handler completion.', 'Accepted CSS writes count newly installed CSSForge session style layers.', 'Second RAF is a conservative paint opportunity proxy, not actual pixel capture.', diagnosticAvailable ? 'Diagnostic counter build: timing must be compared separately from uninstrumented builds.' : 'No production instrumentation or layout reads are injected into the measured path.'],
  };
  await writeFile(filename, JSON.stringify(evidence, null, 2)); await info.attach('edit-time-measurement', { path: filename, contentType: 'application/json' });
  console.log(JSON.stringify({ editTimeEvidence: filename, profile: r.metadata.profile, workload: workload.id, version: label, input: evidence.input, timing: evidence.timing, metrics: metricDelta }));
  expect(evidence.input.plannedMoves).toBe(emittedMoves); expect(evidence.input.emittedMoves).toBe(emittedMoves); expect(evidence.input.trustedOnly).toBe(true);
  expect(evidence.watchdog.confirmedStall, 'Test watchdog found corroborated one-second stall or twenty-second input acknowledgement timeout').toBe(false);
  expect(monitor.writes.length, 'Live preview produces writes before mouseup').toBeGreaterThan(0);
  expect(evidence.timing.cssWritesDuringFirstSecond, 'Live preview begins during first second').toBeGreaterThan(0);
  expect(finalCSS).not.toBe(initialCSS);
  if (expectedNumeric !== undefined) expect(parseFloat(await input.inputValue()), 'Final pointer value survives the gesture').toBeCloseTo(expectedNumeric, 4);
  if (expectedHue !== undefined) {
    const finalHue = Number(await page.getByRole('dialog', { name: `${workload.label} picker`, exact: true }).getByRole('slider', { name: 'Hue', exact: true }).getAttribute('aria-valuenow'));
    expect(Math.abs(finalHue - expectedHue), 'Native coordinate rounding preserves final hue position').toBeLessThan(2);
    const concrete = parse(await input.inputValue()); expect(concrete).toBeTruthy(); expect(finalCSS).toBe(formatRgb(concrete!));
  }
  if (workload.kind === 'filter') {
    const finalSlider = Number(await page.getByRole('slider', { name: workload.label, exact: true }).inputValue());
    expect(Number(finalCSS.match(/blur\(([\d.]+)px\)/)?.[1])).toBe(finalSlider);
  }
  expect(finalUndo).toBe(beforeUndo + 1);
  // Escape deliberately cancels this active color gesture. Close through its
  // trigger to retain the edit, then verify the separate ordinary Undo action.
  if (workload.kind === 'color') await page.getByRole('button', { name: `${workload.label} picker`, exact: true }).click();
  await undoThroughUI(page);
  await expect.poll(() => target.evaluate((node, property) => getComputedStyle(node).getPropertyValue(property), workload.property)).toBe(initialCSS);
  expect(await r.undoCount()).toBe(beforeUndo); expect(r.errors).toEqual([]);
  return evidence;
}

export async function measureOwnershipCycles(r: EditingRuntime, info: TestInfo) {
  const cycles: { cycle: number; milliseconds: number; metrics: Record<string, number>; diagnostic?: any; ownership?: unknown; widthWrites: number; deactivatedMetrics: Record<string, number>; deactivatedDiagnostic?: any; deactivatedOwnership?: unknown }[] = [];
  const sample = async () => {
    // Collect outside all timing windows. Native listener/DOM totals otherwise
    // include removed nodes awaiting GC and do not measure retained ownership.
    // Clear diagnostic event/caller history before GC while retaining live
    // counters, so the instrumentation's own history cannot inflate the heap.
    await r.read('typeof globalThis.__editPerf?.reset === "function" ? (__editPerf.reset(), true) : false');
    await r.cdp.send('HeapProfiler.collectGarbage');
    const metrics = await r.metrics();
    const diagnostic = await r.read<{ live: unknown; ownership?: unknown } | null>('typeof globalThis.__editPerf?.snapshot === "function" ? __editPerf.snapshot() : null');
    return { metrics, diagnostic: diagnostic?.live, ownership: diagnostic?.ownership };
  };
  for (let cycle = 0; cycle < 8; cycle++) {
    const began = nodePerformance.now();
    await r.pickTarget('#layout-target'); await configureSections(r.page);
    const width = r.page.getByRole('textbox', { name: 'Width', exact: true });
    await width.scrollIntoViewIfNeeded(); await width.evaluate(node => (node as HTMLInputElement).setSelectionRange(0, 0));
    const box = (await width.boundingBox())!, original = Number(await width.inputValue());
    await r.page.evaluate(() => (globalThis as any).__editPerf.start());
    await sustainedDrag(r.cdp, { x: box.x + 8, y: box.y + box.height / 2 }, 16, 500, 30);
    await r.page.waitForTimeout(settlingMs);
    const timings = await r.page.evaluate(() => (globalThis as any).__editPerf.stop()) as Monitor;
    await expect(width).toHaveValue(String(original + 16));
    expect(await r.undoCount()).toBe(1); await undoThroughUI(r.page); await expect(width).toHaveValue(String(original));
    await configureSections(r.page, 'Spacing'); await configureSections(r.page);
    await r.pickTarget('#effects-target'); await configureSections(r.page, 'Typography');
    const color = r.page.getByRole('textbox', { name: 'Text color', exact: true });
    await color.fill('#446677'); await color.press('Enter');
    await r.page.getByRole('button', { name: 'Text color picker', exact: true }).click();
    await r.page.keyboard.press('Escape'); await undoThroughUI(r.page);
    await dock(r.page).getByRole('button', { name: 'Open Changes', exact: true }).click();
    await expect(r.page.getByRole('dialog', { name: 'Changes', exact: true })).toBeVisible();
    await r.page.getByRole('button', { name: 'Close Changes', exact: true }).click();
    expect(await r.undoCount()).toBe(0);
    await r.action(); await expect(r.page.locator('cssforge-ui')).toHaveCount(0);
    const deactivated = await sample();
    await r.action(); await expect(inspector(r.page)).toBeVisible(); await r.bind();
    await r.pickTarget('#layout-target'); await configureSections(r.page);
    await r.page.mouse.move(0, 0); await r.page.getByRole('textbox', { name: 'Width', exact: true }).blur();
    await r.page.waitForTimeout(settlingMs);
    const active = await sample();
    cycles.push({ cycle, milliseconds: nodePerformance.now() - began, ...active, widthWrites: timings.writes.reduce((sum, item) => sum + item.layers, 0), deactivatedMetrics: deactivated.metrics, deactivatedDiagnostic: deactivated.diagnostic, deactivatedOwnership: deactivated.ownership });
  }
  const label = (process.env.CSSFORGE_EDIT_PERF_LABEL ?? 'current').replace(/[^\w-]/g, '-');
  const directory = path.resolve('.preview/edit-time-performance'); await mkdir(directory, { recursive: true });
  const filename = path.join(directory, `${label}-heavy-ownership-cycles.json`);
  await writeFile(filename, JSON.stringify({ metadata: r.metadata, cycles, notes: ['Diagnostic event/caller history is reset before GC, retaining live ownership; both occur outside timing windows.', 'Native post-GC listener totals and diagnostic live/actual Set ownership are recorded separately for active and deactivated phases.', 'Cycle duration includes real UI selection/scrub/Undo/color/section/Changes/deactivation/reactivation, not just the 500ms drag.'] }, null, 2));
  await info.attach('heavy-ownership-cycles', { path: filename, contentType: 'application/json' });
  console.log(JSON.stringify({ ownershipEvidence: filename, milliseconds: cycles.map(item => item.milliseconds), listeners: cycles.map(item => item.metrics.JSEventListeners), nodes: cycles.map(item => item.metrics.Nodes), writes: cycles.map(item => item.widthWrites) }));
  // Identical settled lifecycle phases must retain the same active ownership.
  // These are deterministic ownership invariants, not a guessed latency ceiling.
  if (cycles[0].diagnostic) for (const cycle of cycles.slice(1)) expect(cycle.diagnostic).toEqual(cycles[0].diagnostic);
  expect(cycles.at(-1)!.metrics.JSEventListeners).toBe(cycles[0].metrics.JSEventListeners);
  expect(r.errors).toEqual([]);
  return cycles;
}
