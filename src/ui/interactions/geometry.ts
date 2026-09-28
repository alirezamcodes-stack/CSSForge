import type { Position } from '../../state/ui';

export function clampPosition(position: Position, panel: { width: number; height: number }, viewport: { width: number; height: number }, margin = 8): Position {
  return {
    x: Math.max(margin, Math.min(position.x, Math.max(margin, viewport.width - panel.width - margin))),
    y: Math.max(margin, Math.min(position.y, Math.max(margin, viewport.height - panel.height - margin))),
  };
}
