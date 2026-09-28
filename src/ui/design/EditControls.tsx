import { useEffect, useRef, useState } from 'react';
import { useEditing } from '../../picker/context';
import type { Property } from '../../editing/properties';
import { Popover, Options } from '../popovers/Popover';
import s from '../ui.module.css';

function displayValue(property: Property, value: string) {
  if (property === 'opacity') return value.endsWith('%') ? value.slice(0, -1) : Number.isFinite(Number(value)) ? String(Number((Number(value) * 100).toFixed(3))) : value;
  // Line height accepts both unitless multipliers and lengths; keep the unit explicit.
  if (property === 'line-height') return value;
  return value.endsWith('px') && !value.includes(' ') ? value.slice(0, -2) : value;
}
export function EditField({ property, label, disabled = false, color = false }: { property: Property; label: string; disabled?: boolean; color?: boolean }) {
  const { editor, design } = useEditing();
  const field = design!.values[property];
  const presented = color ? field.presented : displayValue(property, field.presented);
  const [draft, setDraft] = useState(presented);
  const [invalid, setInvalid] = useState(false);
  const gesture = useRef<string | undefined>(undefined);
  useEffect(() => { setDraft(presented); setInvalid(false); }, [presented, design!.targetId]);
  const apply = (value: string) => {
    setDraft(value);
    const input = property === 'opacity' && /^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(value.trim()) ? `${value}%` : value;
    setInvalid(!editor!.apply(design!.targetId, property, input, gesture.current));
  };
  const title = `Browser: ${field.computed}\n${field.override ? `Session override: ${field.override}` : 'No session override'}`;
  const input = <input aria-label={label} title={title} value={draft} disabled={disabled} aria-invalid={invalid || undefined} data-override={!!field.override} spellCheck={false}
    onFocus={() => { gesture.current = crypto.randomUUID(); }} onChange={event => apply(event.target.value)}
    onBlur={() => { gesture.current = undefined; }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} />;
  if (color) {
    const rgb = field.computed.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
    const hex = rgb ? '#' + rgb.slice(1, 4).map(value => Number(value).toString(16).padStart(2, '0')).join('') : '#000000';
    return <label className={`${s.color} ${s.editColor}`}><input type="color" aria-label={`${label} swatch`} value={hex} onChange={event => { gesture.current = undefined; apply(event.target.value); }} />{input}</label>;
  }
  const unit = property === 'opacity' ? '%' : property !== 'line-height' && field.presented.endsWith('px') && !/[^\d.+-]/.test(draft) ? 'px' : '';
  return <label className={`${s.value} ${s.editValue}`}>{input}{unit && <span>{unit}</span>}</label>;
}
export function EditSelect({ property, label, options }: { property: Property; label: string; options: string[] }) {
  const { editor, design } = useEditing();
  const value = design!.values[property].presented;
  const values = options.includes(value) ? options : [value, ...options].filter(Boolean);
  return <Popover id={label} label={value}><div className={s.menuCaption}>{label}</div>{property === 'font-family' && <EditField property="font-family" label="Custom font family" />}<Options values={values} value={value} onChange={next => editor!.apply(design!.targetId, property, next)} /></Popover>;
}
export function SessionActions() {
  const { editor, undoCount, editedCount, error } = useEditing();
  return <><div className={s.sessionActions}><button className={s.outlineButton} disabled={!undoCount} onClick={() => editor?.undo()}>Undo last edit</button><button className={s.outlineButton} disabled={!editedCount} onClick={() => editor?.reset()}>Reset session edits</button></div>{error && <p className={s.editError} role="alert">{error}</p>}</>;
}
