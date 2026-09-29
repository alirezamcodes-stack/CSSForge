import type { SourceRule, SourceSheet } from '../sources/model';

/** Flat named layers + ordering statements. Nested/anonymous/conditional layer creation stays uncertain. */
export function layerOrder(sheets: SourceSheet[]) {
  const names: string[] = []; let uncertain = false;
  const add = (name: string) => { if (!/^[-_a-zA-Z][\w-]*$/.test(name)) uncertain = true; else if (!names.includes(name)) names.push(name); };
  const walk = (rules: SourceRule[]) => {
    for (const rule of rules) {
      if (/^@layer\b/.test(rule.cssText)) {
        if (rule.contexts.length) uncertain = true;
        const header = rule.cssText.split(/[;{]/)[0].slice(6).trim();
        if (!header) uncertain = true; else header.split(',').map(item => item.trim()).forEach(add);
      }
      walk(rule.children);
    }
  };
  sheets.filter(sheet => !sheet.disabled).forEach(sheet => walk(sheet.rules));
  return { names, uncertain };
}
