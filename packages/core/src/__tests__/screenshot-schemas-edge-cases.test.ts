import {
  ScreenshotOptionsSchema,
  ScreenshotResultSchema,
  CaptureElementOptionsSchema,
  CaptureRegionOptionsSchema,
  ScreenshotFormatSchema,
  ScreenshotOutputModeSchema,
  type ScreenshotOptions,
  type ScreenshotResult,
  type CaptureElementOptions
} from '../types';

describe('Screenshot Schemas - Edge Cases and Integration', () => {
  describe('ScreenshotOptionsSchema Edge Cases', () => {
    it('should handle edge case quality values', () => {
      expect(() => ScreenshotOptionsSchema.parse({ quality: 1 })).not.toThrow();
      expect(() => ScreenshotOptionsSchema.parse({ quality: 100 })).not.toThrow();

      // Should handle decimal quality values by truncating
      const result = ScreenshotOptionsSchema.parse({ quality: 50.7 });
      expect(result.quality).toBe(50);
    });

    it('should handle empty string path when output is file', () => {
      expect(() => ScreenshotOptionsSchema.parse({
        output: 'file',
        path: ''
      })).not.toThrow(); // Empty string is allowed, refinement only checks for undefined
    });

    it('should handle path when output is buffer (should be allowed but ignored)', () => {
      const result = ScreenshotOptionsSchema.parse({
        output: 'buffer',
        path: '/some/path.png' // This should be allowed
      });
      expect(result.path).toBe('/some/path.png');
      expect(result.output).toBe('buffer');
    });

    it('should handle all boolean combinations', () => {
      const combinations = [
        { fullPage: true, omitBackground: true },
        { fullPage: true, omitBackground: false },
        { fullPage: false, omitBackground: true },
        { fullPage: false, omitBackground: false }
      ];

      combinations.forEach(combo => {
        expect(() => ScreenshotOptionsSchema.parse(combo)).not.toThrow();
      });
    });
  });

  describe('ScreenshotResultSchema Edge Cases', () => {
    it('should handle both buffer and path (both present)', () => {
      const buffer = Buffer.from('test');
      const result = ScreenshotResultSchema.parse({
        buffer,
        path: '/path/to/file.png',
        width: 100,
        height: 100
      });

      expect(result.buffer).toBe(buffer);
      expect(result.path).toBe('/path/to/file.png');
    });

    it('should handle minimum valid dimensions', () => {
      const result = ScreenshotResultSchema.parse({
        buffer: Buffer.from('test'),
        width: 1,
        height: 1
      });

      expect(result.width).toBe(1);
      expect(result.height).toBe(1);
    });

    it('should handle very large dimensions', () => {
      const result = ScreenshotResultSchema.parse({
        buffer: Buffer.from('test'),
        width: 99999,
        height: 99999
      });

      expect(result.width).toBe(99999);
      expect(result.height).toBe(99999);
    });

    it('should handle empty buffer', () => {
      const emptyBuffer = Buffer.from('');
      const result = ScreenshotResultSchema.parse({
        buffer: emptyBuffer,
        width: 100,
        height: 100
      });

      expect(result.buffer).toBe(emptyBuffer);
    });

    it('should handle optional fields correctly', () => {
      const result = ScreenshotResultSchema.parse({
        buffer: Buffer.from('test'),
        width: 100,
        height: 100,
        // format and capturedAt are optional and should be undefined
      });

      expect(result.format).toBeUndefined();
      expect(result.capturedAt).toBeUndefined();
    });
  });

  describe('CaptureElementOptionsSchema Edge Cases', () => {
    it('should handle various CSS selector formats', () => {
      const selectors = [
        '.class-name',
        '#element-id',
        'div',
        'div > p',
        'div.class#id',
        '[data-testid="test"]',
        ':nth-child(2)',
        '.parent .child:hover'
      ];

      selectors.forEach(selector => {
        expect(() => CaptureElementOptionsSchema.parse({ selector })).not.toThrow();
      });
    });

    it('should handle maximum padding values', () => {
      const result = CaptureElementOptionsSchema.parse({
        selector: '.test',
        padding: 999999
      });

      expect(result.padding).toBe(999999);
    });

    it('should inherit all base schema validations', () => {
      // Should still validate quality range
      expect(() => CaptureElementOptionsSchema.parse({
        selector: '.test',
        quality: 101
      })).toThrow();

      // Should still require path when output is file
      expect(() => CaptureElementOptionsSchema.parse({
        selector: '.test',
        output: 'file'
        // Missing path
      })).toThrow();
    });
  });

  describe('Schema Integration Tests', () => {
    it('should work end-to-end with realistic screenshot workflow', () => {
      // Step 1: Parse screenshot options
      const options: ScreenshotOptions = {
        format: 'png',
        quality: 90,
        output: 'file',
        path: '/screenshots/test.png',
        fullPage: true,
        omitBackground: false
      };

      const parsedOptions = ScreenshotOptionsSchema.parse(options);
      expect(parsedOptions).toEqual(options);

      // Step 2: Parse screenshot result
      const result: ScreenshotResult = {
        path: parsedOptions.path!,
        width: 1920,
        height: 1080,
        format: parsedOptions.format,
        capturedAt: new Date()
      };

      const parsedResult = ScreenshotResultSchema.parse(result);
      expect(parsedResult.path).toBe(options.path);
      expect(parsedResult.format).toBe(options.format);
    });

    it('should work with element capture workflow', () => {
      // Step 1: Parse element capture options
      const captureOptions: CaptureElementOptions = {
        selector: '#main-content',
        format: 'jpeg',
        quality: 85,
        output: 'buffer',
        padding: 20,
        fullPage: false
      };

      const parsedCaptureOptions = CaptureElementOptionsSchema.parse(captureOptions);
      expect(parsedCaptureOptions.selector).toBe('#main-content');
      expect(parsedCaptureOptions.format).toBe('jpeg');
      expect(parsedCaptureOptions.quality).toBe(85);

      // Step 2: Parse result with buffer
      const captureResult: ScreenshotResult = {
        buffer: Buffer.from('jpeg image data'),
        width: 800,
        height: 600,
        format: parsedCaptureOptions.format,
        capturedAt: new Date()
      };

      const parsedCaptureResult = ScreenshotResultSchema.parse(captureResult);
      expect(parsedCaptureResult.buffer).toBeDefined();
      expect(parsedCaptureResult.format).toBe('jpeg');
    });

    it('should validate cross-schema consistency', () => {
      // Ensure format enums are consistent across schemas
      expect(ScreenshotFormatSchema.options).toEqual(['png', 'jpeg']);
      expect(ScreenshotOutputModeSchema.options).toEqual(['buffer', 'file']);
    });
  });

  describe('Type Safety Validation', () => {
    it('should provide proper TypeScript inference', () => {
      const options = ScreenshotOptionsSchema.parse({
        format: 'png' as const,
        output: 'buffer' as const
      });

      // Verify runtime values match expected types
      expect(options.format).toBe('png');
      expect(options.output).toBe('buffer');

      // Type assertions to verify TypeScript inference works
      const _formatCheck: 'png' = options.format;
      const _outputCheck: 'buffer' = options.output;

      // These should not cause TypeScript errors
      expect(_formatCheck).toBe('png');
      expect(_outputCheck).toBe('buffer');
    });

    it('should handle undefined optional fields correctly', () => {
      const result = ScreenshotResultSchema.parse({
        buffer: Buffer.from('test'),
        width: 100,
        height: 100
      });

      // These should be properly typed as optional
      expect(result.format).toBeUndefined();
      expect(result.capturedAt).toBeUndefined();

      // Type assertions to verify TypeScript inference
      const _formatCheck: 'png' | 'jpeg' | undefined = result.format;
      const _capturedAtCheck: Date | undefined = result.capturedAt;

      expect(_formatCheck).toBeUndefined();
      expect(_capturedAtCheck).toBeUndefined();
    });
  });
});