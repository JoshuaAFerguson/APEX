/**
 * Integration tests for screenshot schemas in realistic browser automation scenarios
 */

import { describe, it, expect } from 'vitest';
import {
  ScreenshotOptionsSchema,
  ScreenshotResultSchema,
  CaptureElementOptionsSchema,
  CaptureRegionOptionsSchema,
  type ScreenshotOptions,
  type ScreenshotResult,
  type CaptureElementOptions,
  type CaptureRegionOptions
} from '../types';

describe('Screenshot Schema Integration Tests', () => {
  describe('Browser Automation Workflow Simulation', () => {
    it('should handle full-page screenshot workflow', () => {
      // Step 1: Configure full-page screenshot options
      const fullPageOptions: ScreenshotOptions = {
        format: 'png',
        quality: 90,
        output: 'file',
        path: '/screenshots/full-page.png',
        fullPage: true,
        omitBackground: false
      };

      const parsedOptions = ScreenshotOptionsSchema.parse(fullPageOptions);
      expect(parsedOptions.fullPage).toBe(true);
      expect(parsedOptions.path).toBe('/screenshots/full-page.png');

      // Step 2: Simulate screenshot result
      const fullPageResult: ScreenshotResult = {
        path: parsedOptions.path!,
        width: 1920,
        height: 3840, // Long page
        format: parsedOptions.format,
        capturedAt: new Date('2024-01-01T12:00:00Z')
      };

      const parsedResult = ScreenshotResultSchema.parse(fullPageResult);
      expect(parsedResult.height).toBeGreaterThan(parsedResult.width); // Tall page
      expect(parsedResult.path).toBe(fullPageOptions.path);
    });

    it('should handle element-specific screenshot workflow', () => {
      // Step 1: Configure element capture
      const elementOptions: CaptureElementOptions = {
        selector: '#main-content > .article-body',
        format: 'jpeg',
        quality: 85,
        output: 'buffer',
        padding: 15,
        fullPage: false,
        omitBackground: true
      };

      const parsedOptions = CaptureElementOptionsSchema.parse(elementOptions);
      expect(parsedOptions.selector).toBe('#main-content > .article-body');
      expect(parsedOptions.padding).toBe(15);
      expect(parsedOptions.omitBackground).toBe(true);

      // Step 2: Simulate element screenshot result
      const elementResult: ScreenshotResult = {
        buffer: Buffer.from('mock jpeg data'),
        width: 800,
        height: 600,
        format: 'jpeg',
        capturedAt: new Date()
      };

      const parsedResult = ScreenshotResultSchema.parse(elementResult);
      expect(parsedResult.buffer).toBeDefined();
      expect(parsedResult.format).toBe('jpeg');
      expect(parsedResult.buffer?.length).toBeGreaterThan(0);
    });

    it('should handle region-based screenshot workflow', () => {
      // Step 1: Configure region capture
      const regionOptions: CaptureRegionOptions = {
        x: 100,
        y: 200,
        width: 500,
        height: 300,
        format: 'png',
        output: 'file',
        path: '/screenshots/region-capture.png',
        omitBackground: false
      };

      const parsedOptions = CaptureRegionOptionsSchema.parse(regionOptions);
      expect(parsedOptions.x).toBe(100);
      expect(parsedOptions.y).toBe(200);
      expect(parsedOptions.width).toBe(500);
      expect(parsedOptions.height).toBe(300);

      // Step 2: Simulate region screenshot result
      const regionResult: ScreenshotResult = {
        path: parsedOptions.path!,
        width: 500, // Should match region width
        height: 300, // Should match region height
        format: 'png',
        capturedAt: new Date()
      };

      const parsedResult = ScreenshotResultSchema.parse(regionResult);
      expect(parsedResult.width).toBe(regionOptions.width);
      expect(parsedResult.height).toBe(regionOptions.height);
    });
  });

  describe('Error Handling in Workflows', () => {
    it('should validate file path requirement for file output', () => {
      const invalidFileOptions = {
        format: 'png',
        output: 'file'
        // Missing required path
      };

      expect(() => ScreenshotOptionsSchema.parse(invalidFileOptions))
        .toThrow("Path is required when output mode is 'file'");
    });

    it('should validate element selector requirement', () => {
      const invalidElementOptions = {
        format: 'png',
        padding: 10
        // Missing required selector
      };

      expect(() => CaptureElementOptionsSchema.parse(invalidElementOptions))
        .toThrow();
    });

    it('should validate result buffer or path requirement', () => {
      const invalidResult = {
        width: 100,
        height: 100,
        format: 'png'
        // Missing both buffer and path
      };

      expect(() => ScreenshotResultSchema.parse(invalidResult))
        .toThrow('Either buffer or path must be provided');
    });
  });

  describe('Cross-Schema Compatibility', () => {
    it('should maintain format consistency across options and results', () => {
      const formats: Array<'png' | 'jpeg'> = ['png', 'jpeg'];

      formats.forEach(format => {
        // Options with specific format
        const options = ScreenshotOptionsSchema.parse({ format });
        expect(options.format).toBe(format);

        // Result with matching format
        const result = ScreenshotResultSchema.parse({
          buffer: Buffer.from('test'),
          width: 100,
          height: 100,
          format
        });
        expect(result.format).toBe(format);
      });
    });

    it('should handle quality validation across schemas', () => {
      const testCases = [
        { quality: 1, shouldPass: true },
        { quality: 50, shouldPass: true },
        { quality: 100, shouldPass: true },
        { quality: 0, shouldPass: false },
        { quality: 101, shouldPass: false }
      ];

      testCases.forEach(({ quality, shouldPass }) => {
        const testData = { format: 'jpeg' as const, quality };

        if (shouldPass) {
          expect(() => ScreenshotOptionsSchema.parse(testData)).not.toThrow();
          expect(() => CaptureElementOptionsSchema.parse({
            ...testData,
            selector: '.test'
          })).not.toThrow();
        } else {
          expect(() => ScreenshotOptionsSchema.parse(testData)).toThrow();
          expect(() => CaptureElementOptionsSchema.parse({
            ...testData,
            selector: '.test'
          })).toThrow();
        }
      });
    });
  });

  describe('Real-world Use Cases', () => {
    it('should handle responsive design testing workflow', () => {
      const viewports = [
        { width: 320, height: 568 }, // Mobile
        { width: 768, height: 1024 }, // Tablet
        { width: 1920, height: 1080 } // Desktop
      ];

      viewports.forEach((viewport, index) => {
        const options = ScreenshotOptionsSchema.parse({
          format: 'png',
          output: 'file',
          path: `/screenshots/responsive-${viewport.width}x${viewport.height}.png`,
          fullPage: false
        });

        const result = ScreenshotResultSchema.parse({
          path: options.path!,
          width: viewport.width,
          height: viewport.height,
          format: 'png',
          capturedAt: new Date()
        });

        expect(result.width).toBe(viewport.width);
        expect(result.height).toBe(viewport.height);
        expect(result.path).toContain(viewport.width.toString());
      });
    });

    it('should handle A/B testing screenshot comparison workflow', () => {
      const variants = ['control', 'variant-a', 'variant-b'];

      variants.forEach(variant => {
        // Capture element for each variant
        const captureOptions = CaptureElementOptionsSchema.parse({
          selector: '.test-element',
          format: 'png',
          output: 'file',
          path: `/screenshots/ab-test-${variant}.png`,
          padding: 20
        });

        const result = ScreenshotResultSchema.parse({
          path: captureOptions.path!,
          width: 400,
          height: 300,
          format: 'png',
          capturedAt: new Date()
        });

        expect(captureOptions.path).toContain(variant);
        expect(result.path).toBe(captureOptions.path);
      });
    });

    it('should handle documentation screenshot workflow', () => {
      // High-quality screenshots for documentation
      const docOptions = ScreenshotOptionsSchema.parse({
        format: 'png', // PNG for crisp documentation
        quality: 100, // Max quality
        output: 'file',
        path: '/docs/screenshots/feature-demo.png',
        fullPage: false,
        omitBackground: true // Clean background for docs
      });

      expect(docOptions.format).toBe('png');
      expect(docOptions.quality).toBe(100);
      expect(docOptions.omitBackground).toBe(true);

      // Capture specific UI elements for documentation
      const elementCapture = CaptureElementOptionsSchema.parse({
        selector: '.demo-interface',
        format: 'png',
        output: 'file',
        path: '/docs/screenshots/ui-element.png',
        padding: 10
      });

      expect(elementCapture.selector).toBe('.demo-interface');
      expect(elementCapture.padding).toBe(10);
    });
  });

  describe('Performance Edge Cases', () => {
    it('should handle large screenshot dimensions', () => {
      const largeScreenshotResult = ScreenshotResultSchema.parse({
        buffer: Buffer.from('large image data'),
        width: 7680, // 8K width
        height: 4320, // 8K height
        format: 'jpeg',
        capturedAt: new Date()
      });

      expect(largeScreenshotResult.width).toBe(7680);
      expect(largeScreenshotResult.height).toBe(4320);
    });

    it('should handle extremely long pages', () => {
      const longPageResult = ScreenshotResultSchema.parse({
        path: '/screenshots/infinite-scroll-page.png',
        width: 1920,
        height: 50000, // Very long scrollable page
        format: 'png'
      });

      expect(longPageResult.height).toBeGreaterThan(20000);
    });

    it('should handle tiny screenshot regions', () => {
      const tinyRegionOptions = CaptureRegionOptionsSchema.parse({
        x: 0,
        y: 0,
        width: 1, // Minimum valid width
        height: 1, // Minimum valid height
        format: 'png'
      });

      expect(tinyRegionOptions.width).toBe(1);
      expect(tinyRegionOptions.height).toBe(1);
    });
  });
});