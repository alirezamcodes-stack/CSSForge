import { useEffect, useId, useRef, useState } from 'react';
import { useEditing } from '../../picker/context';
import { Popover } from '../popovers/Popover';
import { useUI } from '../../state/ui';
import { Icon } from './Icon';
import { numericToken, stepNumeric, unitsFor, unitStep, convertValue, validNumeric, valueModel, type ValueProperty, type ConversionContext, type ValueReference } from '../../editing/values';
import ui from '../ui.module.css';
import s from './propertyControls.module.css';
export { numericToken, stepNumeric } from '../../editing/values';
export function NumericScrubber({ label, value, onChange, property, reference, units: legacyUnits = [], defaultUnit = '', stripPx = false, unitlessInput = false, min = -Infinity, max = Infinity, disabled = false, title, overridden = false }: {
  label: string; value: string; onChange: (value: string, gesture?: string) => boolean | void; property?: ValueProperty; reference?: ValueReference; units?: string[]; defaultUnit?: string; stripPx?: boolean; unitlessInput?: boolean; min?: number; max?: number; disabled?: boolean; title?: string; overridden?: boolean;
}) {
  const { editor, design } = useEditing();
  const errorId = useId();
  const units = property ? unitsFor(property) : legacyUnits;
  const model = property ? valueModel(property,value) : null;
  const activePopover = useUI(state => state.activePopover), menuId = `${label} unit`;
  const referenceKey = JSON.stringify(reference);
  const [conversion, setConversion] = useState<ConversionContext>({});
  useEffect(() => { if (activePopover === menuId && property && design) setConversion(editor?.conversionContext(design.targetId,property,reference) ?? {}); }, [activePopover,menuId,property,design?.targetId,editor,referenceKey]);
  const display = (value: string) => { const token = numericToken(value); return token && (units.length > 0 && token.unit || stripPx && token.unit === 'px') ? String(token.amount) : value; };
  const [draft, setDraft] = useState(display(value)), [invalid, setInvalid] = useState(false), [scrubbing, setScrubbing] = useState(false);
  const [message, setMessage] = useState('');
  const [engineError, setEngineError] = useState(false);
  const focused = useRef(false), gesture = useRef(''), original = useRef(value), latest = useRef(value), input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; value: string } | null>(null), pending = useRef<string | null>(null), frame = useRef(0), callback = useRef(onChange); callback.current = onChange; latest.current = value;
  useEffect(() => { if (!focused.current) { setDraft(display(value)); setInvalid(false); } }, [value]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const apply = (next: string, exact = false) => {
    const current = numericToken(latest.current);
    const unit = unitlessInput ? '' : current ? current.unit || (property && !units.includes('') ? defaultUnit : '') : defaultUnit;
    const token = numericToken(next);
    const bareZero = property && token?.amount === 0 && !token.unit && validNumeric(property,token);
    const normalized = !exact && !bareZero && token && !token.unit && unit ? next + unit : next;
    const parsed = numericToken(normalized);
    if (property && parsed && (!validNumeric(property,parsed) || property === 'z-index' && !Number.isInteger(parsed.amount))) {
      setDraft(next); setInvalid(true); setEngineError(false);
      setMessage(property === 'z-index' ? 'Z-index requires a unitless integer.' : `Unsupported unit: ${parsed.unit || 'unitless'}.`);
      return;
    }
    const ok = callback.current(normalized, gesture.current);
    setDraft(ok === false ? next : display(normalized)); setInvalid(ok === false);
    setEngineError(ok === false);
    setMessage(ok === false ? editor?.getSnapshot().error ?? `Enter a valid ${label.toLowerCase()} value.` : '');
  };
  const step = (unit: string, shift: boolean, alt: boolean) => unitStep(property,unit) * (shift ? 10 : alt && property !== 'z-index' ? .1 : 1);
  const flush = () => { cancelAnimationFrame(frame.current); frame.current = 0; if (pending.current !== null) { const next = pending.current; pending.current = null; apply(next); } };
  const start = () => { gesture.current = crypto.randomUUID(); original.current = latest.current; };
  const cancel = () => { cancelAnimationFrame(frame.current); frame.current = 0; pending.current = null; editor?.cancelGesture(gesture.current); setDraft(display(original.current)); setInvalid(false); setMessage(''); drag.current = null; setScrubbing(false); };
  return <span className={`${s.numeric} ${overridden ? s.overridden : ''}`} data-scrubbing={scrubbing}>
    <input ref={input} data-escape-cancel aria-label={label} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} data-override={overridden} value={draft} disabled={disabled} title={title ?? 'Type a CSS value or drag in its current unit · ↑/↓ step · Shift ×10 · Alt ×0.1 · Escape reverts'} spellCheck={false}
      onFocus={() => { focused.current = true; start(); }} onChange={event => apply(event.target.value)}
      onBlur={() => { flush(); focused.current = false; if (!invalid) setDraft(display(latest.current)); }}
      onPointerDown={event => { if (event.button !== 0 || !numericToken(value) || model && !model.canConvert) return; start(); drag.current = { x: event.clientX, value }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (!drag.current || Math.abs(event.clientX - drag.current.x) < 4 && !scrubbing) return; event.preventDefault(); setScrubbing(true); const token = numericToken(drag.current.value)!; let delta = (event.clientX - drag.current.x) * step(token.unit,event.shiftKey,event.altKey); if (property === 'z-index') delta = Math.round(delta); const next = stepNumeric(drag.current.value, delta, '', min, max); if (next !== null) { setDraft(display(next)); pending.current = next; if (!frame.current) frame.current = requestAnimationFrame(flush); } }}
      onPointerUp={() => { flush(); drag.current = null; setScrubbing(false); }} onPointerCancel={cancel}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); input.current?.blur(); } else if (event.key === 'Enter') { event.preventDefault(); flush(); input.current?.blur(); } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); const token = numericToken(draft) ? numericToken(latest.current) : null; const next = token && stepNumeric(latest.current, (event.key === 'ArrowUp' ? 1 : -1) * step(token.unit,event.shiftKey,event.altKey), '', min, max); if (next !== null) apply(next); } }} />
    {invalid && message && <small id={errorId} className={engineError ? s.srError : s.error} role={engineError ? undefined : 'alert'}>{message}</small>}
    {units.length > 1 && !disabled && numericToken(value) && <Popover portal={property?.startsWith('margin-') || property?.startsWith('padding-')} id={menuId} className={s.unit} label={numericToken(value)?.unit || '—'}><div className={ui.menuCaption}>Convert unit · preserve current size</div>{units.map(unit => { const result = property ? convertValue(property,value,unit,conversion) : {ok:false as const,reason:'Conversion unavailable.'}; return <button type="button" className={ui.menuOption} key={unit} disabled={!result.ok} aria-pressed={numericToken(value)?.unit === unit} title={result.ok ? result.value : result.reason} onClick={() => { if (!property) return; const fresh = convertValue(property,latest.current,unit,design ? editor?.conversionContext(design.targetId,property,reference) : {}); if (fresh.ok) { start(); apply(fresh.value,true); useUI.getState().setPopover(null); } else setConversion({}); }}><span>{unit || 'unitless'}</span>{numericToken(value)?.unit === unit && <Icon name="check" />}</button>; })}<p className={ui.menuNote}>Unavailable conversions need a known reference. You can type a valid value with its unit directly.</p></Popover>}
  </span>;
}
