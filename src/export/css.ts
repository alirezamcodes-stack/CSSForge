import type { ChangeTarget } from '../editing/changes';
export type PreparedTarget = ChangeTarget & {selector?:string|null; risks:string[]};
export type CSSOutput = {css:string;exported:number;omitted:number;warnings:string[];issues:string[];domOmitted?:number;structureOmitted?:number};
function terminalPseudo(selector:string,pseudo:string) {
  if(!pseudo||!selector.endsWith(pseudo))return false;
  let escapes=0,index=selector.length-pseudo.length-1;
  while(index>=0&&selector[index--]==='\\')escapes++;
  return escapes%2===0;
}

/** Pure serialization of explicitly prepared, validated identities; never reads the DOM. */
export function serializeChanges(targets:PreparedTarget[]):CSSOutput {
  const blocks:string[]=[],warnings:string[]=[],issues:string[]=[];let exported=0,omitted=0;
  for(const target of targets) {
    const active=target.contexts.flatMap(scope=>scope.declarations.filter(row=>row.enabled));
    if(!active.length) continue;
    const reason=!target.available?'Target unavailable':target.root==='shadow-root'?'Shadow DOM requires root-local CSS; flat document CSS cannot reach this target':!target.selector?'No unique usable selector':undefined;
    if(reason){omitted+=active.length;issues.push(`${target.label}: ${reason}.`);continue;}
    for(const risk of target.risks) warnings.push(`${target.label}: selector ${risk}.`);
    for(const scope of target.contexts) {
      const rows=scope.declarations.filter(row=>row.enabled);
      const supported=rows.filter(row=>row.provenance==='session');
      const unsupported=rows.length-supported.length;
      if(unsupported){omitted+=unsupported;issues.push(`${target.label}: author recovery records require source-aware rollback; excluded from session CSS.`);}
      if(!supported.length) continue;
      for(const row of supported) if(!row.effect||row.effect.state==='blocked'||row.effect.state==='unknown') warnings.push(`${target.label} ${row.property}: ${row.effect?.reason??'Effect not verified'}.`);
      // Generated selectors describe the element. A matching terminal pseudo is never doubled.
      const pseudo=scope.context.pseudo,selector=target.selector!+(pseudo&&!terminalPseudo(target.selector!,pseudo)?pseudo:'');
      let lines=[`${selector} {`,...supported.map(row=>`  ${row.property}: ${row.value}${row.priority?' !'+row.priority:''};`),'}'];
      for(const query of [...scope.context.media].reverse()) lines=[`@media ${query} {`,...lines.map(line=>'  '+line),'}'];
      blocks.push(lines.join('\n'));exported+=supported.length;
    }
  }
  const domOmitted=targets.reduce((sum,target)=>sum+(target.texts?.length??0),0);
  const structureOmitted=targets.reduce((sum,target)=>sum+(target.structures?.length??0),0);
  return {css:blocks.length?blocks.join('\n\n')+'\n':'',exported,omitted,warnings,issues,...(domOmitted?{domOmitted}:{}),...(structureOmitted?{structureOmitted}:{})};
}
