import { describe, expect, it } from 'vitest';
import { calculateReadingProgress } from './articleReading.mjs';

describe('calculateReadingProgress', () => {
  it('calculates and clamps article reading progress', () => {
    expect(calculateReadingProgress(0, 100, 1000, 500)).toBe(0);
    expect(calculateReadingProgress(350, 100, 1000, 500)).toBe(50);
    expect(calculateReadingProgress(900, 100, 1000, 500)).toBe(100);
  });

  it('handles articles shorter than the viewport', () => {
    expect(calculateReadingProgress(100, 100, 300, 800)).toBe(0);
    expect(calculateReadingProgress(101, 100, 300, 800)).toBe(100);
  });
});
