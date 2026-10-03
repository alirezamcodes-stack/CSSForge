type NativeEyeDropper = { open(options: { signal: AbortSignal }): Promise<unknown> };
type EyeDropperGlobal = typeof globalThis & { EyeDropper?: new () => NativeEyeDropper };
export type SampleResult = { state: 'success'; color: string } | { state: 'cancelled' | 'unsupported' | 'failed' | 'busy' };
let owner: symbol | undefined;

export function supportsEyeDropper() { return typeof (globalThis as EyeDropperGlobal).EyeDropper === 'function'; }
export function isEyeDropperPending() { return owner !== undefined; }
export function normalizeSample(result: unknown): string | null {
  if (!result || typeof result !== 'object' || !('sRGBHex' in result)) return null;
  const color = result.sRGBHex;
  return typeof color === 'string' && /^#[\da-f]{6}$/i.test(color) ? color.toLowerCase() : null;
}

/** Call directly in the activation handler: no awaited work before native open(). */
export function sampleNativeColor(signal: AbortSignal): Promise<SampleResult> {
  const Native = (globalThis as EyeDropperGlobal).EyeDropper;
  if (typeof Native !== 'function') return Promise.resolve({ state: 'unsupported' });
  if (signal.aborted) return Promise.resolve({ state: 'cancelled' });
  if (owner) return Promise.resolve({ state: 'busy' });
  const lease = owner = Symbol('native color request');
  const release = () => { if (owner === lease) owner = undefined; };
  signal.addEventListener('abort', release, { once: true });
  const rejected = (error: unknown): SampleResult => ({ state: signal.aborted || (error instanceof Error && error.name === 'AbortError') ? 'cancelled' : 'failed' });
  let opened: Promise<unknown>;
  try { opened = new Native().open({ signal }); }
  catch (error) { signal.removeEventListener('abort', release); release(); return Promise.resolve(rejected(error)); }
  return opened.then((result): SampleResult => {
    if (signal.aborted) return { state: 'cancelled' };
    const color = normalizeSample(result);
    return color ? { state: 'success', color } : { state: 'failed' };
  }, rejected).finally(() => { signal.removeEventListener('abort', release); release(); });
}
