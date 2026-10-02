import { expect, it } from 'vitest';
import { serializeChanges } from '../src/export/css';
import { outputSummary } from '../src/export/actions';
import { domChangeCount, textChangeCount, structureChangeCount, type ChangeTarget } from '../src/editing/changes';
it('reports separate text and structure omissions with no HTML serialization or invented CSS',()=>{
  const target:ChangeTarget={targetId:'1',label:'button',bindingGeneration:0,root:'document',available:true,contexts:[],
    texts:[{kind:'DOM_TEXT_MUTATION',before:'A',applied:'B',current:'B',bindingGeneration:0,available:true,state:'applied'}],
    structures:[{kind:'DOM_INSERT',label:'<div>',location:'after button',state:'applied'},{kind:'DOM_DELETE',label:'<p>',location:'detached',state:'CONFLICT',reason:'Changed anchors'}]};
  const output=serializeChanges([{...target,risks:[]}]);expect(output.css).toBe('');expect(output.exported).toBe(0);expect(output.domOmitted).toBe(1);expect(output.structureOmitted).toBe(2);
  expect(outputSummary(output)).toContain('1 DOM changes omitted (text)');expect(outputSummary(output)).toContain('2 structure changes omitted');
  expect(domChangeCount([target])).toBe(3);expect(textChangeCount([target])).toBe(1);expect(structureChangeCount([target])).toBe(2);
});
