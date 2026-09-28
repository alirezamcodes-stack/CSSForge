import { cloneElement, useId, useState, type ReactElement, type HTMLAttributes, type Ref, type PointerEvent } from 'react';
import { autoUpdate, useFloating, useHover, useFocus, useInteractions, useRole, useMergeRefs } from '@floating-ui/react';
import { useUI } from '../../state/ui';
import { placementMiddleware } from './placement';
import s from '../ui.module.css';

// Clones the button, so no wrapper changes the locked dock/header geometry.
export function Tooltip({ label, children, disabled = false }: { label: string; children: ReactElement<HTMLAttributes<HTMLElement>>; disabled?: boolean }) {
  const id = useId();
  const active = useUI(state => state.activeTooltip);
  const blocked = useUI(state => !!state.activePopover);
  const [suppressed, setSuppressed] = useState(false);
  const open = active === id && !disabled && !blocked && !suppressed;
  const { refs, floatingStyles, context } = useFloating({ open, onOpenChange: value => {
    if (!value) { setSuppressed(false); if (useUI.getState().activeTooltip === id) useUI.getState().setTooltip(null); }
    else if (!disabled && !blocked) useUI.getState().setTooltip(id);
  }, placement: 'top', strategy: 'fixed', middleware: placementMiddleware(7), whileElementsMounted: autoUpdate });
  const { getReferenceProps, getFloatingProps } = useInteractions([useHover(context, { delay: { open: 550, close: 0 }, move: false }), useFocus(context), useRole(context, { role: 'tooltip' })]);
  const mergedRef = useMergeRefs([refs.setReference, (children.props as { ref?: Ref<HTMLElement> }).ref]);
  return <>{cloneElement(children, { ...getReferenceProps({ ...children.props, onPointerDown: (event: PointerEvent<HTMLElement>) => { setSuppressed(true); useUI.getState().setTooltip(null); children.props.onPointerDown?.(event); } }), ref: mergedRef } as HTMLAttributes<HTMLElement>)}{open && <div ref={refs.setFloating} style={floatingStyles} className={s.tooltip} {...getFloatingProps()}>{label}</div>}</>;
}
