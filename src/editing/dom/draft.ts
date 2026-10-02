/** Textareas expose LF. Preserve original CR/CRLF in unchanged draft regions. */
export function updateTextDraft(previous:string,next:string):string {
  const normalized=previous.replace(/\r\n?/g,'\n');
  if(normalized===next)return previous;
  let start=0,end=0;
  while(start<normalized.length&&start<next.length&&normalized[start]===next[start])start++;
  while(end<normalized.length-start&&end<next.length-start&&normalized[normalized.length-1-end]===next[next.length-1-end])end++;
  const offsets=[0];
  for(let index=0;index<previous.length;){if(previous[index++]==='\r'&&previous[index]==='\n')index++;offsets.push(index);}
  return previous.slice(0,offsets[start])+next.slice(start,next.length-end)+previous.slice(offsets[normalized.length-end]);
}
