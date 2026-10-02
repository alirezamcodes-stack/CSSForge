import { useId, useState } from 'react';
import { useEditing } from '../../picker/context';
import { useUI } from '../../state/ui';
import { Surface } from '../shared/Surface';
import type { TextFailure } from '../../editing/dom';
import { updateTextDraft } from '../../editing/dom/draft';
import s from './inlineText.module.css';
import common from '../ui.module.css';

/** Mounted only inside the explicit Inspector menu, never on pointer hover. */
export function EditTextAction() {
  const {editor,design}=useEditing(),reasonId=useId();
  const [availability]=useState(()=>editor?.prepareText());
  const available=availability&&'node' in availability&&design?.targetId===availability.targetId&&design.bindingGeneration===availability.bindingGeneration;
  const reason=availability&&'reason' in availability?availability.reason:available?'':'Select an available element first.';
  return <><button className={common.menuOption} disabled={!available} aria-describedby={!available?reasonId:undefined} onClick={()=>useUI.getState().setSurface('text')}>Edit text</button>{!available&&<p id={reasonId} className={s.reason}>{reason}</p>}</>;
}

export function InlineTextEditor() {
  const {editor,design}=useEditing();
  const [prepared]=useState(()=>editor?.prepareText());
  const plan=prepared&&'node' in prepared?prepared:null;
  const [draft,setDraft]=useState(plan?.before??''),[failure,setFailure]=useState<TextFailure|null>(prepared&&'state' in prepared?prepared:null);
  const id=useId(),stale=!!plan&&(!design||design.targetId!==plan.targetId||design.bindingGeneration!==plan.bindingGeneration);
  const close=()=>useUI.getState().setSurface(null);
  const apply=()=>{
    if(!editor||!plan||stale)return;
    const result=editor.applyText(plan,draft);
    if(result.state==='applied'||result.state==='unchanged')close();
    else setFailure(result);
  };
  const error=stale?'STALE · The target binding changed. Cancel and reopen the editor.':failure?`${failure.state} · ${failure.reason}`:'';
  return <Surface title="Edit text" subtitle="Exact text node · explicit Apply" compact>
    <div className={s.editor}>
      <label htmlFor={id}>Text content</label>
      <textarea id={id} value={draft} disabled={!plan||stale} aria-describedby={`${id}-hint ${id}-error`} aria-invalid={!!error} dir="auto" spellCheck={false} onChange={event=>setDraft(previous=>updateTextDraft(previous,event.target.value))} onKeyDown={event=>{
        if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)&&!event.nativeEvent.isComposing){event.preventDefault();apply();}
      }}/>
      <p id={`${id}-hint`}>Spaces and existing line breaks are preserved. Enter adds a line. Ctrl/⌘ + Enter applies. Escape cancels. Text changes are excluded from CSS copy and export.</p>
      <p id={`${id}-error`} role="status" aria-live="polite">{error}</p>
      <div className={s.actions}><button type="button" onClick={close}>Cancel</button><button type="button" disabled={!plan||stale} onClick={apply}>Apply text</button></div>
    </div>
  </Surface>;
}
