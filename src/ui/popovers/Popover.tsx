import { useRef, type ReactNode } from 'react';
import { autoUpdate, flip, shift, size, useFloating, useClick, useDismiss, useRole, useInteractions, FloatingFocusManager } from '@floating-ui/react';
import { useUI } from '../../state/ui';
import { Icon } from '../shared/Icon';
import s from '../ui.module.css';

export function Popover({ id, label, children, className = '', iconOnly = false }: { id: string; label: ReactNode; children: ReactNode; className?: string; iconOnly?: boolean }) {
  const open = useUI(state => state.activePopover === id);
  const setPopover = useUI(state => state.setPopover);
  const { refs, floatingStyles, context } = useFloating({
    open, onOpenChange: value => setPopover(value ? id : null), placement: 'bottom-start', strategy: 'fixed',
    whileElementsMounted: autoUpdate,
    middleware: [flip({ padding: 8 }), shift({ padding: 8 }), size({ padding: 8, apply({ availableHeight, availableWidth, elements }) {
      Object.assign(elements.floating.style, { maxHeight: `${Math.max(0, availableHeight)}px`, maxWidth: `${Math.max(0, availableWidth)}px` });
    } })],
  });
  const interactions = useInteractions([useClick(context), useDismiss(context), useRole(context, { role: 'dialog' })]);
  const content = useRef<HTMLDivElement>(null);
  return <>
    <button type="button" ref={refs.setReference} className={`${s.popoverTrigger} ${className}`} aria-label={id} {...interactions.getReferenceProps()}>{label}{!iconOnly && <Icon name="chevron" />}</button>
    {open && <FloatingFocusManager context={context} modal={false} returnFocus><div ref={refs.setFloating} style={floatingStyles} className={s.popover} {...interactions.getFloatingProps()} aria-label={id} onKeyDown={event => {
      if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
      const buttons = Array.from(content.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)') ?? []);
      if (!buttons.length) return;
      event.preventDefault();
      const index = buttons.indexOf(event.target as HTMLButtonElement);
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length;
      buttons[next]?.focus();
    }}><div ref={content}>{children}</div></div></FloatingFocusManager>}
  </>;
}
export function Options({ values, value, onChange }: { values: string[]; value: string; onChange: (value: string) => void }) {
  return <>{values.map(option => <button type="button" key={option} className={s.menuOption} aria-pressed={value === option} onClick={() => { onChange(option); useUI.getState().setPopover(null); }}><span>{option}</span>{value === option && <Icon name="check" />}</button>)}</>;
}
