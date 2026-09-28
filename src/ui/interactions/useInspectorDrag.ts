import { useLayoutEffect, useRef, type PointerEvent, type KeyboardEvent, type MouseEvent } from 'react';
import { useUI, type Position } from '../../state/ui';
import { clampPosition } from './geometry';
import { registerDragCancellation } from './focus';

export function useInspectorDrag(open: boolean) {
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{ pointer: number; start: Position; origin: Position; next: Position; handle: HTMLElement; moved: boolean } | null>(null);
  const frame = useRef(0);
  const ignoreClick = useRef(false);
  const clamp = (position: Position) => {
    const root = panel.current!.getRootNode() as ShadowRoot;
    const dock = root.querySelector<HTMLElement>('nav[aria-label="CSSForge tools"]');
    return clampPosition(position, panel.current!.getBoundingClientRect(), { width: window.innerWidth, height: dock ? dock.getBoundingClientRect().top - 4 : window.innerHeight });
  };
  const paint = (position: Position) => {
    const element = panel.current!;
    if (!element.style.height) element.style.height = `${element.getBoundingClientRect().height}px`;
    Object.assign(element.style, { left: `${position.x}px`, top: `${position.y}px`, right: 'auto', bottom: 'auto' });
  };
  const end = (cancel = false) => {
    const session = drag.current;
    if (!session) return;
    cancelAnimationFrame(frame.current);
    const position = clamp(cancel ? session.origin : session.next);
    paint(position);
    useUI.getState().setPosition(position);
    drag.current = null;
    ignoreClick.current = session.moved && !cancel;
    panel.current?.removeAttribute('data-dragging');
    registerDragCancellation(null);
    if (session.handle.hasPointerCapture(session.pointer)) session.handle.releasePointerCapture(session.pointer);
  };
  useLayoutEffect(() => {
    if (!open) return;
    const resize = () => {
      if (drag.current) end();
      const element = panel.current!;
      // Re-measure the locked CSS dimensions at the new viewport, then clamp.
      for (const property of ['height', 'left', 'right', 'top', 'bottom']) element.style.removeProperty(property);
      const stored = useUI.getState().inspectorPosition;
      if (stored) {
        const next = clamp(stored);
        paint(next);
        if (next.x !== stored.x || next.y !== stored.y) useUI.getState().setPosition(next);
      }
    };
    resize();
    window.addEventListener('resize', resize);
    window.visualViewport?.addEventListener('resize', resize);
    return () => {
      window.removeEventListener('resize', resize);
      window.visualViewport?.removeEventListener('resize', resize);
      cancelAnimationFrame(frame.current);
      if (drag.current) end(true);
    };
  }, [open]);

  return { panel, handleProps: {
    tabIndex: 0, role: 'group', 'aria-label': 'Move inspector',
    'aria-description': 'Drag to move. When focused, use arrow keys to move and Home to restore the default position.',
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (event.button !== 0 || !event.isPrimary || (event.target as HTMLElement).closest('button, input, a, select, [data-no-drag]')) return;
      event.preventDefault();
      const rect = panel.current!.getBoundingClientRect();
      const origin = { x: rect.x, y: rect.y };
      drag.current = { pointer: event.pointerId, start: { x: event.clientX, y: event.clientY }, origin, next: origin, handle: event.currentTarget, moved: false };
      event.currentTarget.setPointerCapture(event.pointerId);
      event.currentTarget.focus({ preventScroll: true });
      useUI.getState().setPopover(null);
      panel.current!.setAttribute('data-dragging', 'true');
      registerDragCancellation(() => end(true));
    },
    onPointerMove(event: PointerEvent<HTMLElement>) {
      const session = drag.current;
      if (!session || session.pointer !== event.pointerId) return;
      session.next = clamp({ x: session.origin.x + event.clientX - session.start.x, y: session.origin.y + event.clientY - session.start.y });
      session.moved ||= Math.hypot(event.clientX - session.start.x, event.clientY - session.start.y) > 3;
      if (frame.current) cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => { if (drag.current) paint(drag.current.next); frame.current = 0; });
    },
    onPointerUp() { end(); }, onPointerCancel() { end(true); }, onLostPointerCapture() { end(); },
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (ignoreClick.current && !(event.target as HTMLElement).closest('button')) { event.preventDefault(); event.stopPropagation(); }
      ignoreClick.current = false;
    },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      if (event.target !== event.currentTarget) return;
      if (event.key === 'Home') {
        event.preventDefault(); useUI.getState().setPosition(null);
        for (const property of ['height', 'left', 'right', 'top', 'bottom']) panel.current!.style.removeProperty(property);
        return;
      }
      const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
      if (!direction) return;
      event.preventDefault();
      const rect = panel.current!.getBoundingClientRect();
      const step = event.shiftKey ? 40 : 10;
      const next = clamp({ x: rect.x + direction[0] * step, y: rect.y + direction[1] * step });
      paint(next); useUI.getState().setPosition(next); useUI.getState().setPopover(null);
    },
  } };
}
