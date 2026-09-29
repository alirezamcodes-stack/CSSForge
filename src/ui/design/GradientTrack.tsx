import { useEffect, useRef } from 'react';
import type { Gradient } from '../../editing/rich';
import b from './background.module.css';

// Transient handle input only; serialization and undo stay in the existing editor.
export function GradientTrack({ gradient, selected, onSelect, onPosition, onCancel }: {
  gradient: Gradient; selected: number; onSelect: (index: number) => void;
  onPosition: (index: number, position: string, gesture: string) => void;
  onCancel: (gesture: string) => void;
}) {
  const track = useRef<HTMLDivElement>(null);
  const drag = useRef<{ index: number; x: number; width: number; initial: number; gesture: string; moved?: boolean } | null>(null);
  const frame = useRef(0), pending = useRef<number | null>(null);
  const callback = useRef(onPosition); callback.current = onPosition;
  useEffect(() => () => cancelAnimationFrame(frame.current), []);
  const flush = () => { cancelAnimationFrame(frame.current); frame.current = 0; if (drag.current && pending.current !== null) callback.current(drag.current.index, `${pending.current}%`, drag.current.gesture); pending.current = null; };
  const cancel = () => { cancelAnimationFrame(frame.current); frame.current = 0; pending.current = null; if (drag.current) onCancel(drag.current.gesture); drag.current = null; };
  return <div className={b.trackArea}>
    <div ref={track} className={b.track} aria-label="Gradient stop track" style={{ backgroundImage: `linear-gradient(to right, ${gradient.stops.map(stop => `${stop.color} ${stop.position}`).join(', ')})` }}>
      {gradient.stops.map((stop, index) => {
        const percentage = stop.position.endsWith('%');
        const draggable = percentage; // Other units and implicit stops retain their existing text controls.
        const position = percentage ? Math.max(0, Math.min(100, parseFloat(stop.position))) : index / (gradient.stops.length - 1) * 100;
        return <button key={index} type="button" aria-label={`Select gradient stop ${index + 1}`} aria-pressed={selected === index} data-draggable={draggable} data-escape-cancel
          title={`Stop ${index + 1} · ${stop.position || 'auto'}${draggable ? ' · drag or use arrows' : ' · edit position in the row'}`} style={{ left: `${position}%`, zIndex: selected === index ? 2 : 1 }}
          onClick={() => onSelect(index)} onFocus={() => onSelect(index)}
          onPointerDown={event => { if (event.button !== 0) return; onSelect(index); if (!draggable) return; event.currentTarget.setPointerCapture(event.pointerId); drag.current = { index, x: event.clientX, width: track.current!.getBoundingClientRect().width, initial: parseFloat(stop.position), gesture: crypto.randomUUID() }; }}
          onPointerMove={event => { const active = drag.current; if (!active || !active.moved && Math.abs(event.clientX - active.x) < 3) return; active.moved = true; pending.current = Number(Math.max(0, Math.min(100, active.initial + (event.clientX - active.x) / active.width * 100)).toFixed(1)); if (!frame.current) frame.current = requestAnimationFrame(flush); }}
          onPointerUp={() => { flush(); drag.current = null; }} onPointerCancel={cancel}
          onKeyDown={event => { if (event.key === 'Escape' && drag.current) { event.preventDefault(); event.stopPropagation(); cancel(); } else if (draggable && ['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); onPosition(index, `${Math.max(0, Math.min(100, parseFloat(stop.position) + (event.key === 'ArrowRight' ? 1 : -1) * (event.shiftKey ? 10 : 1)))}%`, crypto.randomUUID()); } }}>
          <span className={b.handle} style={{ backgroundColor: stop.color }} /><span className={b.handleNumber}>{index + 1}</span>
        </button>;
      })}
    </div>
    <div className={b.trackScale}><span>0%</span><span>100%</span></div>
  </div>;
}
