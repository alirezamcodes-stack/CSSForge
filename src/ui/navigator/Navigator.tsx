import { DOMTree } from '../html/HTMLView';
import { Surface } from '../shared/Surface';
import { Icon } from '../shared/Icon';
import { useUI } from '../../state/ui';
import s from '../ui.module.css';
export function Navigator() {
  return <Surface title="Navigator" subtitle="Document hierarchy"><div className={s.navigatorTree}><DOMTree /></div><footer className={s.surfaceFooter}><button className={s.outlineButton} onClick={() => useUI.getState().setSurface(null)}><Icon name="back" />Back to canvas</button><div className={s.navigatorContext}><Icon name="target" /><span>Fixture selection<small>Node selection previews this tree only</small></span></div></footer></Surface>;
}
