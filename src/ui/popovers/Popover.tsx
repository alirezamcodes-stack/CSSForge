import { Fragment, useRef, useCallback, type ReactNode } from 'react';
import { autoUpdate, useFloating, useClick, useDismiss, useRole, useInteractions, FloatingFocusManager, FloatingPortal } from '@floating-ui/react';
import { useUI } from '../../state/ui';
import { Icon } from '../shared/Icon';
import s from '../ui.module.css';
import { placementMiddleware } from '../interactions/placement';
import { getUIRoot, registerPopoverTrigger } from '../interactions/focus';
import { Tooltip } from '../interactions/Tooltip';

export function Popover({ id, label, children, className = '', iconOnly = false, portal = false, interactionLocked = false }: { id: string; label: ReactNode; children: ReactNode; className?: string; iconOnly?: boolean; portal?: boolean; interactionLocked?: boolean }) {
  const open = useUI(state => state.activePopover === id);
  const setPopover = useUI(state => state.setPopover);
  const { refs, floatingStyles, context } = useFloating({
    open, onOpenChange: value => { if (value || useUI.getState().activePopover === id) setPopover(value ? id : null); }, placement: iconOnly ? 'top-start' : 'bottom-start', strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: placementMiddleware(),
  });
  const interactions = useInteractions([useClick(context), useDismiss(context, { escapeKey: false, outsidePress: !interactionLocked, outsidePressEvent: 'pointerdown' }), useRole(context, { role: 'dialog' })]);
  const setReference = useCallback((node: HTMLButtonElement | null) => { refs.setReference(node); registerPopoverTrigger(id, node); }, [id, refs.setReference]);
  const content = useRef<HTMLDivElement>(null);
  const FloatingHost = portal ? FloatingPortal : Fragment;
  return <>
    <Tooltip label={id} disabled={!iconOnly || open}><button type="button" ref={setReference} className={`${s.popoverTrigger} ${className}`} aria-label={id} data-active={iconOnly && open ? 'true' : undefined} {...interactions.getReferenceProps()} onKeyDown={event => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); setPopover(id); }
    }}><span className={s.triggerLabel}>{label}</span>{!iconOnly && <Icon name="chevron" />}</button></Tooltip>
    {open && <FloatingHost {...(portal ? { root: getUIRoot() } : {})}><FloatingFocusManager context={context} modal={false} closeOnFocusOut={!interactionLocked} returnFocus><div ref={refs.setFloating} style={floatingStyles} className={s.popover} {...interactions.getFloatingProps()} aria-label={id} onKeyDown={event => {
      if (event.defaultPrevented) return;
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="slider"], [role="textbox"], [role="spinbutton"], [role="combobox"]')) return;
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(content.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}><div ref={content}>{children}</div></div></FloatingFocusManager></FloatingHost>}
  </>;
}
export function Options({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) {
  return <>{values.map(option => <button type="button" key={option} className={s.menuOption} aria-pressed={value === option} onClick={() => { onChange(option); useUI.getState().setPopover(null); }}><span>{option}</span>{value === option && <Icon name="check" />}</button>)}</>;
}
