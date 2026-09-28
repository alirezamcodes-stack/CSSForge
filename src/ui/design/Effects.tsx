import { useState } from 'react';
import { filters } from '../../fixtures/selected';
import { Section } from './Controls';
import { Icon } from '../shared/Icon';
import s from '../ui.module.css';
const shadows = ['0 12px 22px #0004', '0 5px 24px #0002', '0 0 0 1px #25262c', '0 2px 4px #0005', '0 2px 12px #0001', 'inset 0 -16px 20px #0004', '0 20px 14px -14px #0009', '0 3px 1px #0003, 0 5px 8px #0002', '0 0 0 2px #6be8ac'];
export function ShadowSection({ text = false }: { text?: boolean }) {
  const [preset, setPreset] = useState(text ? -1 : 1);
  return <Section name={text ? 'Text shadow' : 'Box shadow'}>{text && <button className={s.addButton} onClick={() => setPreset(0)}><Icon name="plus" />Add text shadow</button>}<div className={text ? s.textPresets : s.shadowPresets}>{(text ? ['Outline', 'Soft', 'Heavy', 'Raised'] : shadows).map((item, index) => <button key={item} aria-label={`${text ? 'Text' : 'Box'} shadow preset ${index + 1}`} aria-pressed={preset === index} className={preset === index ? s.selectedPreset : ''} onClick={() => setPreset(index)}>{text ? <><b style={{ textShadow: ['1px 1px #000, -1px -1px #000', '0 4px 3px #0005', '0 5px #000', '0 2px #aaa, 0 4px #999'][index] }}>A</b><small>{item}</small></> : <span style={{ boxShadow: item }}>#{index + 1}</span>}</button>)}</div></Section>;
}
export function FilterSection() {
  return <Section name="Filters"><div className={s.filters}>{filters.map(([label, initial, max, unit]) => <Filter key={label} {...{ label, initial, max, unit }} />)}</div></Section>;
}
function Filter({ label, initial, max, unit }: { label: string; initial: number; max: number; unit: string }) {
  const [value, setValue] = useState(initial);
  return <label className={s.filter}><span>{label}</span><input aria-label={label} type="range" min={0} max={max} value={value} style={{ background: `linear-gradient(to right, var(--accent) ${value / max * 100}%, var(--control-border) ${value / max * 100}%)` }} onChange={e => setValue(Number(e.target.value))} /><output>{value}{unit}</output></label>;
}
