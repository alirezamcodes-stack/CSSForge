import { useEffect, useId, useRef, useState } from 'react';
import { useEditing } from '../../picker/context';
import { useUI } from '../../state/ui';
import { HexAlphaColorPicker } from 'react-colorful';
import { parse, formatHex8, formatRgb, formatHsl, converter } from 'culori';
import { Popover } from '../popovers/Popover';
import { NumericScrubber } from './NumericScrubber';
import s from './propertyControls.module.css';
const recent: string[] = [];
const rgb = converter('rgb');
export function colorToken(value: string, format: 'HEX' | 'RGB' | 'HSL' = 'HEX') { const color = parse(value); return color ? (format === 'RGB' ? formatRgb(color) : format === 'HSL' ? formatHsl(color) : formatHex8(color)) : null; }
export function ColorControl({ label, value, onChange, title, overridden = false, mixed = false }: { label: string; value: string; onChange: (value: string, gesture?: string) => boolean | void; title?: string; overridden?: boolean; mixed?: boolean }) {
  const { editor } = useEditing();
  const errorId = useId();
  const open = useUI(state => state.activePopover === `${label} picker`);
  const [draft, setDraft] = useState(value), [invalid, setInvalid] = useState(false), [message, setMessage] = useState(''), [format, setFormat] = useState<'HEX' | 'RGB' | 'HSL'>('HEX');
  const [engineError, setEngineError] = useState(false);
  const focused = useRef(false), gesture = useRef(''), original = useRef(value);
  useEffect(() => { if (!open) gesture.current = ''; }, [open]);
  useEffect(() => { if (!focused.current) { setDraft(value); setInvalid(false); setMessage(''); } }, [value]);
  const parsed = mixed ? undefined : parse(value), alpha = parsed?.alpha ?? 1;
  const start = () => { gesture.current = crypto.randomUUID(); original.current = value; };
  const cancel = () => { const reverted = editor?.cancelGesture(gesture.current); setDraft(reverted ? original.current : value); gesture.current = ''; setInvalid(false); setMessage(''); };
  const escape = (event: React.KeyboardEvent, popup = false) => {
    if (event.key !== 'Escape') return;
    event.preventDefault(); event.stopPropagation(); cancel();
    if (popup) useUI.getState().setPopover(null); else (event.target as HTMLInputElement).blur();
  };
  const apply = (next: string, id = gesture.current) => {
    setDraft(next);
    if (!CSS.supports('color', next) || /[;{}]/.test(next)) { setInvalid(true); setEngineError(false); setMessage('Enter a valid CSS color.'); return false; }
    if (onChange(next, id) === false) { setInvalid(true); setEngineError(true); setMessage(editor?.getSnapshot().error ?? 'This color cannot be applied.'); return false; }
    setInvalid(false); setEngineError(false); setMessage(''); return true;
  };
  const remember = () => { const normalized = colorToken(value); if (normalized && !recent.includes(normalized)) { recent.unshift(normalized); recent.splice(10); } };
  return <div className={`${s.colorControl} ${overridden ? s.overridden : ''}`}>
    <div className={s.colorClosed}>
      <Popover id={`${label} picker`} className={s.colorTrigger} iconOnly label={<span className={s.colorSwatch} style={{ backgroundColor: parsed ? formatRgb(parsed) : 'transparent' }} />}>
        <div className={s.colorPanel} data-escape-cancel onKeyDown={event => escape(event, true)} onFocusCapture={event => { if ((event.target as HTMLElement).getAttribute('role') === 'slider') start(); }} onBlurCapture={event => { if ((event.target as HTMLElement).getAttribute('role') === 'slider') gesture.current = ''; }} onPointerDown={event => { if ((event.target as HTMLElement).closest('.react-colorful')) start(); }} onPointerUp={remember}>
          <div className={s.caption}>{label}</div>
          {parsed && <HexAlphaColorPicker color={formatHex8(parsed)} onChange={next => apply(colorToken(next, format) ?? next)} />}
          <div className={s.formatTabs} role="group" aria-label="Color format">{(['HEX', 'RGB', 'HSL'] as const).map(mode => <button key={mode} aria-pressed={format === mode} onClick={() => setFormat(mode)}>{mode}</button>)}</div>
          <input data-escape-cancel aria-label={`${label} ${format}`} aria-invalid={invalid || undefined} aria-describedby={invalid ? `${errorId}-popup` : undefined} placeholder={mixed ? 'Mixed — choose one color for all sides' : undefined} value={invalid ? draft : mixed ? '' : colorToken(value, format) ?? value} onFocus={start} onBlur={() => { gesture.current = ''; remember(); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} onChange={event => apply(event.target.value)} spellCheck={false} />
          <div className={s.alpha}><span>Alpha</span><NumericScrubber label={`${label} alpha`} disabled={!parsed} value={parsed ? `${Number((alpha * 100).toFixed(1))}%` : '—'} min={0} max={100} units={[]} onChange={(next, id) => { if (!parsed) return false; const color = rgb(parsed); if (!color) return false; return apply(formatHex8({ ...color, alpha: Math.max(0, Math.min(1, parseFloat(next) / 100)) }), id); }} /></div>
          {recent.length > 0 && <><div className={s.caption}>Recent colors</div><div className={s.recent}>{recent.map(color => <button key={color} aria-label={`Use ${color}`} title={color} style={{ backgroundColor: color }} onClick={() => { start(); apply(color); }} />)}</div></>}
          {!parsed && <small className={s.help}>{mixed ? 'Mixed border colors. Choosing one color replaces all four sides.' : 'This color token has no concrete color here. Spectrum, hue and alpha are unavailable. Enter a concrete color to replace it.'}</small>}
          {message && <small id={`${errorId}-popup`} className={engineError ? s.srError : s.error} role={engineError ? undefined : 'alert'}>{message}</small>}
        </div>
      </Popover>
      <input data-escape-cancel aria-label={label} title={mixed ? 'Mixed border colors. Choosing one color replaces all four sides.' : title} placeholder={mixed ? 'Mixed' : undefined} value={mixed && draft === value ? '' : draft} data-override={overridden} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} onFocus={() => { focused.current = true; start(); }} onChange={event => apply(event.target.value)} onBlur={() => { focused.current = false; gesture.current = ''; remember(); }} onKeyDown={event => { escape(event); if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); remember(); } }} spellCheck={false} />
    </div>
    {message && <small id={errorId} className={engineError || open ? s.srError : s.error} role={engineError || open ? undefined : 'alert'}>{message}</small>}
  </div>;
}
