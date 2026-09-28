import { useEffect, useState } from 'react';
import { useEditing } from '../../picker/context';
import { backgroundLayers, parseGradient, serializeGradient, safeImageURL, hiddenImage, originalImage, type BackgroundLayer } from '../../editing/rich';
import { Section } from './Controls';
import { EditField } from './EditControls';
import { TokenInput, Choice } from './RichControls';
import { Icon } from '../shared/Icon';
import s from '../ui.module.css';

const linear = 'linear-gradient(135deg, #98deb7 0%, #6476ff 100%)';
const radial = 'radial-gradient(ellipse at center, #98deb7 0%, #6476ff 100%)';
export function RichBackground() {
  const { editor, design } = useEditing(); const [selected, setSelected] = useState(0); const [urlError, setURLError] = useState(''); const [urlMode, setURLMode] = useState(false);
  const values = design!.values;
  const layers = backgroundLayers({ image: values['background-image'].presented, position: values['background-position'].presented, size: values['background-size'].presented, repeat: values['background-repeat'].presented });
  const index = Math.min(selected, Math.max(0, layers.length - 1)), layer = layers[index];
  const original = layer && originalImage(layer.image), visibleImage = original ?? layer?.image ?? '';
  const gradient = parseGradient(visibleImage);
  const isURL = /^url\(/.test(visibleImage);
  useEffect(() => { setURLMode(false); setURLError(''); }, [visibleImage, index]);
  const commit = (next: BackgroundLayer[]) => editor!.applyBatch(design!.targetId, {
    'background-image': next.map(item => item.image).join(', ') || 'none',
    'background-position': next.map(item => item.position).join(', ') || '0% 0%',
    'background-size': next.map(item => item.size).join(', ') || 'auto',
    'background-repeat': next.map(item => item.repeat).join(', ') || 'repeat',
  });
  const update = (patch: Partial<BackgroundLayer>) => commit(layers.map((item, i) => i === index ? { ...item, ...patch } : item));
  const image = (value: string) => update({ image: original ? hiddenImage(value) : value });
  const add = (value = linear) => { if (commit([...layers, { image: value, position: 'center', size: 'auto', repeat: 'no-repeat' }])) setSelected(layers.length); };
  const move = (from: number, to: number) => { const next = [...layers]; [next[from], next[to]] = [next[to], next[from]]; if (commit(next)) setSelected(to); };
  return <Section name="Background"><EditField color property="background-color" label="Background color" /><button className={s.addButton} onClick={() => add()}><Icon name="plus" />Add background layer</button>
    <div className={s.backgroundLayers}>{layers.map((item, i) => <div className={`${s.layer} ${i === index ? s.chosenLayer : ''}`} key={i}>
      <button className={s.layerSelect} aria-label={`Select background layer ${i + 1}`} aria-pressed={i === index} onClick={() => setSelected(i)}><span className={s.layerSwatch} style={{ backgroundImage: item.image }} />Layer {i + 1}</button>
      <button aria-label={`Move background layer ${i + 1} up`} disabled={i === 0} onClick={() => move(i, i - 1)}>↑</button><button aria-label={`Move background layer ${i + 1} down`} disabled={i === layers.length - 1} onClick={() => move(i, i + 1)}>↓</button>
      <button aria-label={`${originalImage(item.image) ? 'Show' : 'Hide'} background layer ${i + 1}`} onClick={() => commit(layers.map((other, at) => at === i ? { ...other, image: originalImage(item.image) ?? hiddenImage(item.image) } : other))}><Icon name="eye" /></button>
      <button aria-label={`Remove background layer ${i + 1}`} onClick={() => commit(layers.filter((_, at) => at !== i))}>×</button>
    </div>)}</div>
    {layer && <div className={s.richDetails}>
      <Choice label="Background layer type" value={urlMode || isURL ? 'Image URL' : gradient?.type ?? 'Existing CSS'} options={['linear', 'radial', 'Image URL']} onChange={type => { setURLMode(type === 'Image URL'); if (type !== 'Image URL') image(type === 'linear' ? linear : radial); }} />
      {(urlMode || isURL) && <TokenInput label="Image URL" value={visibleImage.match(/^url\(["']?(.*?)["']?\)$/)?.[1] ?? ''} onChange={value => { const next = safeImageURL(value, location.href); if (next) { setURLError(''); image(next); } else setURLError('Use an HTTP(S) image URL.'); }} />}
      {!gradient && !isURL && !urlMode && <p className={s.fixtureNote}>Existing image syntax is preserved. Choose a supported layer type to replace it.</p>}
      {gradient && !urlMode && <>
        <TokenInput label={gradient.type === 'linear' ? 'Gradient direction' : 'Gradient shape / position'} value={gradient.direction} onChange={direction => image(serializeGradient({ ...gradient, direction: gradient.type === 'linear' && /^[-+\d.]+$/.test(direction) ? `${direction}deg` : direction }))} />
        {gradient.stops.map((stop, i) => <div className={s.stopRow} key={i}><TokenInput label={`Stop ${i + 1} color`} value={stop.color} onChange={color => image(serializeGradient({ ...gradient, stops: gradient.stops.map((other, at) => at === i ? { ...other, color } : other) }))} /><TokenInput label={`Stop ${i + 1} position`} value={stop.position} onChange={position => image(serializeGradient({ ...gradient, stops: gradient.stops.map((other, at) => at === i ? { ...other, position: /^[-+\d.]+$/.test(position) ? `${position}%` : position } : other) }))} /><button aria-label={`Remove gradient stop ${i + 1}`} disabled={gradient.stops.length <= 2} onClick={() => image(serializeGradient({ ...gradient, stops: gradient.stops.filter((_, at) => at !== i) }))}>×</button></div>)}
        <button className={s.addButton} onClick={() => image(serializeGradient({ ...gradient, stops: [...gradient.stops, { color: '#ffffff', position: '100%' }] }))}><Icon name="plus" />Add gradient stop</button>
      </>}
      <div className={s.twoColumns}><TokenInput label="Background position" value={layer.position} onChange={position => update({ position })} /><TokenInput label="Background size" value={layer.size} onChange={size => update({ size })} /></div>
      <Choice label="Background repeat" value={layer.repeat} options={['no-repeat', 'repeat', 'repeat-x', 'repeat-y', 'space', 'round']} onChange={repeat => update({ repeat })} />
      {urlError && <p className={s.editError} role="alert">{urlError}</p>}
    </div>}
    <div className={s.presetHeading}><Icon name="image" />Presets</div><div className={s.swatches}>{Array.from({ length: 9 }, (_, i) => { const value = `linear-gradient(135deg, hsl(${i * 37} 82% 68%), hsl(${i * 37 + 85} 62% 55%))`; return <button key={i} aria-label={`Background preset ${i + 1}`} style={{ background: value }} onClick={() => layer ? image(value) : add(value)} />; })}</div>
  </Section>;
}
