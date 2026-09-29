import { useEffect, type RefObject } from 'react';
import { useUI } from '../../state/ui';
import { cancelActiveDrag } from './focus';
import { useInspection } from '../../picker/context';

export function useEscapePolicy(ref: RefObject<HTMLElement | null>) {
  const { picker } = useInspection();
  useEffect(() => {
    const doc = ref.current!.ownerDocument;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.isComposing) return;
      if (event.composedPath().some(node => node instanceof HTMLInputElement && node.hasAttribute('data-escape-cancel'))) return;
      const state = useUI.getState();
      const inside = event.composedPath().includes(ref.current!);
      if (!inside && !state.activePopover && !state.surface && !picker?.getSnapshot().active) return;
      const handled = state.activePopover ? state.dismissTopLayer() : cancelActiveDrag() || (state.surface ? state.dismissTopLayer() : picker?.cancel() || state.dismissTopLayer());
      if (handled) { event.preventDefault(); event.stopPropagation(); }
    };
    doc.addEventListener('keydown', onKey, true);
    return () => doc.removeEventListener('keydown', onKey, true);
  }, [ref, picker]);
}
