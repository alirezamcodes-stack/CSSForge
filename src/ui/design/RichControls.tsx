import { useEffect, useRef, useState } from 'react';
import { useEditing } from '../../picker/context';
import { contextKey, pseudos } from '../../editing/contexts';
import { Popover, Options } from '../popovers/Popover';
import { Icon } from '../shared/Icon';
import s from '../ui.module.css';

export function TokenInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const focused = useRef(false);
  useEffect(() => { if (!focused.current) setDraft(value); }, [value]);
  return <label className={s.richInput}><span>{label}</span><input aria-label={label} value={draft} spellCheck={false} onFocus={() => { focused.current = true; }} onBlur={() => { focused.current = false; setDraft(value); }} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); event.currentTarget.blur(); } }} onChange={event => { setDraft(event.target.value); onChange(event.target.value); }} /></label>;
}
export function Choice({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <Popover id={label} label={value}><div className={s.menuCaption}>{label}</div><Options value={value} values={options} onChange={onChange} /></Popover>;
}
const stateLabel = (pseudo: string) => pseudo || 'None / current';
export function RichContextControls() {
  const { editor, context, mediaContexts, mediaLimited } = useEditing();
  const media = context.media.length ? context.media.join(' ∧ ') : 'Base · all viewports';
  return <>
    <Popover id="Media" className={s.media} label={<span><span className={s.contextLabel}><Icon name="screen" />Media</span><strong>{media}</strong></span>}>
      <div className={s.menuCaption}>Editing context</div>
      <button className={s.menuOption} aria-pressed={!context.media.length} onClick={() => editor?.setContext({ ...context, media: [] })}>Base · all viewports</button>
      {mediaContexts.map(item => <button key={JSON.stringify(item.queries)} className={s.menuOption} aria-pressed={JSON.stringify(item.queries) === JSON.stringify(context.media)} onClick={() => editor?.setContext({ ...context, media: item.queries })}><span>{item.queries.join(' ∧ ')}<small className={s.contextSource}>{item.source} · {item.queries.every(query => matchMedia(query).matches) ? 'matches viewport' : 'inactive at this viewport'}</small></span></button>)}
      <p className={s.menuNote}>{mediaContexts.length ? 'Matching readable rules, not winning-rule provenance. Conditional edits remain separate from base edits.' : 'No relevant readable media rules were found. Only base editing is available.'}{mediaLimited && ' Some rules are inaccessible or outside the bounded discovery scope.'}</p>
    </Popover>
    <Popover id="State or pseudo" className={`${s.pseudo} ${context.pseudo.startsWith('::') ? s.generatedContext : ''}`} label={<span className={s.inline}><Icon name="target" />State or pseudo <strong>{stateLabel(context.pseudo)}</strong></span>}>
      <div className={s.menuCaption}>CSS rule context · no forcing</div>
      {pseudos.map(pseudo => <button key={pseudo} className={s.menuOption} aria-pressed={pseudo === context.pseudo} onClick={() => editor?.setContext({ ...context, pseudo })}>{stateLabel(pseudo)}</button>)}
      <p className={s.menuNote}>Interactive rules apply only on actual browser hover, focus or active state. Before/after edits style existing generated content; they do not create it.</p>
    </Popover>
    {(context.media.length > 0 || context.pseudo) && <p className={s.fixtureNote} data-testid="context-note">Editing {context.media.length ? 'conditional' : 'base'} {stateLabel(context.pseudo)} rules. Browser values reflect the current rendered state.</p>}
  </>;
}
export { contextKey };
