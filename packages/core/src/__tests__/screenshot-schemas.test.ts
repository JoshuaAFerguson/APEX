import {
  ScreenshotOptionsSchema,
  ScreenshotResultSchema,
  CaptureElementOptionsSchema,
  CaptureRegionOptionsSchema,
  ScreenshotFormatSchema,
  ScreenshotOutputModeSchema,
  ScreenshotOptions,
  ScreenshotResult,
  CaptureElementOptions,
  CaptureRegionOptions
} from '../types';

describe('Screenshot Schemas', () => {
  describe('ScreenshotFormatSchema', () => {
    it('should accept valid formats', () => {
      expect(ScreenshotFormatSchema.parse('png')).toBe('png');
      expect(ScreenshotFormatSchema.parse('jpeg')).toBe('jpeg');
    });

    it('should reject invalid formats', () => {
      expect(() => ScreenshotFormatSchema.parse('gif')).toThrow();
      expect(() => ScreenshotFormatSchema.parse('webp')).toThrow();
    });
  });

  describe('ScreenshotOutputModeSchema', () => {
    it('should accept valid output modes', () => {
      expect(ScreenshotOutputModeSchema.parse('buffer')).toBe('buffer');
      expect(ScreenshotOutputModeSchema.parse('file')).toBe('file');
    });

    it('should reject invalid output modes', () => {
      expect(() => ScreenshotOutputModeSchema.parse('stream')).toThrow();
    });
  });

  describe('ScreenshotOptionsSchema', () => {
    it('should parse valid options with defaults', () => {
      const result = ScreenshotOptionsSchema.parse({});
      expect(result.format).toBe('png');
      expect(result.quality).toBe(80);
      expect(result.output).toBe('buffer');
      expect(result.fullPage).toBe(false);
      expect(result.omitBackground).toBe(false);
    });

    it('should parse custom options', () => {
      const options: ScreenshotOptions = {
        format: 'jpeg',
        quality: 95,
        output: 'file',
        path: '/path/to/screenshot.jpg',
        fullPage: true,
        omitBackground: true
      };

      const result = ScreenshotOptionsSchema.parse(options);
      expect(result.format).toBe('jpeg');
      expect(result.quality).toBe(95);
      expect(result.output).toBe('file');
      expect(result.path).toBe('/path/to/screenshot.jpg');
      expect(result.fullPage).toBe(true);
      expect(result.omitBackground).toBe(true);
    });

    it('should require path when output is file', () => {
      expect(() => ScreenshotOptionsSchema.parse({
        output: 'file'
        // path missing
      })).toThrow("Path is required when output mode is 'file'");
    });

    it('should not require path when output is buffer', () => {
      expect(() => ScreenshotOptionsSchema.parse({
        output: 'buffer'
        // path not required
      })).not.toThrow();
    });

    it('should validate quality range', () => {
      expect(() => ScreenshotOptionsSchema.parse({
        quality: 0
      })).toThrow();

      expect(() => ScreenshotOptionsSchema.parse({
        quality: 101
      })).toThrow();

      expect(() => ScreenshotOptionsSchema.parse({
        quality: 50
      })).not.toThrow();
    });
  });

  describe('ScreenshotResultSchema', () => {
    it('should parse result with buffer', () => {
      const buffer = Buffer.from('test image data');
      const result: ScreenshotResult = {
        buffer,
        width: 1920,
        height: 1080,
        format: 'png',
        capturedAt: new Date()
      };

      const parsed = ScreenshotResultSchema.parse(result);
      expect(parsed.buffer).toBe(buffer);
      expect(parsed.width).toBe(1920);
      expect(parsed.height).toBe(1080);
      expect(parsed.format).toBe('png');
    });

    it('should parse result with file path', () => {
      const result: ScreenshotResult = {
        path: '/path/to/screenshot.png',
        width: 800,
        height: 600
      };

      const parsed = ScreenshotResultSchema.parse(result);
      expect(parsed.path).toBe('/path/to/screenshot.png');
      expect(parsed.width).toBe(800);
      expect(parsed.height).toBe(600);
    });

    it('should require either buffer or path', () => {
      expect(() => ScreenshotResultSchema.parse({
        width: 100,
        height: 100
        // neither buffer nor path provided
      })).toThrow('Either buffer or path must be provided');
    });

    it('should validate positive dimensions', () => {
      expect(() => ScreenshotResultSchema.parse({
        buffer: Buffer.from('test'),
        width: 0,
        height: 100
      })).toThrow();

      expect(() => ScreenshotResultSchema.parse({
        buffer: Buffer.from('test'),
        width: 100,
        height: -1
      })).toThrow();
    });
  });

  describe('CaptureElementOptionsSchema', () => {
    it('should extend screenshot options with element selector', () => {
      const options: CaptureElementOptions = {
        selector: '.my-element',
        format: 'jpeg',
        quality: 90,
        padding: 10
      };

      const result = CaptureElementOptionsSchema.parse(options);
      expect(result.selector).toBe('.my-element');
      expect(result.format).toBe('jpeg');
      expect(result.quality).toBe(90);
      expect(result.padding).toBe(10);
      expect(result.output).toBe('buffer'); // default
    });

    it('should require selector', () => {
      expect(() => CaptureElementOptionsSchema.parse({
        // selector missing
        format: 'png'
      })).toThrow();

      expect(() => CaptureElementOptionsSchema.parse({
        selector: '', // empty selector
        format: 'png'
      })).toThrow();
    });

    it('should apply default padding', () => {
      const result = CaptureElementOptionsSchema.parse({
        selector: '#my-id'
      });
      expect(result.padding).toBe(0);
    });

    it('should validate padding is non-negative', () => {
      expect(() => CaptureElementOptionsSchema.parse({
        selector: '.test',
        padding: -5
      })).toThrow();
    });
  });

  describe('CaptureRegionOptionsSchema', () => {
    it('should extend screenshot options with region coordinates', () => {
      const result = CaptureRegionOptionsSchema.parse({
        x: 100,
        y: 50,
        width: 800,
        height: 600,
        format: 'png'
      });

      expect(result.x).toBe(100);
      expect(result.y).toBe(50);
      expect(result.width).toBe(800);
      expect(result.height).toBe(600);
    });

    it('should validate region coordinates are non-negative', () => {
      expect(() => CaptureRegionOptionsSchema.parse({
        x: -1,
        y: 0,
        width: 100,
        height: 100
      })).toThrow();

      expect(() => CaptureRegionOptionsSchema.parse({
        x: 0,
        y: -1,
        width: 100,
        height: 100
      })).toThrow();
    });

    it('should validate region dimensions are positive', () => {
      expect(() => CaptureRegionOptionsSchema.parse({
        x: 0,
        y: 0,
        width: 0,
        height: 100
      })).toThrow();

      expect(() => CaptureRegionOptionsSchema.parse({
        x: 0,
        y: 0,
        width: 100,
        height: 0
      })).toThrow();
    });
  });

  describe('Type Exports', () => {
    it('should export all screenshot types from core package', async () => {
      // Test that schemas are available for import
      expect(ScreenshotOptionsSchema).toBeDefined();
      expect(ScreenshotResultSchema).toBeDefined();
      expect(CaptureElementOptionsSchema).toBeDefined();
      expect(CaptureRegionOptionsSchema).toBeDefined();
      expect(ScreenshotFormatSchema).toBeDefined();
      expect(ScreenshotOutputModeSchema).toBeDefined();
    });
  });
});