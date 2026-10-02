import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { css } from '@codemirror/lang-css';
import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';
import { useEditing, useInspection } from '../../picker/context';
import { baseContext, contextKey, type EditContext } from '../../editing/contexts';
import { properties, type Property } from '../../editing/properties';
import type { Declaration, SourceSnapshot } from '../../editing/readable';
import { SessionActions } from '../design/EditControls';
import { Icon } from '../shared/Icon';
import s from './liveCode.module.css';
import type { CascadeResult } from '../../engine/cascade/model';
import { declarationStatus } from '../../engine/cascade/status';
import { adjacentSourceRuns } from './sourcePresentation';
import { EditEffectiveness } from '../shared/EditEffectiveness';

const CascadeContext = createContext<CascadeResult | null>(null);

function SelectorText({ value, pseudo }: { value: string; pseudo: string }) {
  const at = pseudo ? value.lastIndexOf(pseudo) : -1;
  return at < 0 ? <>{value}</> : <>{value.slice(0, at)}<span className={s.pseudoSyntax}>{pseudo}</span>{value.slice(at + pseudo.length)}</>;
}

function ValueEditor({ value, label, commit, cancel }: { value: string; label: string; commit: (value: string) => void; cancel: () => void }) {
  const mount = useRef<HTMLSpanElement>(null), callback = useRef(commit), cancellation = useRef(cancel); callback.current = commit; cancellation.current = cancel;
  useEffect(() => {
    const view = new EditorView({ parent: mount.current!, root: mount.current!.getRootNode() as ShadowRoot, state: EditorState.create({ doc: value, extensions: [
      css(), syntaxHighlighting(HighlightStyle.define([{ tag: [tags.number, tags.unit, tags.color, tags.string], color: 'var(--syntax-value)' }, { tag: [tags.keyword, tags.function(tags.variableName), tags.propertyName], color: 'var(--syntax-property)' }])), EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': label, 'aria-multiline': 'false', spellcheck: 'false' }),
      EditorState.transactionFilter.of(transaction => transaction.newDoc.lines > 1 ? [] : transaction),
      EditorView.domEventHandlers({ keydown(event, editor) { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); cancellation.current(); return true; } if (event.key === 'Enter') { event.preventDefault(); callback.current(editor.state.doc.toString()); return true; } return false; } }),
      EditorView.theme({ '&': { fontSize: '12px', backgroundColor: 'var(--raised)', color: 'var(--syntax-value)' }, '.cm-content': { padding: '2px 0', fontFamily: 'var(--font-code)', minHeight: '20px' }, '.cm-line': { padding: '0 3px' }, '&.cm-focused': { outline: '1px solid var(--focus-ring)' } }, { dark: true }),
    ] }) });
    view.focus(); view.dispatch({ selection: { anchor: 0, head: value.length } });
    return () => view.destroy();
  }, []);
  return <span className={s.editor} data-escape-cancel ref={mount} />;
}

function DeclarationRow({ declaration, context, editable, owned = false, enabled = true }: { declaration: Declaration & { id?: string }; context: EditContext; editable: boolean; owned?: boolean; enabled?: boolean }) {
  const { editor, design, mutationPolicy, effectiveness } = useEditing();
  const effect = owned ? effectiveness.find(effect => effect.property === declaration.property && contextKey(effect.context) === contextKey(context)) : undefined;
  const status = declarationStatus(useContext(CascadeContext), declaration.id);
  const [editing, setEditing] = useState(false), [error, setError] = useState('');
  const focusKey = JSON.stringify([owned, contextKey(context), declaration.sourceId, declaration.ruleId, declaration.property]);
  const valueButton = useRef<HTMLButtonElement>(null), row = useRef<HTMLDivElement>(null), returnFocus = useRef(false);
  useLayoutEffect(() => { if (!editing && returnFocus.current && valueButton.current) { valueButton.current.focus({ preventScroll: true }); returnFocus.current = false; } }, [editing]);
  const finish = () => {
    const scope = row.current?.closest('[data-testid=live-code]');
    const section = row.current?.closest('section');
    returnFocus.current = true; setEditing(false); setError('');
    // Resolve after React renders: author/override updates may replace the row.
    requestAnimationFrame(() => {
      const replacementRow = Array.from((section?.isConnected ? section : scope)?.querySelectorAll<HTMLElement>('[data-code-focus]') ?? []).find(node => node.getAttribute('data-code-focus') === focusKey);
      const replacement = replacementRow?.querySelector<HTMLButtonElement>('button[aria-label]');
      (valueButton.current?.isConnected ? valueButton.current : replacement)?.focus({ preventScroll: true });
    });
  };
  const supported = (properties.includes(declaration.property as Property) || (!owned && mutationPolicy.mode === 'SAFE_AUTHOR_MUTATION' && declaration.property.startsWith('--'))) && (editable || (!owned && mutationPolicy.mode === 'SAFE_AUTHOR_MUTATION'));
  const authorMode = !owned && mutationPolicy.mode === 'SAFE_AUTHOR_MUTATION';
  const rgb = declaration.value.match(/^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/);
  const swatch = /^#[0-9a-f]{6}$/i.test(declaration.value) ? declaration.value : /^#[0-9a-f]{3}$/i.test(declaration.value) ? '#' + declaration.value.slice(1).split('').map(char => char + char).join('') : rgb ? '#' + rgb.slice(1).map(channel => Math.min(255, Number(channel)).toString(16).padStart(2, '0')).join('') : null;
  const commit = (value: string) => {
    editor!.setContext(context);
    const success = !owned && mutationPolicy.mode === 'SAFE_AUTHOR_MUTATION'
      ? editor!.applyAuthor(design!.targetId, declaration.property, value, { sourceId: declaration.sourceId, ruleId: declaration.ruleId, declarationId: declaration.id, allowShared: mutationPolicy.allowShared }, contextKey(context))
      : editor!.applyBatch(design!.targetId, { [declaration.property]: value }, undefined, contextKey(context));
    setError(success ? '' : editor!.getSnapshot().error ?? 'This value cannot be applied.');
    if (success && editing) finish();
  };
  return <div ref={row} className={s.declaration} data-code-focus={focusKey} data-property={declaration.property} data-owned={owned} data-source-state={owned ? 'session-override' : declaration.mutationState ?? 'authored'} data-cascade-status={status} title={`${status ? `Readable author cascade: ${status}. ` : ''}${declaration.mutationState === 'cssforge-mutated-author' ? 'CSSForge-mutated authored declaration.' : owned ? 'CSSForge session override.' : 'Authored declaration.'}`}>
    <div className={`${s.line} ${!enabled ? s.disabled : ''}`}>
      <input type="checkbox" aria-label={`${owned ? 'Toggle override' : 'Authored declaration'} ${declaration.property}`} checked={enabled} disabled={!owned} title={owned ? 'Remove or restore this CSSForge override; authored styles remain intact.' : 'Disabling authored CSS requires cascade knowledge and is unavailable.'} onChange={() => { const ok = editor!.toggle(design!.targetId, context, declaration.property as Property); setError(ok ? '' : editor!.getSnapshot().error ?? 'This declaration cannot be toggled.'); }} />
      <span className={s.property}>{declaration.property}</span><span>:</span>
      {editing ? <ValueEditor value={declaration.value} label={`CSS value ${declaration.property}`} commit={commit} cancel={finish} /> : <button ref={valueButton} className={s.value} data-value-kind={/^(auto|none|normal|inherit|initial|unset|revert|center|left|right|solid|block|inline|flex|grid|pointer)$/.test(declaration.value) ? 'keyword' : 'value'} disabled={!supported} title={supported ? authorMode ? 'Edit authored declaration when safe · Enter to apply' : 'Edit as a CSSForge override · Enter to apply' : 'Read-only declaration or unsupported selector context'} onClick={() => setEditing(true)} aria-label={`Edit ${declaration.property}`}>{declaration.value}</button>}
      {declaration.priority && <span className={s.priority}>!{declaration.priority}</span>}<span>;</span>
      {supported && swatch && /^(color|background-color|border-color)$/.test(declaration.property) && <input type="color" className={s.swatch} aria-label={`Code color ${declaration.property}`} value={swatch} onChange={event => commit(event.target.value)} title={authorMode ? 'Apply color with safe author policy' : 'Apply a color override'} />}
    </div>
    {declaration.mutationState === 'cssforge-mutated-author' && <small className={s.sourceState}>CSSForge author edit</small>}
    {effect && <EditEffectiveness effect={effect} />}
    {editing && <small className={s.hint}>{authorMode ? 'Enter to apply safely; uncertain sources use overrides' : 'Enter to apply as an override'} <button onClick={finish}>Cancel</button></small>}
    {error && <p className={s.error} role="alert">{error}</p>}
  </div>;
}

function AddDeclaration() {
  const { editor, design, context } = useEditing();
  const [open, setOpen] = useState(false), [property, setProperty] = useState(''), [value, setValue] = useState(''), [error, setError] = useState('');
  if (!open) return <button className={s.add} onClick={() => setOpen(true)}><Icon name="plus" />Add session declaration</button>;
  return <form className={s.addForm} onSubmit={event => { event.preventDefault(); const success = editor!.applyBatch(design!.targetId, { [property.trim()]: value }, undefined, contextKey(context)); setError(success ? '' : editor!.getSnapshot().error ?? 'Invalid declaration.'); if (success) { setOpen(false); setProperty(''); setValue(''); } }}>
    <small>New override · {context.media.join(' → ') || 'Base'} {context.pseudo}</small>
    <div><input aria-label="CSS property" placeholder="property" value={property} onChange={event => setProperty(event.target.value)} /><span>:</span><input aria-label="New CSS value" placeholder="value" value={value} onChange={event => setValue(event.target.value)} /><button type="submit">Apply</button></div>
    {error && <p className={s.error} role="alert">{error}</p>}
  </form>;
}

export function LiveCodeView() {
  const { design } = useEditing();
  return design ? <CodeTarget key={`${design.targetId}:${design.bindingGeneration}`} /> : null;
}
function CodeTarget() {
  const { picker } = useInspection(), { design, overrides, context, undoCount, editedCount, authorRevision, mutationPolicy } = useEditing();
  const [source, setSource] = useState<SourceSnapshot | null>(null);
  const overrideRules = useMemo(() => picker?.sourceOverrides(overrides) ?? [], [picker, overrides]);
  const cascade = useMemo(() => source ? picker?.cascade() : null, [picker, source, overrides, context]);
  useEffect(() => { setSource(picker!.source(true)); }, [picker, design?.targetId, authorRevision]);
  if (!design || !source) return null;
  return <CascadeContext.Provider value={cascade ?? null}><div className={s.code} data-testid="live-code">
    <header className={s.caption}><span>Selected element CSS</span><button onClick={() => setSource(picker!.source(true))}><Icon name="refresh" />Refresh sources</button></header>
    {cascade && <p className={s.summary} data-testid="cascade-summary">
      <span className={s.statusLine}><span>Readable author cascade</span><strong>{Object.values(cascade.properties).filter(property => property.winner).length} resolved declarations</strong></span>
      <span className={s.statusContext}>{context.pseudo || 'Base'}{context.media.length > 0 && <span className={s.statusMedia}> · {context.media.join(' → ')}</span>}<span className={s.statusScope}> · {Object.values(cascade.properties).some(property => property.confidence !== 'resolved') ? 'Incomplete/unsupported cases unresolved' : 'Supported author subset'}</span></span>
      {cascade.issues.includes('inaccessible-source') && <span className={s.sourceWarning}>Inaccessible sources prevent a certain winner.</span>}
    </p>}
    <section aria-label="CSSForge overrides" className={s.group}><h3>CSSForge overrides <small>current session</small></h3>
      {!overrides.length && <p className={s.note}>No overrides for this element.</p>}
      {overrideRules.map(rule => <div key={rule.id}><div className={s.selector}>{rule.editContext!.media.length ? <span className={s.statusMedia}>{rule.editContext!.media.map(query => `@media ${query}`).join(' → ')}</span> : 'Base'} {rule.editContext!.pseudo || 'element'} {'{'}</div>{rule.declarations.map(declaration => <DeclarationRow key={declaration.id} context={rule.editContext!} declaration={declaration} editable owned enabled={declaration.enabled} />)}<div className={s.brace}>{'}'}</div></div>)}
      <AddDeclaration />{(undoCount > 0 || editedCount > 0) && <div className={s.actions}><SessionActions /></div>}
    </section>
    <section aria-label="Inline authored CSS" className={s.group}><h3>Inline authored <small>style attribute</small></h3>{source.inline.length ? <><div className={s.selector}>element.style {'{'}</div>{source.inline.map(declaration => <DeclarationRow key={declaration.property} declaration={declaration} context={baseContext()} editable />)}<div className={s.brace}>{'}'}</div></> : <p className={s.emptyRule}><span>element.style {'{}'}</span><small>No inline declarations.</small></p>}</section>
    <section aria-label="Readable matching CSS" className={s.group}><h3>Readable matching rules</h3>{!source.rules.length && <p className={s.note}>No matching rules found in the readable subset.</p>}{adjacentSourceRuns(source.rules).map(run => {
      const metadata = run.groups[0].group;
      return <div className={s.sourceRun} data-source-run data-context={metadata.conditions.length ? 'conditional' : 'base'} key={run.groups[0].index}>
        {metadata.conditions.map((condition, i) => <div className={s.context} key={i}>{condition}</div>)}
        {run.groups.map(({ group, index }) => <div className={s.rule} data-source-rule key={`${index}-${group.selector}`}>
          <div className={s.selector}><SelectorText value={group.selector} pseudo={group.context.pseudo} /><span className={s.punctuation}> {'{'}</span>{group.context.pseudo && <small> {group.context.pseudo} context</small>}</div>
          {group.declarations.map(declaration => <DeclarationRow key={declaration.property} declaration={declaration} context={group.context} editable={group.editable} />)}
          <div className={s.brace}>{'}'}</div>
        </div>)}
        <small className={s.source} title={metadata.label}><Icon name="code" />Source · {metadata.label}</small>
      </div>;
    })}</section>
    {source.keyframes.length > 0 && <section className={s.group} aria-label="Readable keyframes"><h3>Referenced keyframes <small>read-only · no winner inference</small></h3>{source.keyframes.map((frame, i) => <pre className={s.keyframes} key={i}>{frame.css}</pre>)}</section>}
    <aside className={s.notices}><p className={s.mode}>Authored CSSOM · {mutationPolicy.mode === 'SAFE_AUTHOR_MUTATION' ? 'Safe author edits; uncertain edits use session overrides.' : 'Edits use session overrides.'}</p><p>Excludes browser/user origins and computed-value substitution.</p><p>Bounded CSSOM · imports, relative selectors and shadow-host styles unresolved. Refresh after CSS or media changes.</p>{source.notices.map(notice => <p key={notice}>{notice}</p>)}</aside>
  </div></CascadeContext.Provider>;
}
