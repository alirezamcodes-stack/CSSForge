import type { ButtonHTMLAttributes } from 'react';
import { ChevronDown, ChevronRight, ChevronLeft, X, Ellipsis, Layers, FileDiff, Ruler, Palette, Pipette, Image, MonitorSmartphone, Power, MousePointer2, Pause, Play, Undo2, Copy, Plus, Check, Crosshair, Type, AlignLeft, AlignCenter, AlignRight, AlignJustify, Code, Eye, EyeOff, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Trash2, RotateCcw, RefreshCw, CornerUpLeft, CornerDownRight, Radius, Minus, Underline, Strikethrough } from 'lucide-react';
import s from '../ui.module.css';
import { Tooltip } from '../interactions/Tooltip';
const icons = { chevron: ChevronDown, chevronRight: ChevronRight, close: X, more: Ellipsis, layers: Layers, changes: FileDiff, ruler: Ruler, palette: Palette, pipette: Pipette, image: Image, screen: MonitorSmartphone, power: Power, cursor: MousePointer2, pause: Pause, play: Play, undo: Undo2, copy: Copy, plus: Plus, check: Check, target: Crosshair, font: Type, alignLeft: AlignLeft, alignCenter: AlignCenter, alignRight: AlignRight, alignJustify: AlignJustify, code: Code, back: ChevronLeft, eye: Eye, eyeOff: EyeOff, up: ArrowUp, down: ArrowDown, left: ArrowLeft, right: ArrowRight, delete: Trash2, reset: RotateCcw, refresh: RefreshCw, parent: CornerUpLeft, child: CornerDownRight, radius: Radius, minus: Minus, underline: Underline, strike: Strikethrough };
export type IconName = keyof typeof icons;
export function Icon({ name }: { name: IconName }) { const Glyph = icons[name]; return <Glyph size={16} strokeWidth={1.75} aria-hidden="true" />; }
export function IconButton({ icon, label, active, className = '', ...props }: { icon: IconName; label: string; active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <Tooltip label={label}><button type="button" className={`${s.iconButton} ${active ? s.active : ''} ${className}`} aria-label={label} {...(active !== undefined ? { 'aria-pressed': active } : {})} {...props}><Icon name={icon} /></button></Tooltip>;
}
