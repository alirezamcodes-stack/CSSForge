import type { CSSOutput } from './css';
export const exportFilename='cssforge-changes.css';
export const outputSummary=(output:CSSOutput)=>`${output.exported} declarations included · ${output.omitted} not representable${output.domOmitted?` · ${output.domOmitted} DOM changes omitted (text)`:''}${output.structureOmitted?` · ${output.structureOmitted} structure changes omitted`:''}${output.warnings.length?` · ${output.warnings.length} warnings`:''}`;
export async function copyCSS(css:string,clipboard:Pick<Clipboard,'writeText'>=navigator.clipboard) {
  if(!css) throw new Error('No representable active declarations.');
  await clipboard.writeText(css);
}
export function downloadCSS(css:string,doc:Document=document) {
  if(!css) throw new Error('No representable active declarations.');
  const win=doc.defaultView!;
  const url=win.URL.createObjectURL(new Blob([css],{type:'text/css;charset=utf-8'}));
  const anchor=doc.createElement('a');anchor.href=url;anchor.download=exportFilename;anchor.hidden=true;
  try{(doc.body??doc.documentElement).append(anchor);anchor.click();}
  finally{anchor.remove();win.setTimeout(()=>win.URL.revokeObjectURL(url),1000);}
}
