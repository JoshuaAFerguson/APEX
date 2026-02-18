import { describe, it, expect } from 'vitest';

/**
 * Basic validation test for screenshot functionality
 * This test ensures the core functionality works without requiring external dependencies
 */
describe('Screenshot Basic Validation', () => {
  it('should import screenshot functions without errors', async () => {
    const module = await import('../screenshot-comparator');

    expect(module.compareScreenshot).toBeDefined();
    expect(module.ScreenshotComparator).toBeDefined();
    expect(module.createScreenshotComparator).toBeDefined();
    expect(module.compareImages).toBeDefined();

    expect(typeof module.compareScreenshot).toBe('function');
    expect(typeof module.ScreenshotComparator).toBe('function');
    expect(typeof module.createScreenshotComparator).toBe('function');
    expect(typeof module.compareImages).toBe('function');
  });

  it('should create ScreenshotComparator instance with default options', () => {
    const { ScreenshotComparator } = require('../screenshot-comparator');

    expect(() => {
      new ScreenshotComparator();
    }).not.toThrow();
  });

  it('should create ScreenshotComparator instance with custom options', () => {
    const { ScreenshotComparator } = require('../screenshot-comparator');

    expect(() => {
      new ScreenshotComparator({
        tolerance: 0.2,
        includeAlpha: true,
        outputDiff: false
      });
    }).not.toThrow();
  });

  it('should create instance using factory function', () => {
    const { createScreenshotComparator } = require('../screenshot-comparator');

    expect(() => {
      createScreenshotComparator({ tolerance: 0.1 });
    }).not.toThrow();
  });

  it('should have proper TypeScript type definitions', () => {
    // Type-only test - verifies types compile without runtime execution
    const options: import('../screenshot-comparator').CompareOptions = {
      threshold: 0.1
    };

    const result: Partial<import('../screenshot-comparator').ComparisonResult> = {
      match: true,
      similarity: 1.0
    };

    expect(options.threshold).toBe(0.1);
    expect(result.match).toBe(true);
  });

  it('should validate schema requirements', () => {
    const { ScreenshotComparator } = require('../screenshot-comparator');

    // Valid options should not throw
    expect(() => {
      new ScreenshotComparator({
        tolerance: 0.1,
        includeAlpha: false,
        outputDiff: true,
        diffColor: [255, 0, 255]
      });
    }).not.toThrow();

    // Invalid tolerance should throw
    expect(() => {
      new ScreenshotComparator({
        tolerance: -0.1 // Invalid: below 0
      });
    }).toThrow();

    expect(() => {
      new ScreenshotComparator({
        tolerance: 1.5 // Invalid: above 1
      });
    }).toThrow();
  });

  it('should export from main core package', async () => {
    const coreModule = await import('../index');

    expect(coreModule.compareScreenshot).toBeDefined();
    expect(coreModule.ScreenshotComparator).toBeDefined();
    expect(coreModule.createScreenshotComparator).toBeDefined();
    expect(coreModule.compareImages).toBeDefined();
  });
});