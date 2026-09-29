export type Preset = { name: string; group: string; css: string };
export const backgroundPresets: Preset[] = [
  ['Porcelain','Neutral','#f7f7f2','#cdd3cd'],['Limestone','Neutral','#e4ddd1','#9da69a'],['Mist','Neutral','#f4f5f7','#c3cad7'],['Graphite','Neutral','#737982','#30353e'],
  ['Terracotta','Warm','#f0c5a4','#bd5e50'],['Amber','Warm','#ffe4a5','#d99a55'],['Apricot','Warm','#ffe6c5','#ef9c82'],['Rosewood','Warm','#d6a6a9','#76545e'],
  ['Glacier','Cool','#d8f5ee','#7c9be1'],['Tidal','Cool','#84d4cf','#345c91'],['Periwinkle','Cool','#d9d8ff','#858fc6'],['Arctic','Cool','#e7f6ff','#92b8c9'],
  ['Citrus','Vibrant','#efff80','#78d49c'],['Orchid','Vibrant','#ecacff','#7c72f2'],['Coral','Vibrant','#ffcb85','#f36f78'],['Electric','Vibrant','#75e0ed','#7274ef'],
  ['Pistachio','Pastel','#e8efcf','#b8d7be'],['Lavender','Pastel','#e6dcf5','#bcbadd'],['Petal','Pastel','#f5e5ea','#dfbfc6'],['Sky','Pastel','#e8f2fa','#b3d6e8'],
  ['Midnight','Dark','#343c61','#161d31'],['Forest','Dark','#3d5c50','#192f2b'],['Plum','Dark','#68506b','#2d233d'],['Obsidian','Dark','#414a53','#1b2028'],
  ['Frost','Glass-like','#ffffff66','#d6e8ff18'],['Pearl','Glass-like','#fff8e866','#ffffff14'],['Sea glass','Glass-like','#b8ffde66','#cdeaff18'],['Smoke','Glass-like','#cad0d933','#ffffff08'],
].map(([name,group,start,end]) => ({ name, group, css: `linear-gradient(135deg, ${start} 0%, ${end} 100%)` }));
export const boxPresets: Preset[] = [
  { name:'Subtle', group:'Subtle', css:'0 2px 4px #00000014' },
  { name:'Subtle Soft', group:'Subtle', css:'0 3px 12px #00000012' },
  { name:'Subtle Border', group:'Subtle', css:'0 0 0 1px #1b243018, 0 2px 4px #00000008' },
  { name:'Card', group:'Elevation', css:'0 4px 8px #00000014, 0 1px 2px #0000000f' },
  { name:'Elevated', group:'Elevation', css:'0 12px 22px #00000040' },
  { name:'Floating', group:'Elevation', css:'0 18px 40px -8px #13233840, 0 4px 8px #1323381a' },
  { name:'Soft', group:'Floating', css:'0 8px 24px #1a283314' },
  { name:'Wide', group:'Floating', css:'0 20px 50px -12px #18263445' },
  { name:'Strong', group:'Floating', css:'0 10px 20px #101c364d' },
  { name:'Inset Light', group:'Inset', css:'inset 0 1px 3px #ffffff88' },
  { name:'Inset Dark', group:'Inset', css:'inset 0 2px 6px #00000040' },
  { name:'Pressed', group:'Inset', css:'inset 0 2px 4px #00000033, inset 0 -1px 0 #ffffff55' },
  { name:'Outline', group:'Accent', css:'0 0 0 2px #6be8ac' },
  { name:'Glow', group:'Accent', css:'0 0 20px #6be8ac66' },
  { name:'Lift', group:'Accent', css:'0 16px 14px -14px #00000080' },
];
export const textPresets: Preset[] = [
  { name:'Subtle', group:'Text', css:'0 1px 1px #00000026' }, { name:'Soft', group:'Text', css:'0 4px 3px #00000055' },
  { name:'Strong', group:'Text', css:'0 3px 2px #00000080' }, { name:'Outline', group:'Text', css:'1px 0 #15191f, -1px 0 #15191f, 0 1px #15191f, 0 -1px #15191f' },
  { name:'Glow', group:'Text', css:'0 0 6px #52edaa, 0 0 14px #52edaa66' }, { name:'Retro', group:'Text', css:'2px 2px #f19b71, 4px 4px #544566' },
  { name:'Raised', group:'Text', css:'0 1px #999, 0 2px #777, 0 3px 3px #0006' }, { name:'Emboss', group:'Text', css:'0 1px 0 #ffffffaa, 0 -1px 0 #00000040' },
];
