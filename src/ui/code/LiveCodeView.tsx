import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
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

const CascadeContext = createContext<CascadeResult | null>(null);

function ValueEditor({ value, label, commit }: { value: string; label: string; commit: (value: string) => void }) {
  const mount = useRef<HTMLSpanElement>(null), callback = useRef(commit); callback.current = commit;
  useEffect(() => {
    const view = new EditorView({ parent: mount.current!, root: mount.current!.getRootNode() as ShadowRoot, state: EditorState.create({ doc: value, extensions: [
      css(), syntaxHighlighting(HighlightStyle.define([{ tag: [tags.number, tags.unit, tags.color, tags.string], color: '#c2a2ea' }, { tag: [tags.keyword, tags.function(tags.variableName), tags.propertyName], color: '#5ed5ec' }])), EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': label, 'aria-multiline': 'false', spellcheck: 'false' }),
      EditorState.transactionFilter.of(transaction => transaction.newDoc.lines > 1 ? [] : transaction),
      EditorView.domEventHandlers({ keydown(event, editor) { if (event.key === 'Enter') { event.preventDefault(); callback.current(editor.state.doc.toString()); return true; } return false; } }),
      EditorView.theme({ '&': { fontSize: '13px', backgroundColor: '#292c31', color: '#c2a2ea' }, '.cm-content': { padding: '2px 0', fontFamily: 'var(--font-code)', minHeight: '20px' }, '.cm-line': { padding: '0 3px' }, '&.cm-focused': { outline: '1px solid #97dfb6' } }, { dark: true }),
    ] }) });
    view.focus(); view.dispatch({ selection: { anchor: 0, head: value.length } });
    return () => view.destroy();
  }, []);
  return <span className={s.editor} ref={mount} />;
}

function DeclarationRow({ declaration, context, editable, owned = false, enabled = true }: { declaration: Declaration & { id?: string }; context: EditContext; editable: boolean; owned?: boolean; enabled?: boolean }) {
  const { editor, design } = useEditing();
  const status = declarationStatus(useContext(CascadeContext), declaration.id);
  const [editing, setEditing] = useState(false), [error, setError] = useState('');
  const supported = properties.includes(declaration.property as Property) && editable;
  const rgb = declaration.value.match(/^rgb\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)\s*\)$/);
  const swatch = /^#[0-9a-f]{6}$/i.test(declaration.value) ? declaration.value : /^#[0-9a-f]{3}$/i.test(declaration.value) ? '#' + declaration.value.slice(1).split('').map(char => char + char).join('') : rgb ? '#' + rgb.slice(1).map(channel => Math.min(255, Number(channel)).toString(16).padStart(2, '0')).join('') : null;
  const commit = (value: string) => {
    editor!.setContext(context);
    const success = editor!.applyBatch(design!.targetId, { [declaration.property]: value }, undefined, contextKey(context));
    setError(success ? '' : editor!.getSnapshot().error ?? 'This value cannot be applied.');
    if (success) setEditing(false);
  };
  return <div className={s.declaration} data-property={declaration.property} data-owned={owned} data-cascade-status={status} title={status ? `Readable author cascade: ${status}` : undefined}>
    <div className={`${s.line} ${!enabled ? s.disabled : ''}`}>
      <input type="checkbox" aria-label={`${owned ? 'Toggle override' : 'Authored declaration'} ${declaration.property}`} checked={enabled} disabled={!owned} title={owned ? 'Remove or restore this CSSForge override; authored styles remain intact.' : 'Disabling authored CSS requires cascade knowledge and is unavailable.'} onChange={() => { const ok = editor!.toggle(design!.targetId, context, declaration.property as Property); setError(ok ? '' : editor!.getSnapshot().error ?? 'This declaration cannot be toggled.'); }} />
      <span className={s.property}>{declaration.property}</span><span>:</span>
      {editing ? <ValueEditor value={declaration.value} label={`CSS value ${declaration.property}`} commit={commit} /> : <button className={s.value} disabled={!supported} title={supported ? 'Edit as a CSSForge override · Enter to apply' : 'Read-only declaration or unsupported selector context'} onClick={() => setEditing(true)} aria-label={`Edit ${declaration.property}`}>{declaration.value}</button>}
      {declaration.priority && <span className={s.priority}>!{declaration.priority}</span>}<span>;</span>
      {supported && swatch && /^(color|background-color|border-color)$/.test(declaration.property) && <input type="color" className={s.swatch} aria-label={`Code color ${declaration.property}`} value={swatch} onChange={event => commit(event.target.value)} title="Apply a color override" />}
    </div>
    {editing && <small className={s.hint}>Enter to apply as an override <button onClick={() => { setEditing(false); setError(''); }}>Cancel</button></small>}
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
  return design ? <CodeTarget key={design.targetId} /> : null;
}
function CodeTarget() {
  const { picker } = useInspection(), { design, overrides, context, undoCount, editedCount } = useEditing();
  const [source, setSource] = useState<SourceSnapshot | null>(null);
  const overrideRules = useMemo(() => picker?.sourceOverrides(overrides) ?? [], [picker, overrides]);
  const cascade = useMemo(() => source ? picker?.cascade() : null, [picker, source, overrides, context]);
  useEffect(() => { setSource(picker!.source(true)); }, [picker, design?.targetId]);
  if (!design || !source) return null;
  return <CascadeContext.Provider value={cascade ?? null}><div className={s.code} data-testid="live-code">
    <header className={s.caption}><span>Selected element CSS</span><button onClick={() => setSource(picker!.source(true))}>Refresh sources</button></header>
    <p className={s.note}>Authored CSS via CSSOM. Edits create session overrides.</p>
    {cascade && <p className={s.note} data-testid="cascade-summary">Readable author cascade · {context.pseudo || 'Base'}{context.media.length ? ` · ${context.media.join(' → ')}` : ''}. {Object.values(cascade.properties).filter(property => property.winner).length} resolved declarations. {Object.values(cascade.properties).some(property => property.confidence !== 'resolved') ? 'Incomplete or unsupported cases remain unresolved.' : 'Resolved within supported author sources.'} Browser/user origins and computed-value substitution are outside this result.{cascade.issues.includes('inaccessible-source') && ' Inaccessible sources prevent a certain winner.'}</p>}
    <section aria-label="CSSForge overrides" className={s.group}><h3>CSSForge overrides <small>current session</small></h3>
      {!overrides.length && <p className={s.note}>No overrides for this element.</p>}
      {overrideRules.map(rule => <div key={rule.id}><div className={s.selector}>{rule.editContext!.media.map(query => `@media ${query}`).join(' → ') || 'Base'} {rule.editContext!.pseudo || 'element'} {'{'}</div>{rule.declarations.map(declaration => <DeclarationRow key={declaration.id} context={rule.editContext!} declaration={declaration} editable owned enabled={declaration.enabled} />)}<div className={s.brace}>{'}'}</div></div>)}
      <AddDeclaration />{(undoCount > 0 || editedCount > 0) && <div className={s.actions}><SessionActions /></div>}
    </section>
    <section aria-label="Inline authored CSS" className={s.group}><h3>Inline authored <small>style attribute</small></h3><div className={s.selector}>element.style {'{'}</div>{source.inline.map(declaration => <DeclarationRow key={declaration.property} declaration={declaration} context={baseContext()} editable />)}{!source.inline.length && <p className={s.note}>No inline declarations.</p>}<div className={s.brace}>{'}'}</div></section>
    <section aria-label="Readable matching CSS" className={s.group}><h3>Readable matching rules</h3>{!source.rules.length && <p className={s.note}>No matching rules found in the readable subset.</p>}{source.rules.map((group, index) => <div className={s.rule} key={`${index}-${group.selector}`}><small className={s.source} title={group.label}>{group.label}</small>{group.conditions.map((condition, i) => <div className={s.context} key={i}>{condition} {'{'}</div>)}<div className={s.selector}>{group.selector} {'{'}{group.context.pseudo && <small> {group.context.pseudo} context</small>}</div>{group.declarations.map(declaration => <DeclarationRow key={declaration.property} declaration={declaration} context={group.context} editable={group.editable} />)}<div className={s.brace}>{'}'.repeat(1 + group.conditions.length)}</div></div>)}</section>
    {source.keyframes.length > 0 && <section className={s.group} aria-label="Readable keyframes"><h3>Referenced keyframes <small>read-only · no winner inference</small></h3>{source.keyframes.map((frame, i) => <pre className={s.keyframes} key={i}>{frame.css}</pre>)}</section>}
    <aside className={s.notices}><p>Bounded CSSOM snapshot. Imports, relative selectors and shadow-host styles are not resolved. Refresh after page CSS or media changes.</p>{source.notices.map(notice => <p key={notice}>{notice}</p>)}</aside>
  </div></CascadeContext.Provider>;
}
