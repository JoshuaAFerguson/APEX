import { describe, it, expect } from 'vitest';

describe('Screenshot Module Imports', () => {
  it('should export compareScreenshot function', async () => {
    const { compareScreenshot } = await import('../screenshot-comparator');
    expect(typeof compareScreenshot).toBe('function');
  });

  it('should export CompareOptions interface (type check)', () => {
    // This test verifies the TypeScript interface exists at compile time
    const options: import('../screenshot-comparator').CompareOptions = {
      threshold: 0.1,
      includeAlpha: true,
      outputDiff: false
    };

    expect(options.threshold).toBe(0.1);
  });

  it('should export ComparisonResult interface (type check)', () => {
    // This test verifies the TypeScript interface exists at compile time
    const result: import('../screenshot-comparator').ComparisonResult = {
      match: true,
      diffPercentage: 0,
      similarity: 1,
      totalPixels: 100,
      differentPixels: 0
    };

    expect(result.match).toBe(true);
  });

  it('should export ScreenshotComparator class', async () => {
    const { ScreenshotComparator } = await import('../screenshot-comparator');
    expect(typeof ScreenshotComparator).toBe('function');

    const instance = new ScreenshotComparator();
    expect(instance).toBeInstanceOf(ScreenshotComparator);
  });

  it('should export factory functions', async () => {
    const { createScreenshotComparator, compareImages } = await import('../screenshot-comparator');

    expect(typeof createScreenshotComparator).toBe('function');
    expect(typeof compareImages).toBe('function');
  });
});