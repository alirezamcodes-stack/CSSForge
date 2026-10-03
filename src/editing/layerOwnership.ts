// Shared with native structure safety: only exact live session layers are internal.
// Attributes are page-controlled metadata; retired nodes must become ordinary page nodes.
const editLayers = new WeakSet<Node>();

export function ownEditLayer(layer: HTMLStyleElement) { editLayers.add(layer); }
export function isEditLayer(node: Node) { return editLayers.has(node); }
export function releaseEditLayer(layer?: HTMLStyleElement) {
  if (!layer) return;
  editLayers.delete(layer);
  layer.remove();
}
