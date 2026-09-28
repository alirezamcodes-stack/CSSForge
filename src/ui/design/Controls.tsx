import { useId, useState, type ReactNode } from 'react';
import { useUI } from '../../state/ui';
import { Icon } from '../shared/Icon';
import { Popover, Options } from '../popovers/Popover';
import s from '../ui.module.css';

export function Section({ name, children }: { name: string; children: ReactNode }) {
  const open = useUI(state => !state.collapsed.includes(name));
  const id = useId();
  return <section className={s.section} data-section={name}><button className={s.sectionTitle} type="button" aria-expanded={open} aria-controls={id} onClick={() => useUI.getState().toggleSection(name)}>{name}<span className={!open ? s.rotated : ''}><Icon name="chevron" /></span></button><div id={id} hidden={!open}>{children}</div></section>;
}
export function Value({ label, initial, unit = '' }: { label: string; initial: string | number; unit?: string }) {
  const [value, setValue] = useState(String(initial));
  return <label className={s.value}><span className={s.srOnly}>{label}</span><input aria-label={label} value={value} onChange={event => setValue(event.target.value)} spellCheck={false}/>{unit && <span>{unit}</span>}</label>;
}
export function Select({ label, options, initial, className = '' }: { label: string; options: string[]; initial?: string; className?: string }) {
  const [value, setValue] = useState(initial ?? options[0]);
  return <Popover id={label} label={value} className={className}><div className={s.menuCaption}>{label}</div><Options values={options} value={value} onChange={setValue} /></Popover>;
}
export function Color({ label = 'Text color', initial = '#ffffff' }: { label?: string; initial?: string }) {
  const [value, setValue] = useState(initial);
  return <label className={s.color}><input aria-label={label} type="color" value={value} onChange={e => setValue(e.target.value)} /><span>{value.toUpperCase()}</span></label>;
}
