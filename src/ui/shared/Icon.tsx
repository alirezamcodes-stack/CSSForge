import type { ButtonHTMLAttributes } from 'react';
import s from '../ui.module.css';

const paths = {
  chevron: 'm5 8 5 5 5-5', close: 'm5 5 10 10M15 5 5 15', more: 'M4 10h.01M10 10h.01M16 10h.01',
  layers: 'm3 7 7-4 7 4-7 4-7-4Zm0 4 7 4 7-4M3 15l7 4 7-4',
  changes: 'M6 3h8l3 3v11H3V3h3Zm1 5h6M7 11h6M7 14h4',
  ruler: 'M3 3v14h14v-4H7V3H3Zm0 5h3M3 12h3M10 14v3M14 14v3',
  palette: 'M10 3a7 7 0 1 0 0 14h1a2 2 0 0 0 1-4c-1-1 0-2 2-2h1c4 0 1-8-5-8Zm-4 5h.01M9 6h.01M13 7h.01M6 12h.01',
  pipette: 'm12 3 5 5-3 3-5-5 3-3Zm-2 5-7 7v2h2l7-7',
  image: 'M3 4h14v12H3V4Zm0 10 4-4 3 3 2-2 5 4M12 7h.01',
  screen: 'M2 4h12v9H2V4Zm4 12h5M8 13v3M16 8h3v9h-5v-4',
  power: 'M10 2v7M5 5a7 7 0 1 0 10 0',
  cursor: 'm4 2 12 9-6 1-3 6-3-16Z',
  pause: 'M7 5v10M13 5v10', play: 'm6 4 9 6-9 6V4Z',
  undo: 'M6 4 2 8l4 4M2 8h10a5 5 0 1 1-4 8',
  copy: 'M7 3h10v10H7V3ZM4 7H3v10h10v-1',
  plus: 'M10 4v12M4 10h12', check: 'm4 10 4 4 8-8',
  target: 'M10 2v4M10 14v4M2 10h4M14 10h4M10 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Z',
  font: 'm4 16 6-12 6 12M6 12h8',
  alignLeft: 'M3 4h14M3 8h9M3 12h14M3 16h9',
  alignCenter: 'M3 4h14M6 8h8M3 12h14M6 16h8',
  alignRight: 'M3 4h14M8 8h9M3 12h14M8 16h9',
  alignJustify: 'M3 4h14M3 8h14M3 12h14M3 16h14',
  code: 'm7 5-5 5 5 5M13 5l5 5-5 5',
  back: 'm12 4-6 6 6 6', eye: 'M2 10s3-6 8-6 8 6 8 6-3 6-8 6-8-6-8-6Zm8-2a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z',
} as const;
export type IconName = keyof typeof paths;
export function Icon({ name }: { name: IconName }) {
  return <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'more' ? [4, 10, 16].map(cx => <circle key={cx} cx={cx} cy="10" r="1.25" fill="currentColor" stroke="none" />) : <path d={paths[name]} />}</svg>;
}
export function IconButton({ icon, label, active, ...props }: { icon: IconName; label: string; active?: boolean } & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" className={`${s.iconButton} ${active ? s.active : ''}`} aria-label={label} title={label} {...(active !== undefined ? { 'aria-pressed': active } : {})} {...props}><Icon name={icon} /></button>;
}
