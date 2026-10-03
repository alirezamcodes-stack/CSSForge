import { cssLanguage } from '@codemirror/lang-css';

/** Only browser-accepted declarations participate. The supplied declaration is detached,
 * never the page's style; strings/comments are not functions, including in custom values. */
export function inlineStyleHasResourceURL(cssText: string, declaration: CSSStyleDeclaration): boolean {
  declaration.cssText = cssText;
  const source = `x{${declaration.cssText}}`, cursor = cssLanguage.parser.parse(source).cursor();
  do {
    if (cursor.name !== 'CallTag' && cursor.name !== 'Callee') continue;
    // CSSOM leaves escapes in custom properties and pending var() values. Ask the native
    // grammar to identify each function name, without decoding escapes or fetching URLs.
    declaration.cssText = '';
    declaration.setProperty('background-image', `${source.slice(cursor.from, cursor.to)}("data:,")`);
    if (declaration.getPropertyValue('background-image') === 'url("data:,")') return true;
  } while (cursor.next());
  return false;
}
