import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve('artifacts');
const backup = path.resolve('.preview/current-ui-audit-baseline');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function files(dir) {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, item.name);
    if (item.isDirectory()) result.push(...await files(full)); else result.push(full);
  }
  return result;
}
if (process.argv[2] === 'snapshot') {
  const manifest = [];
  for (const file of await files(root)) {
    const relative = path.relative(root, file);
    if (relative.startsWith('diagnostics' + path.sep + 'current-ui-audit')) continue;
    const copy = path.join(backup, relative);
    await mkdir(path.dirname(copy), { recursive: true });
    await writeFile(copy, await readFile(file)); manifest.push(relative);
  }
  const protectedFiles = [...await files(path.resolve('src')), ...await files(path.resolve('entrypoints')),
    ...await files(path.resolve('tests'))].filter(file => !path.basename(file).startsWith('current-ui-'));
  const protectedHashes = {};
  for (const file of protectedFiles) protectedHashes[path.relative(process.cwd(), file)] = hash(await readFile(file));
  await writeFile(path.join(backup, 'manifest.json'), JSON.stringify({ manifest, protectedHashes }));
  console.log(`Saved ${manifest.length} locked artifacts and ${protectedFiles.length} protected source/test hashes.`);
} else if (process.argv[2] === 'restore') {
  const { manifest, protectedHashes } = JSON.parse(await readFile(path.join(backup, 'manifest.json'), 'utf8'));
  for (const relative of manifest) {
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw Error('Artifact path escaped workspace');
    const original = await readFile(path.join(backup, relative)); await writeFile(file, original);
    if (!(await readFile(file)).equals(original)) throw Error(`Locked artifact differs: ${relative}`);
  }
  for (const [file, expected] of Object.entries(protectedHashes)) {
    if (hash(await readFile(file)) !== expected) throw Error(`Protected source/test changed: ${file}`);
  }
  console.log(`Restored/byte-verified ${manifest.length} locked artifacts; ${Object.keys(protectedHashes).length} protected files unchanged.`);
} else throw Error('Expected snapshot or restore');
