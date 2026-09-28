import { useState } from 'react';
import { Icon } from '../shared/Icon';
import { Popover, Options } from '../popovers/Popover';
import { Section, Select, Value, Color } from './Controls';
import { SpacingEditor } from './SpacingEditor';
import { TypographyEditor } from './TypographyEditor';
import { ShadowSection, FilterSection } from './Effects';
import s from '../ui.module.css';
import { useUI } from '../../state/ui';
import { fixtureMedia, fixturePseudo } from '../../fixtures/options';

function ContextControls() {
  const media = useUI(state => state.selectedFixtureMedia);
  const setMedia = (value: string) => useUI.getState().selectFixture('Media', value);
  const pseudo = useUI(state => state.selectedFixturePseudo);
  const setPseudo = (value: string) => useUI.getState().selectFixture('Pseudo', value);
  return <><Popover id="Media" label={<span><span className={s.contextLabel}><Icon name="screen" />Media</span><strong>{media}</strong></span>} className={s.media}><div className={s.menuCaption}>Preview context · fixture</div><Options values={fixtureMedia} value={media} onChange={setMedia}/></Popover><Popover id="State or pseudo" label={<span className={s.inline}><Icon name="target" />State or pseudo <strong>{pseudo}</strong></span>} className={s.pseudo}><div className={s.menuCaption}>State preview · fixture</div><Options values={fixturePseudo} value={pseudo} onChange={setPseudo}/></Popover><div className={s.geometry}><span><i>X</i>36</span><span><i>Y</i>627</span><span><i>∟</i>0°</span><span><i>W</i>100 %</span><span><i>H</i>auto</span><span><i>▢</i>16 px</span></div></>;
}
function BackgroundSection() {
  const [layers, setLayers] = useState(1);
  const [selected, setSelected] = useState(0);
  return <Section name="Background"><button className={s.addButton} onClick={() => setLayers(count => Math.min(count + 1, 4))} disabled={layers >= 4}><Icon name="plus" />Add background layer</button><div className={s.backgroundLayers}>{Array.from({ length: layers }, (_, i) => <div className={s.layer} key={i}><span className={s.layerSwatch} style={{ background: i ? `linear-gradient(135deg,hsl(${selected * 23} 70% 70%),#6476ff)` : '#24262c' }} /><span>{i ? 'Gradient' : '#24262C'}</span><button aria-label={`Remove background layer ${i + 1}`} onClick={() => setLayers(count => count - 1)}>×</button></div>)}</div><div className={s.presetHeading}><Icon name="image" />Presets</div><div className={s.swatches}>{Array.from({ length: 27 }, (_, i) => <button key={i} aria-label={`Background preset ${i + 1}`} aria-pressed={selected === i} style={{ background: `linear-gradient(${130 + i * 5}deg,hsl(${i * 37} 82% 68%),hsl(${i * 37 + 85} 62% 55%))` }} onClick={() => { setSelected(i); setLayers(Math.max(layers, 2)); }} />)}</div></Section>;
}
export function DesignView() {
  return <div className={s.design}><ContextControls /><SpacingEditor /><TypographyEditor /><BackgroundSection />
    <Section name="Display"><div className={s.twoColumns}><Select label="Display mode" options={['flex', 'block', 'inline', 'grid', 'none']} /><div className={s.inline}><Icon name="eye" /><Value label="Opacity" initial={100} unit="%" /></div></div></Section>
    <Section name="Border"><div className={s.stack}><Color label="Border color" /><div className={s.twoColumns}><div className={s.inline}><span className={s.muted}>☰</span><Value label="Border width" initial={0} unit="px" /></div><Select label="Border style" options={['none', 'solid', 'dashed', 'dotted']} /></div></div></Section>
    <Section name="Positioning"><Select label="Position" options={['static', 'relative', 'absolute', 'fixed', 'sticky']} /></Section>
    <ShadowSection /><ShadowSection text /><FilterSection /><p className={s.fixtureNote}>Fixture controls · no page styles are changed</p>
  </div>;
}
