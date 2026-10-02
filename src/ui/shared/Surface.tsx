import { useLayoutEffect, useRef, type ReactNode } from 'react';
import { FloatingFocusManager, useFloating } from '@floating-ui/react';
import { useUI } from '../../state/ui';
import { getSurfaceOrigin } from '../interactions/focus';
import { IconButton } from './Icon';
import s from '../ui.module.css';

export function Surface({ title, subtitle, children, wide = false, compact = false }: { title: string; subtitle: string; children: ReactNode; wide?: boolean; compact?: boolean }) {
  const origin = useRef(getSurfaceOrigin());
  const { refs, context } = useFloating({ open: true });
  useLayoutEffect(() => { refs.setReference(origin.current); }, [refs.setReference]);
  return <div className={`${s.scrim} ${wide ? s.reviewBackdrop : s.navigatorBackdrop}`} onClick={event => {
    if (event.target === event.currentTarget) useUI.getState().setSurface(null);
  }}><FloatingFocusManager context={context} modal returnFocus={origin} outsideElementsInert><section ref={refs.setFloating} role="dialog" aria-modal="true" aria-label={title} className={`${s.surface} ${compact?s.compactSurface:wide ? s.wideSurface : s.navigatorSurface}`}>
    <header className={s.surfaceHeader}><div><h2>{title}</h2><p>{subtitle}</p></div><IconButton icon="close" label={`Close ${title}`} onClick={() => useUI.getState().setSurface(null)} /></header>{children}
  </section></FloatingFocusManager></div>;
}
