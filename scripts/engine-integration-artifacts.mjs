import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const root = path.resolve('artifacts');
const backup = path.resolve('.preview/engine-integration-baseline');
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
    if (relative.startsWith('diagnostics' + path.sep + 'engine-integration')) continue;
    const copy = path.join(backup, relative);
    await mkdir(path.dirname(copy), { recursive: true });
    await writeFile(copy, await readFile(file)); manifest.push(relative);
  }
  await writeFile(path.join(backup, 'manifest.json'), JSON.stringify(manifest));
  console.log(`Saved ${manifest.length} locked artifact files.`);
} else if (process.argv[2] === 'restore') {
  const manifest = JSON.parse(await readFile(path.join(backup, 'manifest.json'), 'utf8'));
  for (const relative of manifest) {
    const file = path.resolve(root, relative);
    if (!file.startsWith(root + path.sep)) throw Error('Artifact path escaped workspace');
    const original = await readFile(path.join(backup, relative));
    await writeFile(file, original);
    if (!(await readFile(file)).equals(original)) throw Error(`Locked artifact differs: ${relative}`);
  }
  console.log(`Restored and byte-verified ${manifest.length} locked artifact files.`);
} else throw Error('Expected snapshot or restore');
