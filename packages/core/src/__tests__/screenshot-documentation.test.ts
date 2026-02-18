/**
 * Tests to verify screenshot schemas are properly documented and example-friendly
 */

import { describe, it, expect } from 'vitest';
import {
  ScreenshotOptionsSchema,
  ScreenshotResultSchema,
  CaptureElementOptionsSchema,
  CaptureRegionOptionsSchema,
  ScreenshotFormatSchema,
  ScreenshotOutputModeSchema
} from '../types';

describe('Screenshot Schema Documentation Examples', () => {
  describe('Basic Usage Examples', () => {
    it('should demonstrate simple screenshot capture', () => {
      // Example: Basic screenshot with defaults
      const basicOptions = ScreenshotOptionsSchema.parse({});

      expect(basicOptions).toEqual({
        format: 'png',
        quality: 80,
        output: 'buffer',
        fullPage: false,
        omitBackground: false
      });

      // Example: Screenshot result with buffer
      const basicResult = ScreenshotResultSchema.parse({
        buffer: Buffer.from('example image data'),
        width: 1920,
        height: 1080
      });

      expect(basicResult.buffer).toBeDefined();
      expect(basicResult.width).toBe(1920);
      expect(basicResult.height).toBe(1080);
    });

    it('should demonstrate file-based screenshot', () => {
      // Example: Save screenshot to file
      const fileOptions = ScreenshotOptionsSchema.parse({
        format: 'png',
        output: 'file',
        path: '/path/to/screenshot.png'
      });

      expect(fileOptions.output).toBe('file');
      expect(fileOptions.path).toBe('/path/to/screenshot.png');

      // Example: File-based result
      const fileResult = ScreenshotResultSchema.parse({
        path: '/path/to/screenshot.png',
        width: 800,
        height: 600,
        format: 'png',
        capturedAt: new Date()
      });

      expect(fileResult.path).toBe('/path/to/screenshot.png');
      expect(fileResult.capturedAt).toBeInstanceOf(Date);
    });

    it('should demonstrate high-quality JPEG screenshot', () => {
      // Example: High-quality JPEG for photos/complex images
      const jpegOptions = ScreenshotOptionsSchema.parse({
        format: 'jpeg',
        quality: 95,
        output: 'file',
        path: '/screenshots/high-quality.jpg'
      });

      expect(jpegOptions.format).toBe('jpeg');
      expect(jpegOptions.quality).toBe(95);
    });
  });

  describe('Element Capture Examples', () => {
    it('should demonstrate element-specific screenshot', () => {
      // Example: Capture specific element
      const elementOptions = CaptureElementOptionsSchema.parse({
        selector: '#main-content',
        format: 'png',
        padding: 20
      });

      expect(elementOptions.selector).toBe('#main-content');
      expect(elementOptions.padding).toBe(20);
      expect(elementOptions.output).toBe('buffer'); // Inherits default
    });

    it('should demonstrate complex element selector', () => {
      // Example: Complex CSS selector with padding
      const complexSelector = CaptureElementOptionsSchema.parse({
        selector: '.article-container > .content:nth-child(2)',
        format: 'jpeg',
        quality: 90,
        output: 'file',
        path: '/captures/article-content.jpg',
        padding: 15,
        omitBackground: true
      });

      expect(complexSelector.selector).toContain('nth-child');
      expect(complexSelector.omitBackground).toBe(true);
    });
  });

  describe('Region Capture Examples', () => {
    it('should demonstrate region-specific screenshot', () => {
      // Example: Capture specific screen region
      const regionOptions = CaptureRegionOptionsSchema.parse({
        x: 100,
        y: 200,
        width: 500,
        height: 300,
        format: 'png'
      });

      expect(regionOptions.x).toBe(100);
      expect(regionOptions.y).toBe(200);
      expect(regionOptions.width).toBe(500);
      expect(regionOptions.height).toBe(300);
    });

    it('should demonstrate full-screen region capture', () => {
      // Example: Full screen as region
      const fullScreenRegion = CaptureRegionOptionsSchema.parse({
        x: 0,
        y: 0,
        width: 1920,
        height: 1080,
        format: 'jpeg',
        quality: 85,
        output: 'file',
        path: '/screenshots/fullscreen-region.jpg'
      });

      expect(fullScreenRegion.x).toBe(0);
      expect(fullScreenRegion.y).toBe(0);
    });
  });

  describe('Advanced Usage Examples', () => {
    it('should demonstrate full-page screenshot', () => {
      // Example: Full-page capture for long pages
      const fullPageOptions = ScreenshotOptionsSchema.parse({
        format: 'png',
        output: 'file',
        path: '/screenshots/full-page.png',
        fullPage: true,
        omitBackground: false
      });

      expect(fullPageOptions.fullPage).toBe(true);

      // Example: Result for long page
      const fullPageResult = ScreenshotResultSchema.parse({
        path: '/screenshots/full-page.png',
        width: 1920,
        height: 5000, // Long page
        format: 'png'
      });

      expect(fullPageResult.height).toBeGreaterThan(2000);
    });

    it('should demonstrate transparent background screenshot', () => {
      // Example: Screenshot with transparent background
      const transparentOptions = ScreenshotOptionsSchema.parse({
        format: 'png', // PNG supports transparency
        omitBackground: true,
        output: 'buffer'
      });

      expect(transparentOptions.omitBackground).toBe(true);
      expect(transparentOptions.format).toBe('png');
    });
  });

  describe('Error Handling Examples', () => {
    it('should demonstrate common validation errors', () => {
      // Example: Invalid quality range
      expect(() => ScreenshotOptionsSchema.parse({
        quality: 150 // Invalid: > 100
      })).toThrow();

      // Example: Missing path for file output
      expect(() => ScreenshotOptionsSchema.parse({
        output: 'file'
        // Missing required path
      })).toThrow();

      // Example: Invalid format
      expect(() => ScreenshotOptionsSchema.parse({
        format: 'gif' // Invalid: not supported
      })).toThrow();
    });

    it('should demonstrate element capture validation errors', () => {
      // Example: Missing selector
      expect(() => CaptureElementOptionsSchema.parse({
        format: 'png'
        // Missing required selector
      })).toThrow();

      // Example: Empty selector
      expect(() => CaptureElementOptionsSchema.parse({
        selector: '', // Invalid: empty
        format: 'png'
      })).toThrow();
    });
  });

  describe('Schema Introspection for Documentation', () => {
    it('should provide schema metadata for documentation generation', () => {
      // Verify schema structure is accessible for docs
      expect(ScreenshotFormatSchema.options).toEqual(['png', 'jpeg']);
      expect(ScreenshotOutputModeSchema.options).toEqual(['buffer', 'file']);

      // Verify schemas have proper Zod structure
      expect(ScreenshotOptionsSchema._def).toBeDefined();
      expect(ScreenshotResultSchema._def).toBeDefined();
      expect(CaptureElementOptionsSchema._def).toBeDefined();
    });

    it('should demonstrate all schema defaults', () => {
      const defaults = ScreenshotOptionsSchema.parse({});

      expect(defaults).toEqual({
        format: 'png',
        quality: 80,
        output: 'buffer',
        fullPage: false,
        omitBackground: false
      });
    });

    it('should demonstrate type inference for IDE support', () => {
      // These should provide proper TypeScript autocompletion
      const options = ScreenshotOptionsSchema.parse({
        format: 'png', // Should autocomplete to 'png' | 'jpeg'
        output: 'buffer' // Should autocomplete to 'buffer' | 'file'
      });

      // Type checking
      const format: 'png' | 'jpeg' = options.format;
      const output: 'buffer' | 'file' = options.output;

      expect(format).toBe('png');
      expect(output).toBe('buffer');
    });
  });

  describe('Real-World Usage Patterns', () => {
    it('should demonstrate testing workflow', () => {
      // Example: Visual regression testing setup
      const testOptions = ScreenshotOptionsSchema.parse({
        format: 'png',
        output: 'file',
        path: '/test-screenshots/baseline.png',
        fullPage: false,
        omitBackground: true
      });

      expect(testOptions.path).toContain('test-screenshots');
      expect(testOptions.omitBackground).toBe(true);
    });

    it('should demonstrate CI/CD integration', () => {
      // Example: Automated screenshot capture in CI
      const ciOptions = ScreenshotOptionsSchema.parse({
        format: 'jpeg',
        quality: 75, // Lower quality for faster CI
        output: 'file',
        path: '/artifacts/ci-screenshot.jpg'
      });

      expect(ciOptions.quality).toBe(75);
      expect(ciOptions.path).toContain('artifacts');
    });

    it('should demonstrate responsive design testing', () => {
      const viewports = [
        { name: 'mobile', width: 375, height: 667 },
        { name: 'tablet', width: 768, height: 1024 },
        { name: 'desktop', width: 1920, height: 1080 }
      ];

      viewports.forEach(viewport => {
        const options = ScreenshotOptionsSchema.parse({
          format: 'png',
          output: 'file',
          path: `/responsive-tests/${viewport.name}.png`
        });

        expect(options.path).toContain(viewport.name);
      });
    });
  });
});