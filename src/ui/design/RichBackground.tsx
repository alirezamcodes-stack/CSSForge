import { useEffect, useState } from 'react';
import { useEditing } from '../../picker/context';
import { backgroundLayers, parseGradient, serializeGradient, safeImageURL, hiddenImage, originalImage, type BackgroundLayer } from '../../editing/rich';
import { Section } from './Controls';
import { EditField } from './EditControls';
import { TokenInput, Choice } from './RichControls';
import { Icon, IconButton } from '../shared/Icon';
import { NumericScrubber } from '../shared/NumericScrubber';
import { ColorControl } from '../shared/ColorControl';
import { backgroundPresets } from '../../editing/presets';
import s from '../ui.module.css';

const linear = 'linear-gradient(135deg, #98deb7 0%, #6476ff 100%)';
const radial = 'radial-gradient(ellipse at center, #98deb7 0%, #6476ff 100%)';
export function RichBackground() {
  const { editor, design } = useEditing(); const [selected, setSelected] = useState(0); const [urlError, setURLError] = useState(''); const [urlMode, setURLMode] = useState(false);
  const [selectedStop, setSelectedStop] = useState(0);
  const values = design!.values;
  const layers = backgroundLayers({ image: values['background-image'].presented, position: values['background-position'].presented, size: values['background-size'].presented, repeat: values['background-repeat'].presented });
  const index = Math.min(selected, Math.max(0, layers.length - 1)), layer = layers[index];
  const original = layer && originalImage(layer.image), visibleImage = original ?? layer?.image ?? '';
  const gradient = parseGradient(visibleImage);
  const isURL = /^url\(/.test(visibleImage);
  useEffect(() => { setURLMode(false); setURLError(''); }, [visibleImage, index]);
  const commit = (next: BackgroundLayer[], gesture?: string) => editor!.applyBatch(design!.targetId, {
    'background-image': next.map(item => item.image).join(', ') || 'none',
    'background-position': next.map(item => item.position).join(', ') || '0% 0%',
    'background-size': next.map(item => item.size).join(', ') || 'auto',
    'background-repeat': next.map(item => item.repeat).join(', ') || 'repeat',
  }, gesture);
  const update = (patch: Partial<BackgroundLayer>, gesture?: string) => commit(layers.map((item, i) => i === index ? { ...item, ...patch } : item), gesture);
  const image = (value: string, gesture?: string) => update({ image: original ? hiddenImage(value) : value }, gesture);
  const add = (value = linear) => { if (commit([...layers, { image: value, position: 'center', size: 'auto', repeat: 'no-repeat' }])) setSelected(layers.length); };
  const move = (from: number, to: number) => { const next = [...layers]; [next[from], next[to]] = [next[to], next[from]]; if (commit(next)) setSelected(to); };
  return <Section name="Background"><EditField color property="background-color" label="Background color" /><button className={s.addButton} onClick={() => add()}><Icon name="plus" />Add background layer</button>
    <div className={s.backgroundLayers}>{layers.map((item, i) => <div className={`${s.layer} ${i === index ? s.chosenLayer : ''}`} key={i}>
      <button className={s.layerSelect} aria-label={`Select background layer ${i + 1}`} aria-pressed={i === index} onClick={() => setSelected(i)}><span className={s.layerSwatch} style={{ backgroundImage: item.image }} /><span>Layer {i + 1} · {parseGradient(originalImage(item.image) ?? item.image)?.type ?? 'image'}</span></button>
      <IconButton icon="up" label={`Move background layer ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)} /><IconButton icon="down" label={`Move background layer ${i + 1} down`} disabled={i === layers.length - 1} onClick={() => move(i, i + 1)} />
      <IconButton icon={originalImage(item.image) ? 'eyeOff' : 'eye'} label={`${originalImage(item.image) ? 'Show' : 'Hide'} background layer ${i + 1}`} onClick={() => commit(layers.map((other, at) => at === i ? { ...other, image: originalImage(item.image) ?? hiddenImage(item.image) } : other))} />
      <IconButton icon="close" label={`Remove background layer ${i + 1}`} onClick={() => commit(layers.filter((_, at) => at !== i))} />
    </div>)}</div>
    {layer && <div className={s.richDetails}>
      <Choice label="Background layer type" value={urlMode || isURL ? 'Image URL' : gradient?.type ?? 'Existing CSS'} options={['linear', 'radial', 'Image URL']} onChange={type => { setURLMode(type === 'Image URL'); if (type !== 'Image URL') image(type === 'linear' ? linear : radial); }} />
      {(urlMode || isURL) && <TokenInput label="Image URL" value={visibleImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1] ?? ''} onChange={value => { const next = safeImageURL(value, location.href); if (next) { setURLError(''); image(next); } else setURLError('Use an HTTP(S) image URL.'); }} />}
      {!gradient && !isURL && !urlMode && <p className={s.fixtureNote}>Existing image syntax is preserved. Choose a supported layer type to replace it.</p>}
      {gradient && !urlMode && <>
        {gradient.type === 'linear' ? <label className={s.fieldLabel}><span>Angle / direction</span><NumericScrubber label="Gradient direction" value={gradient.direction} defaultUnit="deg" units={['deg', 'turn', 'rad']} onChange={(direction, gesture) => image(serializeGradient({ ...gradient, direction }), gesture)} /></label> : <TokenInput label="Gradient shape / position" value={gradient.direction} onChange={direction => image(serializeGradient({ ...gradient, direction }))} />}
        <div className={s.gradientTrack} style={{ background: `linear-gradient(to right, ${gradient.stops.map(stop => `${stop.color} ${stop.position}`).join(', ')})` }} aria-label="Gradient stop track">{gradient.stops.map((stop, i) => <button key={i} aria-label={`Select gradient stop ${i + 1}`} aria-pressed={selectedStop === i} title={`Stop ${i + 1} · ${stop.position || 'auto'}`} style={{ left: `${stop.position.endsWith('%') ? Math.max(0, Math.min(100, parseFloat(stop.position))) : i / (gradient.stops.length - 1) * 100}%`, backgroundColor: stop.color }} onClick={() => setSelectedStop(i)} />)}</div>
        <div className={s.gradientStops}>{gradient.stops.map((stop, i) => <div className={s.stopRow} data-selected={i === selectedStop} key={i}><ColorControl label={`Stop ${i + 1} color`} value={stop.color} onChange={(color, gesture) => image(serializeGradient({ ...gradient, stops: gradient.stops.map((other, at) => at === i ? { ...other, color } : other) }), gesture)} /><NumericScrubber label={`Stop ${i + 1} position`} value={stop.position || `${Number((i / (gradient.stops.length - 1) * 100).toFixed(1))}%`} defaultUnit="%" units={['%', 'px', 'em', 'rem']} onChange={(position, gesture) => image(serializeGradient({ ...gradient, stops: gradient.stops.map((other, at) => at === i ? { ...other, position } : other) }), gesture)} /><IconButton icon="close" label={`Remove gradient stop ${i + 1}`} disabled={gradient.stops.length <= 2} onClick={() => image(serializeGradient({ ...gradient, stops: gradient.stops.filter((_, at) => at !== i) }))} /></div>)}</div>
        <button className={s.addButton} onClick={() => image(serializeGradient({ ...gradient, stops: [...gradient.stops, { color: '#ffffff', position: '100%' }] }))}><Icon name="plus" />Add gradient stop</button>
        <div className={s.gradientCommands}><button onClick={() => image(serializeGradient({ ...gradient, stops: gradient.stops.map((stop, i) => ({ ...stop, position: `${Number((i / (gradient.stops.length - 1) * 100).toFixed(2))}%` })) }))}>Distribute stops</button><button disabled={gradient.stops.some(stop => stop.position && !stop.position.endsWith('%'))} onClick={() => image(serializeGradient({ ...gradient, stops: [...gradient.stops].reverse().map(stop => ({ ...stop, position: stop.position ? `${100 - parseFloat(stop.position)}%` : '' })) }))}>Reverse gradient</button></div>
      </>}
      <div className={s.twoColumns}><TokenInput label="Background position" value={layer.position} onChange={position => update({ position })} /><TokenInput label="Background size" value={layer.size} onChange={size => update({ size })} /></div>
      <Choice label="Background repeat" value={layer.repeat} options={['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'space', 'round']} onChange={repeat => update({ repeat })} />
      {urlError && <p className={s.editError} role="alert">{urlError}</p>}
    </div>}
    <details className={s.presetDisclosure}><summary><Icon name="image" />Background presets<Icon name="chevron" /></summary>{[...new Set(backgroundPresets.map(preset => preset.group))].map(group => <div className={s.presetGroup} key={group}><h4>{group}</h4><div className={s.curatedBackgrounds}>{backgroundPresets.filter(preset => preset.group === group).map(preset => <button key={preset.name} title={preset.name} aria-label={`Background preset ${preset.name}`} style={{ background: preset.css }} onClick={() => layer ? image(preset.css) : add(preset.css)} />)}</div></div>)}</details>
  </Section>;
}
