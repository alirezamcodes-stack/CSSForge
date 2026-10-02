import { test, expect } from '@playwright/test';
import { launch, html } from './mutationHarness';
import { pick } from './extensionHarness';

test('09A domain first: one CSS/text transaction order, reverse Undo and safe Reset',async({},info)=>{
  const r=await launch(info,html('#target{color:purple;padding-left:2px}'));
  try {
    await pick(r.page,'#target');
    await r.read(`(()=>{const e=__p.editor,id=e.getSnapshot().design.targetId;e.apply(id,'color','red');const p=e.prepareText();e.applyText(p,'New');e.apply(id,'padding-left','20px');return true})()`);
    expect((await r.status()).undo).toBe(3);await expect(r.page.locator('#target')).toHaveText('New');
    await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('padding-left','2px');await expect(r.page.locator('#target')).toHaveText('New');
    await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveText('Target');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(255, 0, 0)');
    await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');expect((await r.status()).undo).toBe(0);
    await r.read(`(()=>{const e=__p.editor,id=e.getSnapshot().design.targetId;e.applyText(e.prepareText(),'One');e.apply(id,'color','red');e.applyText(e.prepareText(),'Two');e.reset();return true})()`);
    await expect(r.page.locator('#target')).toHaveText('Target');expect((await r.status()).undo).toBe(0);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A domain first: host conflict retains Undo while Reset removes safe CSS',async({},info)=>{
  const r=await launch(info);
  try {
    await pick(r.page,'#target');await r.read(`(()=>{const e=__p.editor;e.apply(e.getSnapshot().design.targetId,'color','red');e.applyText(e.prepareText(),'New');return true})()`);
    await r.page.locator('#target').evaluate(node=>{node.firstChild!.nodeValue='Host';});
    await expect.poll(()=>r.read(`__p.editor.getSnapshot().changes[0].texts[0].state`)).toBe('CONFLICT');
    await r.read('__p.editor.undo();true');expect((await r.status()).undo).toBe(2);await expect(r.page.locator('#target')).toHaveText('Host');
    await r.read('__p.editor.reset();true');expect((await r.status()).undo).toBe(1);await expect(r.page.locator('#target')).toHaveText('Host');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(128, 0, 128)');expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A blocked newest text prevents Reset/deactivation from restoring older equal-value records',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');await r.read(`(()=>{const e=__p.editor;e.applyText(e.prepareText(),'One');e.applyText(e.prepareText(),'Two');return true})()`);
    await r.page.locator('#target').evaluate(node=>{node.firstChild!.nodeValue='One';});
    await r.read('__p.editor.reset();true');await expect(r.page.locator('#target')).toHaveText('One');expect((await r.status()).undo).toBe(2);
    await r.action();await expect(r.page.locator('#target')).toHaveText('One');await r.action();await r.bind();expect((await r.status()).undo).toBe(2);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A dormant author and text recovery retain one logical group and global order',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');expect(await r.author('color','red',{inline:true})).toBe(true);await r.read(`__p.editor.applyText(__p.editor.prepareText(),'Text');true`);
    await r.page.locator('#target').evaluate(node=>{(node as HTMLElement).style.color='green';node.firstChild!.nodeValue='Host';});await r.action();await r.action();await r.bind();
    expect((await r.status()).undo).toBe(2);expect(await r.read('__p.editor.getSnapshot().changes.length')).toBe(1);expect(await r.read('__p.editor.getSnapshot().changes[0].texts.length')).toBe(1);
    await r.read('__p.editor.undo();true');expect((await r.status()).undo).toBe(2);await expect(r.page.locator('#target')).toHaveText('Host');
    await r.page.locator('#target').evaluate(node=>{node.firstChild!.nodeValue='Text';});await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveText('Target');expect((await r.status()).undo).toBe(1);
    await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveCSS('color','rgb(0, 128, 0)');expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});

test('09A Reset with pending text followed by explicit repick keeps recovery and new logical groups truthful',async({},info)=>{
  const r=await launch(info);
  try{
    await pick(r.page,'#target');await r.read(`__p.editor.applyText(__p.editor.prepareText(),'One');true`);await r.page.locator('#target').evaluate(node=>{node.firstChild!.nodeValue='Host';});await r.read('__p.editor.reset();true');
    await pick(r.page,'#target');await r.read(`__p.editor.applyText(__p.editor.prepareText(),'Two');true`);
    const groups=await r.read(`__p.editor.getSnapshot().changes.map(g=>({id:g.targetId,rows:g.texts?.length,state:g.texts?.[0].state,current:g.texts?.[0].current}))`);expect(groups).toHaveLength(2);expect(groups.map((g:any)=>g.rows)).toEqual([1,1]);expect(groups.map((g:any)=>g.current)).toEqual(['Two','Two']);expect(groups.map((g:any)=>g.state)).toEqual(['superseded','applied']);
    await r.read('__p.editor.undo();true');await expect(r.page.locator('#target')).toHaveText('Host');expect((await r.status()).undo).toBe(1);expect(r.errors).toEqual([]);
  }finally{await r.context.close();}
});
