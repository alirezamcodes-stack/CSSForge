import { useEffect, useRef, useState } from 'react';
import { useEditing, useInspection } from '../../picker/context';
import { contextKey } from '../../editing/contexts';
import { contextLabel, declarationCount } from '../../editing/changes';
import { copyCSS, downloadCSS, outputSummary } from '../../export/actions';
import type { CSSOutput } from '../../export/css';
import { Surface } from '../shared/Surface';
import { EditEffectiveness } from '../shared/EditEffectiveness';
import { SessionActions } from '../design/EditControls';
import s from './liveChanges.module.css';

export function LiveChangesSurface() {
  const {picker}=useInspection(),{changes}=useEditing();
  const [feedback,setFeedback]=useState(''),[output,setOutput]=useState<CSSOutput|null>(null),[busy,setBusy]=useState(false);
  const pending=useRef(false),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;picker?.setChangesReview(true);return()=>{mounted.current=false;picker?.setChangesReview(false);};},[picker]);
  const signature=JSON.stringify(changes.map(target=>[target.targetId,target.bindingGeneration,target.available,target.contexts.map(scope=>[scope.context,scope.declarations.map(row=>[row.property,row.value,row.enabled])])]));
  useEffect(()=>{setOutput(null);setFeedback('');},[signature]);
  async function act(kind:'copy'|'export',targetId?:string) {
    if(!picker||pending.current)return;
    pending.current=true;setBusy(true);
    try {
      // Preparation remains synchronous inside the actual trusted button gesture.
      const result=picker.prepareChanges(targetId);setOutput(result);
      if(!result.css){setFeedback('No representable active declarations.');return;}
      if(kind==='copy'){await copyCSS(result.css);if(mounted.current)setFeedback(`Copied CSS · ${outputSummary(result)}`);}
      else{downloadCSS(result.css);setFeedback(`Exported ${outputSummary(result)}`);}
    }catch{if(mounted.current)setFeedback(kind==='copy'?'Copy failed. Clipboard unavailable in this page context.':'Export failed.');}
    finally{pending.current=false;if(mounted.current)setBusy(false);}
  }
  const active=changes.some(target=>target.contexts.some(scope=>scope.declarations.some(row=>row.enabled)));
  const targetLabel=(target:typeof changes[number])=>target.label+(changes.filter(item=>item.label===target.label).length>1?` (target ${target.targetId})`:'');
  return <Surface title="Changes" subtitle={`${changes.length} edited elements · ${declarationCount(changes)} current declarations · current session`} wide>
    <div className={s.toolbar}><SessionActions /><div className={s.buttons}>
      <button disabled={!active||busy} onClick={()=>void act('copy')}>Copy all CSS</button>
      <button disabled={!active||busy} onClick={()=>void act('export')}>Export CSS</button>
    </div></div>
    <p className={s.note}>Current owned declarations. Original values are captured before the first edit where known. Copy includes enabled session declarations with their !important priority; selectors are prepared on request.</p>
    <p className={s.feedback} role="status" aria-live="polite">{feedback}</p>
    {output&&<div className={s.notices}>{[...output.issues,...output.warnings].map((notice,index)=><p key={index}>{notice}</p>)}</div>}
    <div className={s.groups} data-testid="live-changes">
      {!changes.length?<p>No session changes yet.</p>:changes.map(target=><article key={target.targetId} className={s.group} data-change-target={target.targetId}>
        <header><h3>{targetLabel(target)}</h3><button disabled={busy||!target.available||target.root==='shadow-root'||!target.contexts.some(scope=>scope.declarations.some(row=>row.enabled&&row.provenance==='session'))} onClick={()=>void act('copy',target.targetId)} aria-label={`Copy target CSS for ${targetLabel(target)}`}>Copy target CSS</button></header>
        {target.root==='shadow-root'&&<p className={s.note}>Shadow DOM: flat document CSS cannot reach this target. Copy and export exclude its declarations.</p>}
        {!target.available&&<p className={s.note}>Target unavailable. No selector is inferred from its old identity.</p>}
        {target.contexts.map(scope=><section key={contextKey(scope.context)} aria-label={contextLabel(scope.context)}>
          <h4>{contextLabel(scope.context)}</h4>
          {scope.declarations.map(row=><div key={`${row.provenance}:${row.property}`} className={s.row} data-change-property={row.property}>
            <strong className={s.property}>{row.property}</strong>
            <div className={s.values}><span>Original{row.baseline.kind!=='unknown'?` (${row.baseline.kind})`:''}: <code>{row.baseline.value??'Unknown'}</code></span><span>{row.provenance==='session'?'Current requested':'Recorded current'}: <code>{row.value||'(absent)'}</code>{row.priority?' !'+row.priority:''}</span></div>
            <div className={s.state}><span>{row.enabled?'Enabled':'Disabled · omitted from CSS'} · {row.provenance==='session'?'Session override':'Author recovery · excluded from CSS'}</span>
              {row.provenance==='session'&&(row.effect?<EditEffectiveness effect={row.effect}/>:<span>Applied · unverified · Effect evidence unavailable.</span>)}
              {row.effect?.computed&&row.effect.computed!==row.value&&<span>Browser: <code>{row.effect.computed}</code></span>}
            </div>
          </div>)}
        </section>)}
      </article>)}
    </div>
    <p className={s.note}>Edits last for this activation. Reset or deactivate removes session overrides. Copied CSS may need adjustment on a different page or after structural changes.</p>
  </Surface>;
}
