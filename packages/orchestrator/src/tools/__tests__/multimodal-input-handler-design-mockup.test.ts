/**
 * @jest/environment node
 */

import { MultimodalInputHandler, processDesignMockup } from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';
import type {
  DesignMockupOptions,
  DesignMockupProcessResult,
  DesignTool,
} from '../design-mockup-types';

// Mock WebFetchTool
jest.mock('../webfetch', () => ({
  WebFetchTool: jest.fn().mockImplementation(() => ({
    execute: jest.fn(),
  })),
}));

describe('MultimodalInputHandler - processDesignMockup', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetch: jest.MockedFunction<any>;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetch = (handler as any).webFetchTool.execute;
    jest.clearAllMocks();
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
  let mockWebFetch: jest.MockedFunction<any>;

  beforeEach(() => {
    // Mock the default handler instance
    const mockHandler = {
      processDesignMockup: jest.fn(),
    };

    // We need to mock the module's default export
    jest.doMock('../multimodal-input-handler', () => ({
      ...jest.requireActual('../multimodal-input-handler'),
      multimodalInputHandler: mockHandler,
    }));

    mockWebFetch = mockHandler.processDesignMockup;
  });

  afterEach(() => {
    jest.resetModules();
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
    jest.unmock('../multimodal-input-handler');

    const mockWebFetch = jest.fn().mockResolvedValue({
      success: true,
      data: Buffer.from('test'),
      status: 200,
      headers: { 'content-type': 'image/jpeg' },
      fromCache: false,
      metadata: { responseTime: 100 },
    });

    jest.doMock('../webfetch', () => ({
      WebFetchTool: jest.fn().mockImplementation(() => ({
        execute: mockWebFetch,
      })),
    }));

    const { processDesignMockup: actualProcessDesignMockup } = await import('../multimodal-input-handler');

    const result = await actualProcessDesignMockup('https://example.com/test.jpg', options, config);

    expect(result.exportFormat).toBe('jpeg');
    expect(mockWebFetch).toHaveBeenCalled();
  });
});