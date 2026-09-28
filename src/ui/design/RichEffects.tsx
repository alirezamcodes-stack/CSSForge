import { useEffect, useRef, useState } from 'react';
import { useEditing } from '../../picker/context';
import { filterSpecs, parseShadow, readFilter, serializeShadow, splitCSS, updateFilter } from '../../editing/rich';
import { Section } from './Controls';
import { TokenInput, contextKey } from './RichControls';
import { Icon } from '../shared/Icon';
import s from '../ui.module.css';

const boxPresets = ['0 12px 22px #0004', '0 5px 24px #0002', '0 0 0 1px #25262c', '0 2px 4px #0005', '0 2px 12px #0001', 'inset 0 -16px 20px #0004', '0 20px 14px -14px #0009', '0 3px 1px #0003, 0 5px 8px #0002', '0 0 0 2px #6be8ac'];
const textPresets = ['1px 1px #000, -1px -1px #000', '0 4px 3px #0005', '0 5px #000', '0 2px #aaa, 0 4px #999'];
export function RichShadow({ text = false }: { text?: boolean }) {
  const { editor, design } = useEditing(); const [selected, setSelected] = useState(0);
  const property = text ? 'text-shadow' : 'box-shadow', name = text ? 'Text' : 'Box';
  const value = design!.values[property].presented, list = value === 'none' ? [] : splitCSS(value);
  const index = Math.min(selected, Math.max(0, list.length - 1)), shadow = parseShadow(list[index] ?? '', text);
  const commit = (next: string[]) => editor!.apply(design!.targetId, property, next.join(', ') || 'none');
  return <Section name={`${name} shadow`}><div className={s.sessionActions}><button className={s.addButton} onClick={() => { if (commit([...list, '0px 4px 12px #0004'])) setSelected(list.length); }}><Icon name="plus" />Add {text ? 'text' : 'box'} shadow</button><button className={s.outlineButton} onClick={() => commit([])}>None</button></div>
    {!!list.length && <div className={s.backgroundLayers}>{list.map((_, i) => <div className={s.layer} key={i}><button className={s.layerSelect} aria-label={`Select ${name.toLowerCase()} shadow ${i + 1}`} aria-pressed={i === index} onClick={() => setSelected(i)}>Shadow {i + 1}</button><button aria-label={`Remove ${name.toLowerCase()} shadow ${i + 1}`} onClick={() => commit(list.filter((_, at) => at !== i))}>×</button></div>)}</div>}
    {shadow && <div className={s.richDetails}><div className={s.twoColumns}>{(['x', 'y', 'blur', ...(!text ? ['spread'] : [])] as const).map(field => <TokenInput key={field} label={`${name} shadow ${field}`} value={shadow[field as 'x']} onChange={next => commit(list.map((item, i) => i === index ? serializeShadow({ ...shadow, [field]: next }, text) : item))} />)}</div><TokenInput label={`${name} shadow color`} value={shadow.color} onChange={color => commit(list.map((item, i) => i === index ? serializeShadow({ ...shadow, color }, text) : item))} />{!text && <label className={s.inline}><input aria-label="Inset shadow" type="checkbox" checked={shadow.inset} onChange={event => commit(list.map((item, i) => i === index ? serializeShadow({ ...shadow, inset: event.target.checked }) : item))} />Inset</label>}</div>}
    {!shadow && list.length > 0 && <p className={s.fixtureNote}>This shadow syntax is preserved. Choose a preset to replace it, or add a supported shadow.</p>}
    <div className={text ? s.textPresets : s.shadowPresets}>{(text ? textPresets : boxPresets).map((preset, i) => <button key={preset} aria-label={`${name} shadow preset ${i + 1}`} aria-pressed={value === preset} className={value === preset ? s.selectedPreset : ''} onClick={() => { editor!.apply(design!.targetId, property, preset); setSelected(0); }}>{text ? <><b style={{ textShadow: preset }}>A</b><small>{['Outline', 'Soft', 'Heavy', 'Raised'][i]}</small></> : <span style={{ boxShadow: preset }}>#{i + 1}</span>}</button>)}</div>
  </Section>;
}
export function RichFilters() { return <Section name="Filters"><div className={s.filters}>{filterSpecs.map(spec => <FilterSlider key={spec.name} {...spec} />)}</div></Section>; }
function FilterSlider({ name, label, initial, unit, max }: typeof filterSpecs[number]) {
  const { editor, design, context } = useEditing();
  const current = readFilter(design!.values.filter.presented, name, initial, unit);
  const [value, setValue] = useState(current.value); const pending = useRef<number | null>(null), frame = useRef(0), gesture = useRef('');
  const targetId = design!.targetId, scope = contextKey(context);
  useEffect(() => setValue(current.value), [current.value, targetId, scope]);
  useEffect(() => () => { cancelAnimationFrame(frame.current); pending.current = null; }, [targetId, scope]);
  const flush = () => {
    cancelAnimationFrame(frame.current); frame.current = 0;
    const amount = pending.current; pending.current = null; if (amount === null) return;
    const snapshot = editor!.getSnapshot();
    if (snapshot.design?.targetId !== targetId || contextKey(snapshot.context) !== scope) return;
    editor!.applyBatch(targetId, { filter: updateFilter(snapshot.design.values.filter.presented, name, amount, unit) }, gesture.current, scope);
  };
  return <label className={s.filter}><span>{label}</span><input aria-label={label} title={current.editable ? `${label} filter` : 'Existing complex or repeated function preserved; slider unavailable.'} type="range" disabled={!current.editable} min={0} max={Math.max(max, current.value)} step={name === 'blur' ? 0.1 : 1} value={value} style={{ background: `linear-gradient(to right, var(--accent) ${value / Math.max(max, current.value) * 100}%, var(--control-border) ${value / Math.max(max, current.value) * 100}%)` }} onFocus={() => { gesture.current = crypto.randomUUID(); }} onPointerDown={() => { gesture.current = crypto.randomUUID(); }} onChange={event => { const next = Number(event.target.value); setValue(next); pending.current = next; if (!frame.current) frame.current = requestAnimationFrame(flush); }} onPointerUp={flush} onBlur={flush} /><output>{Number(value.toFixed(2))}{unit}</output></label>;
}
