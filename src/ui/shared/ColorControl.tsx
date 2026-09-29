import { useEffect, useRef, useState } from 'react';
import { HexAlphaColorPicker } from 'react-colorful';
import { parse, formatHex8, formatRgb, formatHsl, converter } from 'culori';
import { Popover } from '../popovers/Popover';
import { NumericScrubber } from './NumericScrubber';
import s from './propertyControls.module.css';
const recent: string[] = [];
const rgb = converter('rgb');
export function colorToken(value: string, format: 'HEX' | 'RGB' | 'HSL' = 'HEX') { const color = parse(value); return color ? (format === 'RGB' ? formatRgb(color) : format === 'HSL' ? formatHsl(color) : formatHex8(color)) : null; }
export function ColorControl({ label, value, onChange, title, overridden = false }: { label: string; value: string; onChange: (value: string, gesture?: string) => boolean | void; title?: string; overridden?: boolean }) {
  const [draft, setDraft] = useState(value), [invalid, setInvalid] = useState(false), [message, setMessage] = useState(''), [format, setFormat] = useState<'HEX' | 'RGB' | 'HSL'>('HEX');
  const focused = useRef(false), gesture = useRef('');
  useEffect(() => { if (!focused.current) { setDraft(value); setInvalid(false); } }, [value]);
  const parsed = parse(value), hex = parsed ? formatHex8(parsed) : '#000000ff', alpha = parsed?.alpha ?? 1;
  const apply = (next: string, id = gesture.current) => {
    setDraft(next);
    if (!CSS.supports('color', next) || /[;{}]/.test(next)) { setInvalid(true); setMessage('Enter a valid CSS color.'); return false; }
    if (onChange(next, id) === false) { setInvalid(true); setMessage(''); return false; }
    setInvalid(false); setMessage(''); return true;
  };
  const remember = () => { const normalized = colorToken(value); if (normalized && !recent.includes(normalized)) { recent.unshift(normalized); recent.splice(10); } };
  return <div className={`${s.colorControl} ${overridden ? s.overridden : ''}`}>
    <div className={s.colorClosed}>
      <Popover id={`${label} picker`} className={s.colorTrigger} iconOnly label={<span className={s.colorSwatch} style={{ backgroundColor: parsed ? formatRgb(parsed) : 'transparent' }} />}>
        <div className={s.colorPanel} onPointerDown={() => { gesture.current = crypto.randomUUID(); }} onPointerUp={remember}>
          <div className={s.caption}>{label}</div>
          <HexAlphaColorPicker color={hex} onChange={next => apply(colorToken(next, format) ?? next)} />
          <div className={s.formatTabs} role="group" aria-label="Color format">{(['HEX', 'RGB', 'HSL'] as const).map(mode => <button key={mode} aria-pressed={format === mode} onClick={() => setFormat(mode)}>{mode}</button>)}</div>
          <input aria-label={`${label} ${format}`} value={invalid ? draft : colorToken(value, format) ?? value} onFocus={() => { gesture.current = crypto.randomUUID(); }} onChange={event => apply(event.target.value)} spellCheck={false} />
          <div className={s.alpha}><span>Alpha</span><NumericScrubber label={`${label} alpha`} value={`${Number((alpha * 100).toFixed(1))}%`} min={0} max={100} units={[]} onChange={(next, id) => { const color = rgb(parsed ?? '#000'); if (!color) return false; return apply(formatHex8({ ...color, alpha: Math.max(0, Math.min(1, parseFloat(next) / 100)) }), id); }} /></div>
          {recent.length > 0 && <><div className={s.caption}>Recent colors</div><div className={s.recent}>{recent.map(color => <button key={color} aria-label={`Use ${color}`} title={color} style={{ backgroundColor: color }} onClick={() => apply(color, crypto.randomUUID())} />)}</div></>}
          {!parsed && <small className={s.help}>Enter a color, or choose a new one to replace this token.</small>}
          {message && <small className={s.error}>{message}</small>}
        </div>
      </Popover>
      <input aria-label={label} title={title} value={draft} data-override={overridden} aria-invalid={invalid || undefined} onFocus={() => { focused.current = true; gesture.current = crypto.randomUUID(); }} onChange={event => apply(event.target.value)} onBlur={() => { focused.current = false; remember(); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); remember(); } }} spellCheck={false} />
    </div>
    {message && <small className={s.error} role="alert">{message}</small>}
  </div>;
}
