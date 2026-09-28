import { useState } from 'react';
import { IconButton, type IconName } from '../shared/Icon';
import { Color, Section, Select, Value } from './Controls';
import s from '../ui.module.css';
import { useUI } from '../../state/ui';
import { fixtureFonts } from '../../fixtures/options';
export function TypographyEditor() {
  const [alignment, setAlignment] = useState('left');
  const [decoration, setDecoration] = useState('None');
  const [clip, setClip] = useState(false);
  const font = useUI(state => state.selectedFixtureFont);
  return <Section name="Typography"><div className={s.typography}>
    <Select label="Font family" options={fixtureFonts} selected={font} onSelect={value => useUI.getState().selectFixture('Font', value)} />
    <div className={s.twoColumns}><Select label="Font weight" options={['400 · Normal', '500 · Medium', '600 · Semibold', '700 · Bold']} /><div className={s.inline}><span className={s.muted}>Aᴀ</span><Value label="Font size" initial={18} unit="px" /></div></div>
    <div className={s.twoColumns}><Color /><div className={s.inline}><span className={s.lineHeight}>A</span><Value label="Line height" initial="1.5" /></div></div>
    <div className={s.twoColumns}><div className={s.segmented}>{['left', 'center', 'right', 'justify'].map(align => <IconButton key={align} icon={`align${align[0].toUpperCase()}${align.slice(1)}` as IconName} label={`Align ${align}`} active={alignment === align} onClick={() => setAlignment(align)} />)}</div><div className={s.inline}><span className={s.muted}>|A|</span><Value label="Letter spacing" initial="normal" /></div></div>
    <div className={s.segmented}>{['None', 'Underline', 'Line-through', 'Overline'].map((item, index) => <button className={decoration === item ? s.active : ''} key={item} aria-label={item} aria-pressed={decoration === item} onClick={() => setDecoration(item)} style={{ textDecoration: index ? item.toLowerCase() : 'none' }}>{['–', 'U', 'S', 'S'][index]}</button>)}<button aria-label="Italic" onClick={e => { const button = e.currentTarget; button.setAttribute('aria-pressed', String(button.getAttribute('aria-pressed') !== 'true')); }} aria-pressed="false"><i>I</i></button></div>
    <button role="switch" aria-checked={clip} className={s.switchRow} onClick={() => setClip(!clip)}><span className={`${s.switch} ${clip ? s.switchOn : ''}`} />Use background as text color</button>
  </div></Section>;
}
