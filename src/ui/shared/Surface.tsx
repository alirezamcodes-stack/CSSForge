import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { useUI } from '../../state/ui';
import { IconButton } from './Icon';
import s from '../ui.module.css';
export function Surface({ title, subtitle, children, wide = false }: { title: string; subtitle: string; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const root = ref.current?.getRootNode() as ShadowRoot;
    const previous = root.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLButtonElement>('button')?.focus();
    return () => previous?.focus();
  }, []);
  return <div className={`${s.scrim} ${wide ? s.reviewBackdrop : s.navigatorBackdrop}`} onClick={event => { if (event.target === event.currentTarget) useUI.getState().setSurface(null); }}><section ref={ref} role="dialog" aria-modal="true" aria-label={title} className={`${s.surface} ${wide ? s.wideSurface : s.navigatorSurface}`} onKeyDown={event => {
    if (event.key === 'Escape') { event.stopPropagation(); useUI.getState().setSurface(null); }
    if (event.key !== 'Tab') return;
    const elements = Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, [tabindex="0"]') ?? []);
    const active = (ref.current?.getRootNode() as ShadowRoot).activeElement;
    if (event.shiftKey && active === elements[0]) { event.preventDefault(); elements.at(-1)?.focus(); }
    else if (!event.shiftKey && active === elements.at(-1)) { event.preventDefault(); elements[0]?.focus(); }
  }}><header className={s.surfaceHeader}><div><h2>{title}</h2><p>{subtitle}</p></div><IconButton icon="close" label={`Close ${title}`} onClick={() => useUI.getState().setSurface(null)} /></header>{children}</section></div>;
}
