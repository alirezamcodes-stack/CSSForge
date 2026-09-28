import { flip, shift, offset, size } from '@floating-ui/react';

// Shared by menus and tooltips; all floating elements remain in the Shadow Root.
export function placementMiddleware(gap = 4) {
  return [offset(gap), flip({ padding: 8 }), shift({ padding: 8 }), size({ padding: 8, apply({ availableHeight, availableWidth, elements }) {
    Object.assign(elements.floating.style, { maxHeight: `${Math.max(0, availableHeight)}px`, maxWidth: `${Math.max(0, availableWidth)}px` });
  } })];
}
