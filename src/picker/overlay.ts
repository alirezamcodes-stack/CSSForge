import { dimensions, type TargetRect } from './identity';
import tokens from '../styles/tokens.css?inline';

export function createOverlay(doc: Document) {
  const host = doc.createElement('cssforge-overlay');
  host.setAttribute('aria-hidden', 'true');
  // Important resets resist host-page styles without touching any host element.
  host.style.cssText = 'all:initial!important;position:fixed!important;inset:0!important;width:100%!important;height:100%!important;pointer-events:none!important;z-index:2147483645!important;';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = doc.createElement('style');
  style.textContent = tokens + ':host{pointer-events:none}*{box-sizing:border-box;pointer-events:none!important}.outline{position:fixed;border:1.5px solid #52edaa;background:#52edaa08;display:none}.outline[data-mode=hover]{border-style:dashed}.label{position:fixed;display:none;max-width:calc(100vw - 16px);padding:4px 7px;border-radius:4px;background:#1b1c1f;color:#b7f5d0;font:11px/16px var(--font-ui);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 2px 8px #0003}.label b{font-weight:400;color:#d0d3d4;margin-left:10px}';
  const outline = doc.createElement('div');
  outline.className = 'outline'; outline.dataset.testid = 'target-outline';
  const label = doc.createElement('div'); label.className = 'label'; label.dataset.testid = 'target-label';
  const identity = doc.createElement('span'); const size = doc.createElement('b');
  label.append(identity, size); shadow.append(style, outline, label);
  doc.documentElement.append(host);
  let previous = '';
  return {
    host,
    hide() { outline.style.display = label.style.display = 'none'; previous = ''; },
    paint(rect: TargetRect, text: string, mode: 'hover' | 'selected') {
      const win = doc.defaultView!;
      const key = JSON.stringify([rect, text, mode, win.innerWidth, win.innerHeight]);
      if (key === previous) return;
      previous = key;
      Object.assign(outline.style, { display: 'block', left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
      outline.dataset.mode = mode;
      identity.textContent = text; size.textContent = dimensions(rect);
      label.style.display = 'block';
      const width = label.getBoundingClientRect().width;
      label.style.left = `${Math.max(8, Math.min(rect.x, win.innerWidth - width - 8))}px`;
      label.style.top = `${Math.max(8, Math.min(rect.y >= 32 ? rect.y - 28 : rect.y + 4, win.innerHeight - 32))}px`;
    },
    destroy() { host.remove(); },
  };
}
