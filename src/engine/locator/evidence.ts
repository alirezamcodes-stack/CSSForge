import type { ElementEvidence, EvidenceKey } from './model';

const boundedValue = (value: string | null) => !!value && value.length <= 160 && !/[\u0000-\u001f\u007f]/.test(value);
const generated = (value: string) => /^(?:[a-f\d]{16,}|[a-f\d]{8}-(?:[a-f\d]{4}-){3}[a-f\d]{12}|:r\w+:|_r_\w+_|(?:react|vue|radix|headlessui)[-_])/i.test(value);
export const stableID = (value: string | null): value is string => boundedValue(value) && !generated(value!);
export const stableData = (name: string, value: string): boolean => !name.startsWith('data-cssforge') && !/^data-(?:react|vue|v-|svelte|ng-|radix|headlessui|transition)/i.test(name) && !generated(value) && boundedValue(value) && /^(?:data-testid|data-test|data-id|data-key|data-[a-z][a-z\d-]*-(?:id|key))$/.test(name);
export const meaningfulClass = (value: string) => boundedValue(value) && !generated(value) && !/^(?:(?:is|has|css|sc)[-_]|[a-f\d]{6,}$|active$|selected$|hover$|focus$|open$|closed$|loading$|disabled$|(?:p[trblxy]?|m[trblxy]?|text|bg|flex|grid|gap|w|h|border|rounded)-|.*__[a-z\d]{6,}$)/i.test(value);
const semantic = new Set(['name', 'type', 'role', 'aria-label', 'aria-labelledby']);

export function captureEvidence(element: Element): ElementEvidence {
  const attributes: { name: string; value: string; kind: 'stable' | 'semantic' }[] = [];
  for (let i = 0; i < Math.min(element.attributes.length, 32); i++) {
    const { name, value } = element.attributes[i];
    if (name.startsWith('data-cssforge') || name === 'style' || !boundedValue(value)) continue;
    if (stableData(name, value)) attributes.push({ name, value, kind: 'stable' });
    else if (semantic.has(name) || (name === 'href' && element.localName === 'a') || (name === 'src' && ['img', 'iframe', 'video'].includes(element.localName))) attributes.push({ name, value, kind: 'semantic' });
  }
  const classes: string[] = [];
  for (let i = 0; i < Math.min(element.classList.length, 32); i++) if (meaningfulClass(element.classList[i])) classes.push(element.classList[i]);
  let index = 0, previous = element.previousElementSibling;
  while (previous && index < 32) { index++; previous = previous.previousElementSibling; }
  const id = element.getAttribute('id');
  return Object.freeze({ namespace: element.namespaceURI, tag: element.localName, id: stableID(id) ? id : undefined, attributes: Object.freeze(attributes.map(item => Object.freeze(item))), classes: Object.freeze(classes.sort()), sibling: Object.freeze({ index, truncated: !!previous }) });
}
export function evidenceKeys(evidence: ElementEvidence): EvidenceKey[] {
  const keys: EvidenceKey[] = [];
  const key = (kind: EvidenceKey['kind'], attributes: EvidenceKey['attributes']) => keys.push({ kind, attributes, uniqueAtCapture: false });
  if (evidence.id) key('id', [{ name: 'id', value: evidence.id }]);
  evidence.attributes.filter(item => item.kind === 'stable').slice(0, 6).forEach(item => key('data', [item]));
  const semantics = evidence.attributes.filter(item => item.kind === 'semantic');
  if (semantics.length >= 2 && semantics.some(item => ['name', 'aria-label', 'aria-labelledby', 'href', 'src'].includes(item.name))) key('semantic', semantics);
  return keys;
}
/** Classes/index/text cannot authorize identity. Hard incompatibilities always win. */
export function incompatibilities(expected: ElementEvidence, candidate: ElementEvidence): string[] {
  const reasons: string[] = [];
  if (expected.namespace !== candidate.namespace) reasons.push('namespace changed');
  if (expected.tag !== candidate.tag) reasons.push('tag changed');
  if (expected.id && expected.id !== candidate.id) reasons.push('stable ID changed');
  for (const item of expected.attributes) if (!candidate.attributes.some(next => next.name === item.name && next.value === item.value)) reasons.push(`${item.name} changed`);
  return reasons;
}
