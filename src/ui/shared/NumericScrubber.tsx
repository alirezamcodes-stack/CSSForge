import { useEffect, useRef, useState } from 'react';
import { useEditing } from '../../picker/context';
import { Options, Popover } from '../popovers/Popover';
import s from './propertyControls.module.css';
export function numericToken(value: string) { const match = value.trim().match(/^([-+]?(?:\d+\.?\d*|\.\d+))([a-z%]*)$/i); return match ? { amount: Number(match[1]), unit: match[2] } : null; }
export function stepNumeric(value: string, delta: number, fallbackUnit = '', minimum = -Infinity, maximum = Infinity) {
  const token = numericToken(value); if (!token) return null;
  return `${Number(Math.max(minimum, Math.min(maximum, token.amount + delta)).toFixed(4))}${token.unit || fallbackUnit}`;
}
export function NumericScrubber({ label, value, onChange, units = ['px', '%', 'em', 'rem', 'vh', 'vw'], defaultUnit = '', stripPx = false, unitlessInput = false, min = -Infinity, max = Infinity, disabled = false, title, overridden = false }: {
  label: string; value: string; onChange: (value: string, gesture?: string) => boolean | void; units?: string[]; defaultUnit?: string; stripPx?: boolean; unitlessInput?: boolean; min?: number; max?: number; disabled?: boolean; title?: string; overridden?: boolean;
}) {
  const { editor } = useEditing();
  const display = (value: string) => { const token = numericToken(value); return token && (units.length > 0 && token.unit || stripPx && token.unit === 'px') ? String(token.amount) : value; };
  const [draft, setDraft] = useState(display(value)), [invalid, setInvalid] = useState(false), [scrubbing, setScrubbing] = useState(false);
  const focused = useRef(false), gesture = useRef(''), original = useRef(value), latest = useRef(value), input = useRef<HTMLInputElement>(null);
  const drag = useRef<{ x: number; value: string } | null>(null), pending = useRef<string | null>(null), frame = useRef(0), callback = useRef(onChange); callback.current = onChange; latest.current = value;
  useEffect(() => { if (!focused.current) { setDraft(display(value)); setInvalid(false); } }, [value]);
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const apply = (next: string) => { setDraft(display(next)); const unit = unitlessInput ? '' : numericToken(value)?.unit || defaultUnit; const token = numericToken(next); const normalized = token && !token.unit && unit ? next + unit : next; const ok = callback.current(normalized, gesture.current); setInvalid(ok === false); };
  const flush = () => { cancelAnimationFrame(frame.current); frame.current = 0; if (pending.current !== null) { const next = pending.current; pending.current = null; apply(next); } };
  const start = () => { gesture.current = crypto.randomUUID(); original.current = latest.current; };
  const cancel = () => { cancelAnimationFrame(frame.current); frame.current = 0; pending.current = null; editor?.cancelGesture(gesture.current); setDraft(display(original.current)); setInvalid(false); drag.current = null; setScrubbing(false); };
  return <span className={`${s.numeric} ${overridden ? s.overridden : ''}`} data-scrubbing={scrubbing}>
    <input ref={input} data-escape-cancel aria-label={label} aria-invalid={invalid || undefined} data-override={overridden} value={draft} disabled={disabled} title={title ?? 'Type a value or drag horizontally · ↑/↓ 1 · Shift 10 · Alt 0.1 · Escape reverts'} spellCheck={false}
      onFocus={() => { focused.current = true; start(); }} onChange={event => apply(event.target.value)}
      onBlur={() => { flush(); focused.current = false; if (!invalid) setDraft(display(latest.current)); }}
      onPointerDown={event => { if (event.button !== 0 || !numericToken(value)) return; start(); drag.current = { x: event.clientX, value }; event.currentTarget.setPointerCapture(event.pointerId); }}
      onPointerMove={event => { if (!drag.current || Math.abs(event.clientX - drag.current.x) < 4 && !scrubbing) return; event.preventDefault(); setScrubbing(true); const next = stepNumeric(drag.current.value, (event.clientX - drag.current.x) * (event.shiftKey ? 10 : event.altKey ? .1 : 1), defaultUnit, min, max); if (next !== null) { setDraft(display(next)); pending.current = next; if (!frame.current) frame.current = requestAnimationFrame(flush); } }}
      onPointerUp={() => { flush(); drag.current = null; setScrubbing(false); }} onPointerCancel={cancel}
      onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancel(); input.current?.blur(); } else if (event.key === 'Enter') { event.preventDefault(); flush(); input.current?.blur(); } else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') { event.preventDefault(); const next = stepNumeric(draft, (event.key === 'ArrowUp' ? 1 : -1) * (event.shiftKey ? 10 : event.altKey ? .1 : 1), numericToken(value)?.unit || defaultUnit, min, max); if (next !== null) apply(next); } }} />
    {units.length > 0 && !disabled && numericToken(value) && <Popover id={`${label} unit`} className={s.unit} label={numericToken(value)?.unit || defaultUnit || '—'}><div className={s.caption}>Unit · keeps the numeric amount</div><Options value={numericToken(value)?.unit || defaultUnit || 'unitless'} values={units.map(unit => unit || 'unitless')} onChange={selected => { const unit = selected === 'unitless' ? '' : selected; const token = numericToken(draft); if (token) { start(); apply(`${token.amount}${unit}`); } }} /></Popover>}
  </span>;
}
