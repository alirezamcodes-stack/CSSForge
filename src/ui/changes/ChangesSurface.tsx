import { useState } from 'react';
import { changes } from '../../fixtures/selected';
import { Surface } from '../shared/Surface';
import { Icon } from '../shared/Icon';
import s from '../ui.module.css';
export function ChangesSurface() {
  const [copied, setCopied] = useState('');
  const copy = async (selector?: string) => {
    const css = changes.filter(group => !selector || group.selector === selector).map(group => `${group.selector} {\n${group.items.map(([property, , after]) => `  ${property}: ${after};`).join('\n')}\n}`).join('\n\n');
    try { await navigator.clipboard.writeText(css); setCopied(selector ?? 'all'); } catch { setCopied('error'); }
  };
  return <Surface title="Changes" subtitle="Fixture review · 2 elements · 5 properties" wide><div className={s.changesToolbar}><button className={s.outlineButton} onClick={() => void copy()}><Icon name="copy" />{copied === 'all' ? 'Copied fixture CSS' : 'Copy fixture CSS'}</button><span className={s.fixtureNote}>Example diff · no webpage edits</span></div><div className={s.diffGroups}>{changes.map(group => <article key={group.selector} className={s.diffGroup}><header><strong>{group.selector}</strong><button className={s.outlineButton} onClick={() => void copy(group.selector)}><Icon name="copy" />{copied === group.selector ? 'Copied' : 'Copy'}</button></header><div className={s.diffCode}>{group.items.map(([property, before, after], index) => <div key={property}><div className={s.removed}><span>{index + 1}</span><b>−</b><code>{property}: {before};</code></div><div className={s.added}><span>{index + 1}</span><b>+</b><code>{property}: {after};</code></div></div>)}</div></article>)}</div><p role="status" className={s.fixtureNote}>{copied === 'error' ? 'Clipboard unavailable in this browser context.' : copied ? 'Copied the example declarations to your clipboard.' : 'Before and after values are demonstration data.'}</p></Surface>;
}
