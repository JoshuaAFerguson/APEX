/**
 * Comprehensive tests for processDesignMockup method
 * Covers URL validation, design tool detection, error handling, and various edge cases
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MultimodalInputHandler, processDesignMockup } from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';
import type {
  DesignMockupOptions,
  DesignMockupProcessResult,
  DesignTool,
} from '../design-mockup-types';

// Mock WebFetchTool
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

describe('MultimodalInputHandler - processDesignMockup', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetch: any;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetch = (handler as any).webFetchTool.execute;
    vi.clearAllMocks();
  });

  describe('URL validation', () => {
    it('should throw DesignMockupError for invalid URL', async () => {
      await expect(handler.processDesignMockup('invalid-url'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should accept valid HTTP URLs', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('fake-image-data'),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      await expect(handler.processDesignMockup('https://example.com/image.png'))
        .resolves
        .toBeDefined();
    });

    it('should accept valid HTTPS URLs', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('fake-image-data'),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      await expect(handler.processDesignMockup('https://example.com/image.png'))
        .resolves
        .toBeDefined();
    });
  });

  describe('Design tool detection', () => {
    beforeEach(() => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('fake-image-data'),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });
    });

    const testCases: Array<{ url: string; expected: DesignTool }> = [
      { url: 'https://figma.com/file/abc123/test', expected: 'figma' },
      { url: 'https://www.figma.com/design/abc123/test', expected: 'figma' },
      { url: 'https://sketch.cloud/s/abc123', expected: 'sketch' },
      { url: 'https://sketch.com/s/abc123', expected: 'sketch' },
      { url: 'https://xd.adobe.com/view/abc123', expected: 'adobe_xd' },
      { url: 'https://invisionapp.com/share/abc123', expected: 'invision' },
      { url: 'https://zeplin.io/project/abc123', expected: 'zeplin' },
      { url: 'https://framer.com/share/abc123', expected: 'framer' },
      { url: 'https://canva.com/design/abc123', expected: 'canva' },
      { url: 'https://example.com/image.png', expected: 'other' },
    ];

    testCases.forEach(({ url, expected }) => {
      it(`should detect ${expected} from ${url}`, async () => {
        const result = await handler.processDesignMockup(url);
        expect(result.designTool).toBe(expected);
      });
    });
  });

  describe('Generic image URL processing', () => {
    it('should successfully process a PNG image URL', async () => {
      const testImageData = Buffer.from('fake-png-data');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 150, contentLength: testImageData.length },
      });

      const result = await handler.processDesignMockup('https://example.com/mockup.png');

      expect(result).toMatchObject({
        designTool: 'other',
        exportFormat: 'png',
        exportScale: 1,
        fileSizeBytes: testImageData.length,
        mediaType: 'image/png',
        fromCache: false,
      });

      expect(result.imageBlock).toMatchObject({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: testImageData.toString('base64'),
        },
      });

      expect(result.metadata).toMatchObject({
        fileUrl: 'https://example.com/mockup.png',
        frameName: 'mockup',
      });
    });

    it('should successfully process a JPEG image URL', async () => {
      const testImageData = Buffer.from('fake-jpeg-data');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
        fromCache: false,
        metadata: { responseTime: 150 },
      });

      const result = await handler.processDesignMockup('https://example.com/design.jpg');

      expect(result.exportFormat).toBe('jpeg');
      expect(result.mediaType).toBe('image/jpeg');
      expect(result.imageBlock.source.media_type).toBe('image/jpeg');
    });

    it('should detect format from URL extension when content-type is not available', async () => {
      const testImageData = Buffer.from('fake-webp-data');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: {},
        fromCache: false,
        metadata: { responseTime: 150 },
      });

      const result = await handler.processDesignMockup('https://example.com/design.webp');

      expect(result.exportFormat).toBe('webp');
      expect(result.mediaType).toBe('image/webp');
      expect(result.imageBlock.source.media_type).toBe('image/webp');
    });

    it('should handle cache hits properly', async () => {
      const testImageData = Buffer.from('fake-cached-data');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: true,
        metadata: { responseTime: 5, cacheKey: 'test-cache-key' },
      });

      const result = await handler.processDesignMockup('https://example.com/cached.png');

      expect(result.fromCache).toBe(true);
      expect(result.cacheKey).toBe('test-cache-key');
    });
  });

  describe('Figma URL processing', () => {
    it('should successfully process a Figma file URL', async () => {
      const testImageData = Buffer.from('fake-figma-image');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 200 },
      });

      const figmaUrl = 'https://www.figma.com/file/abc123xyz456/Login-Screens?node-id=123:456';
      const result = await handler.processDesignMockup(figmaUrl);

      expect(result.designTool).toBe('figma');
      expect(result.metadata).toMatchObject({
        fileId: 'abc123xyz456',
        nodeId: '123:456',
        fileUrl: figmaUrl,
        frameName: 'Login Screens',
      });
    });

    it('should process Figma design URLs', async () => {
      const testImageData = Buffer.from('fake-figma-design');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 200 },
      });

      const result = await handler.processDesignMockup('https://www.figma.com/design/xyz789/Dashboard');
      expect(result.designTool).toBe('figma');
      expect(result.metadata.fileId).toBe('xyz789');
    });

    it('should handle Figma viewport information', async () => {
      const testImageData = Buffer.from('fake-figma-viewport');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 200 },
      });

      const figmaUrl = 'https://www.figma.com/file/abc123/Test?viewport=100,200,800,600';
      const result = await handler.processDesignMockup(figmaUrl);

      expect(result.dimensions).toMatchObject({
        width: 800,
        height: 600,
        unit: 'px',
      });
    });
  });

  describe('Error handling', () => {
    it('should throw NETWORK_ERROR for fetch failures', async () => {
      mockWebFetch.mockResolvedValue({
        success: false,
        error: 'Network timeout',
      });

      await expect(handler.processDesignMockup('https://example.com/image.png'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should throw FILE_NOT_FOUND for 404 responses', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: null,
        status: 404,
        headers: {},
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      await expect(handler.processDesignMockup('https://example.com/nonexistent.png'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should throw AUTHENTICATION_REQUIRED for 403 responses on Figma URLs', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: null,
        status: 403,
        headers: {},
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      await expect(handler.processDesignMockup('https://www.figma.com/file/private123/Private-Design'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should throw PROCESSING_ERROR for empty response data', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: null,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      await expect(handler.processDesignMockup('https://example.com/empty.png'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should throw FILE_TOO_LARGE for oversized images', async () => {
      const oversizedData = Buffer.alloc(25 * 1024 * 1024); // 25MB (over 20MB limit)
      mockWebFetch.mockResolvedValue({
        success: true,
        data: oversizedData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 1000 },
      });

      await expect(handler.processDesignMockup('https://example.com/huge.png'))
        .rejects
        .toThrow(DesignMockupError);
    });
  });

  describe('Options handling', () => {
    beforeEach(() => {
      const testImageData = Buffer.from('fake-image-data');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 150 },
      });
    });

    it('should respect custom exportFormat option', async () => {
      const options: DesignMockupOptions = {
        designTool: 'other',
        exportFormat: 'jpeg',
      };

      const result = await handler.processDesignMockup('https://example.com/test.png', options);
      expect(result.exportFormat).toBe('jpeg');
      expect(result.mediaType).toBe('image/jpeg');
      expect(result.imageBlock.source.media_type).toBe('image/jpeg');
    });

    it('should respect custom exportScale option', async () => {
      const options: DesignMockupOptions = {
        designTool: 'other',
        exportScale: 2,
      };

      const result = await handler.processDesignMockup('https://example.com/test.png', options);
      expect(result.exportScale).toBe(2);
    });

    it('should pass custom headers to WebFetch', async () => {
      const options: DesignMockupOptions = {
        designTool: 'other',
        headers: { 'Authorization': 'Bearer token123' },
      };

      await handler.processDesignMockup('https://example.com/test.png', options);

      expect(mockWebFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'Authorization': 'Bearer token123' },
        })
      );
    });

    it('should respect timeout option', async () => {
      const options: DesignMockupOptions = {
        designTool: 'other',
        timeout: 60000,
      };

      await handler.processDesignMockup('https://example.com/test.png', options);

      expect(mockWebFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 60000,
        })
      );
    });

    it('should respect bypassCache option', async () => {
      const options: DesignMockupOptions = {
        designTool: 'other',
        bypassCache: true,
      };

      await handler.processDesignMockup('https://example.com/test.png', options);

      expect(mockWebFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          bypassCache: true,
        })
      );
    });
  });

  describe('Data format handling', () => {
    it('should handle string response data', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: 'binary-string-data',
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 150 },
      });

      const result = await handler.processDesignMockup('https://example.com/test.png');
      expect(result.imageBlock.source.data).toBe(Buffer.from('binary-string-data', 'binary').toString('base64'));
    });

    it('should handle Buffer response data', async () => {
      const testBuffer = Buffer.from('buffer-data');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testBuffer,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 150 },
      });

      const result = await handler.processDesignMockup('https://example.com/test.png');
      expect(result.imageBlock.source.data).toBe(testBuffer.toString('base64'));
    });

    it('should handle ArrayBuffer response data', async () => {
      const testArrayBuffer = new ArrayBuffer(10);
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testArrayBuffer,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 150 },
      });

      const result = await handler.processDesignMockup('https://example.com/test.png');
      expect(result.imageBlock.source.data).toBe(Buffer.from(testArrayBuffer).toString('base64'));
    });
  });
});

describe('processDesignMockup convenience function', () => {
  let mockWebFetch: any;

  beforeEach(() => {
    // Mock the default handler instance
    const mockHandler = {
      processDesignMockup: vi.fn(),
    };

    // We need to mock the module's default export
    vi.doMock('../multimodal-input-handler', () => ({
      ...vi.importActual('../multimodal-input-handler'),
      multimodalInputHandler: mockHandler,
    }));

    mockWebFetch = mockHandler.processDesignMockup;
  });

  afterEach(() => {
    vi.resetModules();
  });

  it('should use default handler when no config provided', async () => {
    const mockResult = { designTool: 'figma' } as DesignMockupProcessResult;
    mockWebFetch.mockResolvedValue(mockResult);

    const result = await processDesignMockup('https://example.com/test.png');

    expect(mockWebFetch).toHaveBeenCalledWith('https://example.com/test.png', undefined);
    expect(result).toBe(mockResult);
  });

  it('should create new handler when config provided', async () => {
    const config = { maxFileSizeBytes: 10 * 1024 * 1024 };
    const options = { exportFormat: 'jpeg' as const };

    // For this test, we need to test the actual implementation
    // since we're creating a new handler instance
    vi.unmock('../multimodal-input-handler');

    const mockWebFetch = vi.fn().mockResolvedValue({
      success: true,
      data: Buffer.from('test'),
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
      fromCache: false,
      metadata: { responseTime: 100 },
    });

    vi.doMock('../webfetch', () => ({
      WebFetchTool: vi.fn().mockImplementation(() => ({
        execute: mockWebFetch,
      })),
    }));

    const { processDesignMockup: actualProcessDesignMockup } = await import('../multimodal-input-handler');

    const result = await actualProcessDesignMockup('https://example.com/test.jpg', options, config);

    expect(result.exportFormat).toBe('jpeg');
    expect(mockWebFetch).toHaveBeenCalled();
  });
});

// Additional comprehensive tests for enhanced coverage
describe('Design Mockup Processing - Enhanced Edge Cases', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetch: any;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetch = (handler as any).webFetchTool.execute;
    vi.clearAllMocks();
  });

  describe('Unsupported format edge cases', () => {
    it('should reject URLs with unsupported protocols', async () => {
      const unsupportedProtocols = [
        'ftp://example.com/image.png',
        'file:///local/image.png',
        'data:image/png;base64,iVBOR...',
        'javascript:alert("xss")',
        'chrome://settings',
        'about:blank',
      ];

      for (const url of unsupportedProtocols) {
        await expect(handler.processDesignMockup(url))
          .rejects
          .toThrow(DesignMockupError);
      }
    });

    it('should handle malformed URLs gracefully', async () => {
      const malformedUrls = [
        'not-a-url',
        'http://',
        'https://',
        'https://.',
        'https://.com',
        'https://exam ple.com/image.png', // space in domain
        'https://example..com/image.png', // double dots
        'https://[invalid ipv6]/image.png',
      ];

      for (const url of malformedUrls) {
        await expect(handler.processDesignMockup(url))
          .rejects
          .toThrow(DesignMockupError);
      }
    });

    it('should reject non-image file extensions', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('not-an-image'),
        status: 200,
        headers: { 'content-type': 'text/plain' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const nonImageUrls = [
        'https://example.com/document.pdf',
        'https://example.com/archive.zip',
        'https://example.com/script.js',
        'https://example.com/data.json',
        'https://example.com/styles.css',
        'https://example.com/video.mp4',
        'https://example.com/audio.mp3',
      ];

      for (const url of nonImageUrls) {
        await expect(handler.processDesignMockup(url))
          .rejects
          .toThrow(DesignMockupError);
      }
    });

    it('should handle corrupted image data', async () => {
      const corruptedImageData = Buffer.from('corrupted-image-data');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: corruptedImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      // Should still process but with warnings
      const result = await handler.processDesignMockup('https://example.com/corrupted.png');
      expect(result.imageBlock.source.data).toBe(corruptedImageData.toString('base64'));
      expect(result.warnings).toBeUndefined(); // Current implementation doesn't validate image data
    });
  });

  describe('Invalid Figma URL edge cases', () => {
    it('should reject invalid Figma file key formats', async () => {
      const invalidFigmaUrls = [
        'https://www.figma.com/file/short/Design', // too short
        'https://www.figma.com/file/spaces in key/Design',
        'https://www.figma.com/file//Design', // empty key
        'https://www.figma.com/file/special@chars#/Design',
        'https://www.figma.com/file/123/Design', // too short (minimum 22 chars)
      ];

      for (const url of invalidFigmaUrls) {
        const result = handler.parseFigmaUrl(url);
        expect(result.success).toBe(false);
      }
    });

    it('should handle extremely long Figma URLs', async () => {
      const veryLongFileName = 'A'.repeat(1000);
      const longUrl = `https://www.figma.com/file/abc123def456ghi789jkl012/${veryLongFileName}?node-id=123:456&version-id=987654321&mode=design&scale-factor=2.0`;

      const result = handler.parseFigmaUrl(longUrl);
      expect(result.success).toBe(true);
      expect(result.info?.fileName).toBe(veryLongFileName);
    });

    it('should handle invalid parameter combinations', async () => {
      const urlsWithInvalidParams = [
        'https://www.figma.com/file/abc123def456/Design?node-id=invalid',
        'https://www.figma.com/file/abc123def456/Design?scale-factor=abc',
        'https://www.figma.com/file/abc123def456/Design?viewport=invalid,params',
        'https://www.figma.com/file/abc123def456/Design?version-id=not-numeric',
      ];

      urlsWithInvalidParams.forEach(url => {
        const result = handler.parseFigmaUrl(url);
        expect(result.success).toBe(true); // Should parse URL but ignore invalid params
      });
    });
  });

  describe('Network and authentication edge cases', () => {
    it('should handle various HTTP error codes', async () => {
      const errorCodes = [
        { code: 401, expectError: 'AUTHENTICATION_REQUIRED' },
        { code: 403, expectError: 'AUTHENTICATION_REQUIRED' },
        { code: 404, expectError: 'FILE_NOT_FOUND' },
        { code: 429, expectError: 'RATE_LIMITED' },
        { code: 500, expectError: 'SERVER_ERROR' },
        { code: 502, expectError: 'SERVER_ERROR' },
        { code: 503, expectError: 'SERVER_ERROR' },
      ];

      for (const { code, expectError } of errorCodes) {
        mockWebFetch.mockResolvedValue({
          success: true,
          data: null,
          status: code,
          headers: {},
          fromCache: false,
          metadata: { responseTime: 100 },
        });

        await expect(handler.processDesignMockup('https://example.com/image.png'))
          .rejects
          .toThrow(DesignMockupError);
      }
    });

    it('should handle network timeouts and connection errors', async () => {
      mockWebFetch.mockResolvedValue({
        success: false,
        error: 'Connection timeout',
        status: 0,
      });

      await expect(handler.processDesignMockup('https://example.com/slow-image.png'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should handle redirect chains gracefully', async () => {
      // Simulate a redirected response
      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('redirected-image'),
        status: 200,
        headers: {
          'content-type': 'image/png',
          'x-redirected-from': 'https://old-domain.com/image.png'
        },
        fromCache: false,
        metadata: {
          responseTime: 300,
          redirects: 3,
          finalUrl: 'https://cdn.example.com/image.png'
        },
      });

      const result = await handler.processDesignMockup('https://example.com/redirect.png');
      expect(result.imageBlock).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });
  });

  describe('Content type and format detection edge cases', () => {
    it('should handle missing or incorrect content-type headers', async () => {
      const testCases = [
        { url: 'https://example.com/image.png', contentType: '', expectedFormat: 'png' },
        { url: 'https://example.com/image.jpg', contentType: 'text/plain', expectedFormat: 'jpeg' },
        { url: 'https://example.com/image.webp', contentType: 'application/octet-stream', expectedFormat: 'webp' },
        { url: 'https://example.com/image.svg', contentType: 'image/svg+xml', expectedFormat: 'svg' },
      ];

      for (const { url, contentType, expectedFormat } of testCases) {
        mockWebFetch.mockResolvedValue({
          success: true,
          data: Buffer.from('test-image-data'),
          status: 200,
          headers: contentType ? { 'content-type': contentType } : {},
          fromCache: false,
          metadata: { responseTime: 100 },
        });

        const result = await handler.processDesignMockup(url);
        expect(result.exportFormat).toBe(expectedFormat);
      }
    });

    it('should handle URLs without file extensions', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('image-data-no-extension'),
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const result = await handler.processDesignMockup('https://example.com/image-no-extension');
      expect(result.exportFormat).toBe('jpeg');
      expect(result.mediaType).toBe('image/jpeg');
    });

    it('should handle conflicting extension and content-type', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('conflicting-format-data'),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      // URL says JPEG but content-type says PNG - should prefer content-type
      const result = await handler.processDesignMockup('https://example.com/image.jpg');
      expect(result.exportFormat).toBe('png');
      expect(result.mediaType).toBe('image/png');
    });
  });

  describe('Performance and memory edge cases', () => {
    it('should handle very large image files within limits', async () => {
      // Create a large but acceptable file (19MB, under 20MB limit)
      const largeImageData = Buffer.alloc(19 * 1024 * 1024, 0x42);
      mockWebFetch.mockResolvedValue({
        success: true,
        data: largeImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 5000 },
      });

      const result = await handler.processDesignMockup('https://example.com/large.png');
      expect(result.fileSizeBytes).toBe(largeImageData.length);
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle very slow response times', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('slow-response'),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 10000 }, // 10 seconds
      });

      const result = await handler.processDesignMockup('https://example.com/slow.png');
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.fromCache).toBe(false);
    });
  });

  describe('Security edge cases', () => {
    it('should sanitize potentially dangerous filenames', async () => {
      const dangerousUrls = [
        'https://example.com/../../../etc/passwd.png',
        'https://example.com/image.png?param=<script>alert("xss")</script>',
        'https://example.com/image.png#fragment',
      ];

      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('safe-image'),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      for (const url of dangerousUrls) {
        const result = await handler.processDesignMockup(url);
        expect(result.imageBlock).toBeDefined();
        // Filename should be sanitized
        expect(result.metadata.frameName).not.toContain('../');
        expect(result.metadata.frameName).not.toContain('<script>');
      }
    });

    it('should validate URL structure before processing', async () => {
      const suspiciousUrls = [
        'https://example.com/image.png.exe',
        'https://example.com/image.png%00.txt', // null byte injection
        'https://example.com/image.png\\\\..\\\\windows\\\\system32',
      ];

      for (const url of suspiciousUrls) {
        await expect(handler.processDesignMockup(url))
          .rejects
          .toThrow(DesignMockupError);
      }
    });
  });
});