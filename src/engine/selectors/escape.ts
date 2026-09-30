/** CSSOM identifier serialization fallback for node tests; production uses native CSS.escape. */
export function escapeIdentifier(value: string): string {
  let result = '';
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i), character = value[i];
    if (code === 0) result += '\uFFFD';
    else if ((code >= 1 && code <= 31) || code === 127 || (i === 0 && code >= 48 && code <= 57) || (i === 1 && code >= 48 && code <= 57 && value[0] === '-')) result += `\\${code.toString(16)} `;
    else if (i === 0 && character === '-' && value.length === 1) result += '\\-';
    else if (code >= 128 || character === '-' || character === '_' || /[a-zA-Z0-9]/.test(character)) result += character;
    else result += `\\${character}`;
  }
  return result;
}
/** Quoted CSS string serialization, distinct from identifier escaping. */
export function escapeString(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f"\\]/g, character => {
    const code = character.charCodeAt(0);
    if (code === 0) return '\uFFFD';
    return character === '"' || character === '\\' ? `\\${character}` : `\\${code.toString(16)} `;
  });
}
