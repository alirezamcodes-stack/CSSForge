import { describe, expect, it } from 'vitest';
import { clampPosition } from '../src/ui/interactions/geometry';

describe('inspector viewport clamping', () => {
  it('preserves in-bounds positions', () => {
    expect(clampPosition({ x: 100, y: 24 }, { width: 350, height: 700 }, { width: 1440, height: 900 })).toEqual({ x: 100, y: 24 });
  });
  it('clamps every edge with a safe margin', () => {
    expect(clampPosition({ x: -500, y: -500 }, { width: 350, height: 700 }, { width: 1440, height: 900 })).toEqual({ x: 8, y: 8 });
    expect(clampPosition({ x: 2000, y: 2000 }, { width: 350, height: 700 }, { width: 1440, height: 900 })).toEqual({ x: 1082, y: 192 });
  });
  it('keeps the header reachable even while old dimensions exceed a resized viewport', () => {
    expect(clampPosition({ x: 800, y: 400 }, { width: 350, height: 900 }, { width: 320, height: 450 })).toEqual({ x: 8, y: 8 });
  });
});
