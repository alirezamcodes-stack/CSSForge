// Phase 01 demonstration data only. No page inspection or editing occurs.
export const selected = { selector: 'div.hero-card', dimensions: '993 × 585.88', font: 'Inter', size: 18 };
export const declarations = [
  ['display', 'flex'], ['flex-direction', 'column'], ['gap', '24px'],
  ['padding', '32px'], ['background', '#24262C'], ['border-radius', '16px'],
  ['box-shadow', '0 12px 32px rgba(0, 0, 0, 0.12)'], ['color', '#FFFFFF'],
  ['font-family', 'Inter, -apple-system, sans-serif'], ['font-size', '18px'],
  ['line-height', '1.5'], ['text-align', 'left'], ['width', '100%'], ['height', 'auto'],
];
export const filters = [ ['Blur', 0, 20, 'px'], ['Contrast', 100, 200, '%'], ['Brightness', 100, 200, '%'], ['Saturate', 100, 200, '%'], ['Invert', 0, 100, '%'], ['Grayscale', 0, 100, '%'], ['Sepia', 0, 100, '%'] ] as const;
export type FixtureNode = { id: string; tag: string; name?: string; text?: string; children?: FixtureNode[] };
export const dom: FixtureNode = { id: 'body', tag: 'body', children: [
  { id: 'header', tag: 'header', name: 'site-header' },
  { id: 'main', tag: 'main', children: [{ id: 'section', tag: 'section', name: 'hero', children: [
    { id: 'card', tag: 'div', name: 'hero-card', children: [
      { id: 'label', tag: 'span', name: 'eyebrow', text: 'A little more room to create.' },
      { id: 'title', tag: 'h1', text: 'Make space for good ideas.' },
      { id: 'description', tag: 'p', name: 'description', text: 'Objects for a considered everyday.' },
      { id: 'link', tag: 'a', name: 'explore-link', text: 'Explore the collection' },
    ] },
  ] }] },
  { id: 'footer', tag: 'footer', name: 'site-footer' },
] };
export const changes = [
  { selector: '.hero-card', items: [['padding', '24px', '32px'], ['border-radius', '8px', '16px'], ['background', '#1B1D22', '#24262C']] },
  { selector: '.hero-card h1', items: [['font-size', '48px', '56px'], ['letter-spacing', '0px', '-2px']] },
];
