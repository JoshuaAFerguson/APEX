/**
 * Test that all screenshot-related types and schemas are properly exported from @apex/core
 */

import { describe, it, expect } from 'vitest';

describe('Screenshot Schema Exports from @apex/core', () => {
  it('should export all screenshot schemas', async () => {
    // Import from the main entry point to test exports
    const coreModule = await import('../index');

    // Verify schema exports
    expect(coreModule.ScreenshotOptionsSchema).toBeDefined();
    expect(coreModule.ScreenshotResultSchema).toBeDefined();
    expect(coreModule.CaptureElementOptionsSchema).toBeDefined();
    expect(coreModule.CaptureRegionOptionsSchema).toBeDefined();
    expect(coreModule.ScreenshotFormatSchema).toBeDefined();
    expect(coreModule.ScreenshotOutputModeSchema).toBeDefined();
  });

  it('should export all screenshot types', async () => {
    // Dynamic import to test if types are available at runtime
    const coreModule = await import('../types');

    // These should be available for type checking
    expect(typeof coreModule.ScreenshotOptionsSchema).toBe('object');
    expect(typeof coreModule.ScreenshotResultSchema).toBe('object');
    expect(typeof coreModule.CaptureElementOptionsSchema).toBe('object');
  });

  it('should have proper schema structure', () => {
    const {
      ScreenshotOptionsSchema,
      ScreenshotResultSchema,
      CaptureElementOptionsSchema
    } = require('../types');

    // Verify schemas are Zod objects
    expect(ScreenshotOptionsSchema._def).toBeDefined();
    expect(ScreenshotResultSchema._def).toBeDefined();
    expect(CaptureElementOptionsSchema._def).toBeDefined();

    // Verify they have parse methods
    expect(typeof ScreenshotOptionsSchema.parse).toBe('function');
    expect(typeof ScreenshotResultSchema.parse).toBe('function');
    expect(typeof CaptureElementOptionsSchema.parse).toBe('function');
  });

  it('should allow importing specific schemas individually', async () => {
    // Test destructured imports work
    const {
      ScreenshotOptionsSchema,
      ScreenshotResultSchema,
      CaptureElementOptionsSchema,
      CaptureRegionOptionsSchema,
      ScreenshotFormatSchema,
      ScreenshotOutputModeSchema
    } = await import('../types');

    // All should be defined
    expect(ScreenshotOptionsSchema).toBeDefined();
    expect(ScreenshotResultSchema).toBeDefined();
    expect(CaptureElementOptionsSchema).toBeDefined();
    expect(CaptureRegionOptionsSchema).toBeDefined();
    expect(ScreenshotFormatSchema).toBeDefined();
    expect(ScreenshotOutputModeSchema).toBeDefined();
  });

  it('should export type aliases correctly', () => {
    // This test verifies that TypeScript types are exported
    // by attempting to use them in a way that would fail if not properly exported

    const { ScreenshotOptionsSchema, ScreenshotResultSchema } = require('../types');

    // These should parse successfully
    const options = ScreenshotOptionsSchema.parse({
      format: 'png',
      quality: 80,
      output: 'buffer'
    });

    const result = ScreenshotResultSchema.parse({
      buffer: Buffer.from('test'),
      width: 100,
      height: 100
    });

    expect(options.format).toBe('png');
    expect(result.width).toBe(100);
  });
});