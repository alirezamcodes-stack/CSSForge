import path from 'node:path';

/** Fresh verification output only; checked-in artifacts are historical inputs. */
export function evidencePath(relative: string) {
  const preview = path.resolve('.preview');
  const root = path.resolve(process.env.CSSFORGE_EVIDENCE_DIR ?? '.preview/verification');
  if (!root.startsWith(preview + path.sep)) throw Error('Evidence directory must be inside .preview');
  if (path.isAbsolute(relative)) throw Error('Evidence path must be relative');
  const destination = path.resolve(root, relative.replace(/^artifacts\//, ''));
  if (!destination.startsWith(root + path.sep)) throw Error('Evidence path escaped the run directory');
  return destination;
}
