import { describe, expect, it } from 'vitest';
import { deriveChanges, type ChangeOwner } from '../src/editing/changes';
import { serializeChanges, type PreparedTarget } from '../src/export/css';

const context = { media: [], pseudo: '' as const };
const owner = (): ChangeOwner => ({ targetId:'1', label:'button#target', bindingGeneration:0, available:true, root:'document', scopes:[{context, declarations:[{property:'font-size',value:'22px',enabled:true}]}], effects:[] });
const history = [18,20,24].map((value,index)=>({targetId:'1',context,changes:[{property:'font-size',value:`${[20,24,22][index]}px`,baseline:{value:`${value}px`,kind:'computed' as const}}]}));

describe('current changes projection',()=>{
  it('collapses repeated writes using the first proven baseline',()=>{
    const result=deriveChanges([owner()],history);
    expect(result[0].contexts[0].declarations).toHaveLength(1);
    expect(result[0].contexts[0].declarations[0]).toMatchObject({baseline:{value:'18px',kind:'computed'},value:'22px',priority:'important'});
  });
  it('projects Undo and Reset from current ownership rather than history events',()=>{
    const target=owner();target.scopes[0].declarations[0].value='24px';
    expect(deriveChanges([target],history.slice(0,2))[0].contexts[0].declarations[0].value).toBe('24px');
    target.scopes=[];expect(deriveChanges([target],history)).toEqual([]);
    expect(deriveChanges([],[])).toEqual([]);
  });
  it('retains logical identity across migration and separates targets and contexts',()=>{
    const a=owner(),b=owner();a.bindingGeneration=2;b.targetId='2';
    a.scopes.push({context:{media:['(max-width: 600px)'],pseudo:':hover'},declarations:[{property:'font-size',value:'30px',enabled:true}]});
    const result=deriveChanges([a,b],history);
    expect(result).toHaveLength(2);expect(result[0].targetId).toBe('1');expect(result[0].contexts).toHaveLength(2);
    expect(result[0].contexts[1].declarations[0].baseline.kind).toBe('unknown');
  });
  it('keeps disabled rows and the exact shared effectiveness evidence',()=>{
    const a=owner();a.scopes[0].declarations[0].enabled=false;
    const effect={context,property:'font-size',requested:'22px',computed:'18px',state:'blocked' as const,reason:'specificity'};
    a.effects=[effect];
    expect(deriveChanges([a],history)[0].contexts[0].declarations[0]).toMatchObject({enabled:false,effect});
  });
  it('does not replace an unknown original with a later post-edit sample',()=>{
    const entries=[{...history[0],changes:[{property:'font-size',baseline:{kind:'unknown' as const}}]},...history.slice(1)];
    expect(deriveChanges([owner()],entries)[0].contexts[0].declarations[0].baseline).toEqual({kind:'unknown'});
  });
  it('retains individual declarations from a multi-property transaction',()=>{
    const a=owner();a.scopes[0].declarations.push({property:'color',value:'red',enabled:true});
    const entries=[{targetId:'1',context,changes:[{property:'font-size',baseline:{value:'18px',kind:'computed' as const}},{property:'color',baseline:{value:'purple',kind:'authored' as const}}]}];
    expect(deriveChanges([a],entries)[0].contexts[0].declarations.map(row=>row.baseline.value)).toEqual(['18px','purple']);
  });
});

describe('CSS output',()=>{
  const prepare=():PreparedTarget[]=>deriveChanges([owner()],history).map(target=>({...target,selector:'#target',risks:[]}));
  it('serializes exact deterministic CSS with the real session priority',()=>{
    const targets=prepare(),a=serializeChanges(targets);
    expect(a.css).toBe('#target {\n  font-size: 22px !important;\n}\n');
    expect(serializeChanges(targets)).toEqual(a);expect(a.exported).toBe(1);expect(a.omitted).toBe(0);
    expect(a.css).not.toMatch(/data-cssforge|targetId|bindingGeneration/);
  });
  it('preserves nested media order and applies a pseudo suffix once',()=>{
    const targets=prepare();targets[0].selector='#escaped\\:id:hover';
    targets[0].contexts[0].context={media:['screen','(max-width: 600px)'],pseudo:':hover'};
    expect(serializeChanges(targets).css).toBe('@media screen {\n  @media (max-width: 600px) {\n    #escaped\\:id:hover {\n      font-size: 22px !important;\n    }\n  }\n}\n');
  });
  it('omits disabled declarations and explicitly accounts for shadow and unavailable owners',()=>{
    const targets=prepare();targets[0].contexts[0].declarations[0].enabled=false;
    expect(serializeChanges(targets).css).toBe('');
    targets[0].contexts[0].declarations[0].enabled=true;targets[0].root='shadow-root';
    expect(serializeChanges(targets)).toMatchObject({css:'',exported:0,omitted:1});
    targets[0].root='document';targets[0].available=false;
    expect(serializeChanges(targets).issues[0]).toContain('unavailable');
  });
  it('does not confuse an escaped ID suffix with a pseudo',()=>{
    const targets=prepare();targets[0].selector='#target\\:hover';targets[0].contexts[0].context.pseudo=':hover';
    expect(serializeChanges(targets).css).toContain('#target\\:hover:hover {');
  });
  it('preserves declaration, context and target order without alphabetical reordering',()=>{
    const targets=prepare();targets[0].contexts[0].declarations.push({...targets[0].contexts[0].declarations[0],property:'color',value:'red',priority:''});
    targets.push({...targets[0],targetId:'2',selector:'#second'});
    expect(serializeChanges(targets).css).toBe('#target {\n  font-size: 22px !important;\n  color: red;\n}\n\n#second {\n  font-size: 22px !important;\n  color: red;\n}\n');
  });
  it('keeps blocked and unknown declarations with restrained warnings and selector risks',()=>{
    const targets=prepare();targets[0].risks=['position-dependent'];
    targets[0].contexts[0].declarations[0].effect={context,property:'font-size',requested:'22px',state:'blocked',reason:'specificity'};
    const result=serializeChanges(targets);expect(result.exported).toBe(1);expect(result.warnings).toHaveLength(2);expect(result.css).toContain('22px !important');
  });
  it('accounts for unrepresentable selectors and author recovery without invented output',()=>{
    const targets=prepare();targets[0].selector=null;
    expect(serializeChanges(targets)).toMatchObject({css:'',exported:0,omitted:1});
    expect(serializeChanges(targets).issues[0]).toContain('No unique usable selector');
    targets[0].selector='#target';targets[0].contexts[0].declarations[0].provenance='author-recovery';
    expect(serializeChanges(targets).issues[0]).toContain('author recovery');expect(serializeChanges(targets).css).toBe('');
  });
  it('includes unverified expressions as requests rather than browser computed values',()=>{
    const targets=prepare(),row=targets[0].contexts[0].declarations[0];row.property='width';row.value='calc(100px + 30px)';row.effect={context,property:'width',requested:row.value,computed:'130px',state:'unknown',reason:'Unsupported cascade'};
    const output=serializeChanges(targets);expect(output.css).toContain('calc(100px + 30px)');expect(output.css).not.toContain('130px');expect(output.warnings).toHaveLength(1);
  });
});
