import { describe, it, expect } from 'vitest';

describe('ScreenshotComparator - Export Verification', () => {
  it('should export ScreenshotComparator class from main package', async () => {
    const { ScreenshotComparator } = await import('../index');

    expect(ScreenshotComparator).toBeDefined();
    expect(typeof ScreenshotComparator).toBe('function');

    const instance = new ScreenshotComparator();
    expect(instance).toBeInstanceOf(ScreenshotComparator);
  });

  it('should export createScreenshotComparator factory function', async () => {
    const { createScreenshotComparator } = await import('../index');

    expect(createScreenshotComparator).toBeDefined();
    expect(typeof createScreenshotComparator).toBe('function');

    const instance = createScreenshotComparator();
    expect(instance).toBeDefined();
  });

  it('should export compareImages utility function', async () => {
    const { compareImages } = await import('../index');

    expect(compareImages).toBeDefined();
    expect(typeof compareImages).toBe('function');
  });

  it('should export ScreenshotComparator directly from screenshot-comparator module', async () => {
    const { ScreenshotComparator } = await import('../screenshot-comparator');

    expect(ScreenshotComparator).toBeDefined();
    expect(typeof ScreenshotComparator).toBe('function');
  });

  it('should export type definitions from main package', async () => {
    const {
      ScreenshotComparisonOptionsSchema,
      ScreenshotComparisonResultSchema,
      ImageMetadataSchema,
    } = await import('../index');

    expect(ScreenshotComparisonOptionsSchema).toBeDefined();
    expect(ScreenshotComparisonResultSchema).toBeDefined();
    expect(ImageMetadataSchema).toBeDefined();

    // Test schema validation
    const validOptions = { tolerance: 0.1, includeAlpha: false };
    const validatedOptions = ScreenshotComparisonOptionsSchema.parse(validOptions);
    expect(validatedOptions).toEqual({ tolerance: 0.1, includeAlpha: false });

    const validResult = {
      similarity: 0.95,
      differentPixels: 100,
      totalPixels: 2000,
      isMatch: true,
    };
    const validatedResult = ScreenshotComparisonResultSchema.parse(validResult);
    expect(validatedResult).toEqual(validResult);

    const validMetadata = {
      width: 100,
      height: 100,
      channels: 3,
      path: '/test/image.png',
    };
    const validatedMetadata = ImageMetadataSchema.parse(validMetadata);
    expect(validatedMetadata).toEqual(validMetadata);
  });

  it('should maintain type safety with TypeScript inference', async () => {
    const { ScreenshotComparator } = await import('../index');

    // Create instance with typed options
    const comparator = new ScreenshotComparator({
      tolerance: 0.1,
      includeAlpha: true,
      outputDiff: false,
    });

    expect(comparator).toBeInstanceOf(ScreenshotComparator);

    // Verify methods are available
    expect(typeof comparator.compare).toBe('function');
    expect(typeof comparator.compareBuffers).toBe('function');
    expect(typeof comparator.getImageMetadata).toBe('function');
  });

  it('should handle module imports correctly for all scenarios', async () => {
    // Test direct import
    const direct = await import('../screenshot-comparator');
    expect(direct.ScreenshotComparator).toBeDefined();
    expect(direct.createScreenshotComparator).toBeDefined();
    expect(direct.compareImages).toBeDefined();

    // Test index import
    const index = await import('../index');
    expect(index.ScreenshotComparator).toBeDefined();
    expect(index.createScreenshotComparator).toBeDefined();
    expect(index.compareImages).toBeDefined();

    // Verify they're the same classes
    expect(direct.ScreenshotComparator).toBe(index.ScreenshotComparator);
    expect(direct.createScreenshotComparator).toBe(index.createScreenshotComparator);
    expect(direct.compareImages).toBe(index.compareImages);
  });

  it('should properly export all required dependencies', async () => {
    // Test that the module can be imported and instantiated
    // without any missing dependency errors
    const { ScreenshotComparator } = await import('../index');

    let instance;
    expect(() => {
      instance = new ScreenshotComparator({
        tolerance: 0.1,
        includeAlpha: false,
        outputDiff: false,
      });
    }).not.toThrow();

    expect(instance).toBeDefined();
  });
});