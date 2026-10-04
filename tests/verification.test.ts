import path from 'node:path';
import { afterEach, expect, test, vi } from 'vitest';
import { evidencePath } from './e2e/evidence';

afterEach(() => vi.unstubAllEnvs());

test('legacy evidence names belong to the selected fresh run, not historical artifacts', () => {
  vi.stubEnv('CSSFORGE_EVIDENCE_DIR', '.preview/verification/run-a');
  const first = evidencePath('artifacts/screenshots/phase-06.5.3/view.png');
  expect(first).toBe(path.resolve('.preview/verification/run-a/screenshots/phase-06.5.3/view.png'));
  vi.stubEnv('CSSFORGE_EVIDENCE_DIR', '.preview/verification/run-b');
  expect(evidencePath('artifacts/screenshots/phase-06.5.3/view.png')).not.toBe(first);
});

test('evidence destinations cannot escape a fresh run or target historical files', () => {
  vi.stubEnv('CSSFORGE_EVIDENCE_DIR', '.preview/verification/run-a');
  expect(() => evidencePath('../prior-run/capture.png')).toThrow('escaped');
  expect(() => evidencePath(path.resolve('artifacts/capture.png'))).toThrow('relative');
  vi.stubEnv('CSSFORGE_EVIDENCE_DIR', 'artifacts/diagnostics');
  expect(() => evidencePath('capture.png')).toThrow('inside .preview');
  vi.stubEnv('CSSFORGE_EVIDENCE_DIR', '.preview');
  expect(() => evidencePath('capture.png')).toThrow('inside .preview');
});

test('a sibling prefix is not inside the generated evidence boundary', () => {
  vi.stubEnv('CSSFORGE_EVIDENCE_DIR', '.preview-historical/run-a');
  expect(() => evidencePath('capture.png')).toThrow('inside .preview');
});
