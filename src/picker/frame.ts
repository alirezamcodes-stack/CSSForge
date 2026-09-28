// One pending frame, regardless of the size of a pointer/scroll burst.
export function frameGate(paint: () => void, request = requestAnimationFrame, cancel = cancelAnimationFrame) {
  let pending: number | null = null;
  return {
    schedule() { if (pending === null) pending = request(() => { pending = null; paint(); }); },
    cancel() { if (pending !== null) cancel(pending); pending = null; },
  };
}
