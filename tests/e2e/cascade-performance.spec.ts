import { expect, test } from '@playwright/test';

test('native CSSOM scoped effectiveness preserves full contribution evidence across contexts and source uncertainty', async ({ page }) => {
  await page.route('**/cascade-scoped.html', route => route.fulfill({ contentType: 'text/html', body: `<!doctype html><html><head><style>
    body{margin:0} .parent{font:18px Georgia;color:navy;width:480px;--token:3rem}
    .child{display:block;width:300px;margin:1px 2px;padding:3px;border:1px solid red;background:yellow;color:green}
    .child:focus{padding-top:17px!important} .child:hover{margin-left:9px!important}
    .child::before{content:'Before';color:purple}
    @media(min-width:100px){.child{opacity:.7!important}}
    @media(min-width:9999px){.child{opacity:.3!important}}
    @supports(display:grid){.child{outline:2px solid red}}
    @layer reset,theme; @layer reset{.child{border-top-color:red!important}}
    @property --registered{syntax:'<length>';inherits:true;initial-value:0px}
    </style></head><body><main class="parent" id="parent"><button class="child" id="child" data-cssforge-edit="target">Scoped target</button></main></body></html>` }));
  await page.goto('/cascade-scoped.html');
  const evidence = await page.evaluate(async () => {
    const sourcePath = '/src/engine/sources/index.ts', cascadePath = '/src/engine/cascade/index.ts', effectPath = '/src/editing/effectiveness.ts';
    const { createSourceIndex } = await import(sourcePath), { createCascade } = await import(cascadePath);
    const { editEffect, hasActiveOutsideContext } = await import(effectPath);
    const target = document.querySelector<HTMLElement>('#child')!; target.focus();
    const layer = document.createElement('style'); layer.setAttribute('data-cssforge-edit-layer', 'target'); document.head.append(layer);
    const index = createSourceIndex(document);
    let groups = [
      { context: { media: [], pseudo: '' }, declarations: Object.entries({ margin: 'var(--pending)', padding: '4px', 'border-color': 'blue', background: 'linear-gradient(red,blue) yellow', font: 'italic 20px/1.4 Georgia', width: 'inherit', '--token': 'unset', '--registered': '2rem' }).map(([property, value]) => ({ property, value, enabled: true })) },
      { context: { media: [], pseudo: ':hover' }, declarations: [{ property: 'margin', value: '5px', enabled: true }] },
      { context: { media: [], pseudo: '::before' }, declarations: [{ property: 'color', value: 'gold', enabled: true }] },
      { context: { media: ['(min-width: 9999px)'], pseudo: '' }, declarations: [{ property: 'opacity', value: '.9', enabled: true }] },
    ];
    const position = () => [...document.styleSheets].filter(sheet => sheet.ownerNode !== layer && !(sheet.ownerNode as Element | null)?.hasAttribute?.('data-cssforge-edit-layer')).filter(sheet => !!(sheet.ownerNode as Node | null)?.compareDocumentPosition(layer) && !!((sheet.ownerNode as Node).compareDocumentPosition(layer) & Node.DOCUMENT_POSITION_FOLLOWING)).length - .5;
    const engine = createCascade(document, index, (element: Element) => element === target ? groups : [], undefined, position);
    const readNeeded = (currentEngine: any, node: Element, context: any, declarations: any[]) => currentEngine.readProperties ? currentEngine.readProperties(node, context, declarations) : currentEngine.read(node, context);
    const widthCount = Object.keys(readNeeded(engine, target, { media: [], pseudo: '' }, [{ property: 'width', value: '512px' }]).properties).length;
    const serialize = (value: unknown) => JSON.stringify(value, (_key, item) => item instanceof Element ? { element: item.id || item.localName } : item);
    const checks: { stage: string; context: string; properties: number; fullProperties: number; differences: string[] }[] = [];
    const verify = (stage: string, node = target, currentGroups = groups, currentEngine = engine) => {
      for (const group of currentGroups) {
        const scoped = readNeeded(currentEngine, node, group.context, group.declarations), full = currentEngine.read(node, group.context);
        const differences = Object.keys(scoped.properties).filter(property => serialize(scoped.properties[property]) !== serialize(full.properties[property]));
        if (serialize(scoped.issues) !== serialize(full.issues)) differences.push('global issues');
        const declarations = index.overrides(node, currentGroups).rules.find((rule: any) => serialize(rule.editContext) === serialize(group.context))!.declarations;
        for (const declaration of declarations) {
          const activity = group.context.pseudo.startsWith('::') ? 'unverified-pseudo' : group.context.media.some(query => !matchMedia(query).matches) ? 'inactive-media' : group.context.pseudo && !node.matches(group.context.pseudo) ? 'inactive-pseudo' : 'active';
          const effect = (result: any) => editEffect(declaration, group.context, result, activity, undefined, hasActiveOutsideContext(result, declaration.id, node));
          if (serialize(effect(scoped)) !== serialize(effect(full))) differences.push(`effect ${declaration.property}`);
        }
        checks.push({ stage, context: serialize(group.context), properties: Object.keys(scoped.properties).length, fullProperties: Object.keys(full.properties).length, differences });
      }
    };
    verify('native shorthand and explicit contexts');
    const uncertainty = document.createElement('style'); uncertainty.textContent = '.child{all:unset;margin-inline-start:1px;transition:width 1s}'; document.head.append(uncertainty);
    index.invalidate(); engine.invalidate(); verify('global all logical motion');
    uncertainty.textContent = '.child{width:600px!important}';
    groups = [{ context: { media: [], pseudo: '' }, declarations: [{ property: 'width', value: '512px', enabled: true }] }];
    index.invalidate(); engine.invalidate(); verify('later author source position');
    const later = readNeeded(engine, target, groups[0].context, groups[0].declarations).properties.width.winner?.source.kind;
    document.head.append(layer); index.invalidate(); engine.invalidate(); verify('session layer promoted');
    const promoted = readNeeded(engine, target, groups[0].context, groups[0].declarations).properties.width.winner?.source.kind;
    target.classList.remove('child'); engine.invalidate(); verify('fresh DOM match after global invalidation');
    groups[0].declarations[0].enabled = false; engine.invalidate(); verify('disabled session declaration');
    const host = document.createElement('section'); host.id = 'shadow-host'; host.style.cssText = '--shadow-token:4rem;color:navy'; document.body.append(host);
    const shadow = host.attachShadow({ mode: 'open' }); shadow.innerHTML = '<style>.shadow-target{padding:1px;color:green}</style><button class="shadow-target" id="shadow-child">Shadow target</button><style data-cssforge-edit-layer="shadow"></style>';
    const shadowTarget = shadow.querySelector<HTMLElement>('button')!;
    const shadowGroups = [{ context: { media: [], pseudo: '' }, declarations: [{ property: '--shadow-token', value: 'unset', enabled: true }, { property: 'color', value: 'inherit', enabled: true }, { property: 'padding', value: '3px', enabled: true }] }];
    const shadowEngine = createCascade(document, index, (element: Element) => element === shadowTarget ? shadowGroups : [], undefined, () => .5);
    verify('open shadow inherited host evidence', shadowTarget, shadowGroups, shadowEngine);
    const shadowBefore = shadowEngine.read(host).properties['--shadow-token'].winner?.value;
    host.style.setProperty('--shadow-token', '6rem'); index.invalidate(shadowTarget); shadowEngine.invalidate();
    verify('open shadow host mutation after source invalidation', shadowTarget, shadowGroups, shadowEngine);
    const shadowAfter = shadowEngine.read(host).properties['--shadow-token'].winner?.value;
    return { checks, widthCount, later, promoted, shadowBefore, shadowAfter, scans: index.getStats().scopeScans };
  });
  expect(evidence.widthCount).toBe(1); expect(evidence.checks).toHaveLength(14);
  for (const check of evidence.checks) {
    expect(check.differences, `${check.stage} ${check.context}`).toEqual([]);
    expect(check.properties).toBeGreaterThan(0); expect(check.properties).toBeLessThan(check.fullProperties);
  }
  expect(evidence.later).toBe('style'); expect(evidence.promoted).toBe('override');
  // Shadow scope evidence remains explicitly incomplete. Its host's supported
  // author token must still refresh when the source binding changes.
  expect(evidence.shadowBefore).toBe('4rem'); expect(evidence.shadowAfter).toBe('6rem');
  expect(evidence.scans).toBe(7);
});
