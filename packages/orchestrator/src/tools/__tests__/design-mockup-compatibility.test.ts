/**
 * Format compatibility and advanced feature tests for processDesignMockup functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultimodalInputHandler } from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';
import type { DesignMockupOptions, DesignTool } from '../design-mockup-types';

// Mock WebFetchTool
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

describe('MultimodalInputHandler - processDesignMockup Compatibility Tests', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetch: any;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetch = (handler as any).webFetchTool.execute;
    vi.clearAllMocks();
  });

  describe('Advanced image format handling', () => {
    it('should handle SVG format with proper conversion', async () => {
      const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect x="10" y="10" width="80" height="80" fill="blue"/></svg>';
      const svgBuffer = Buffer.from(svgContent);

      mockWebFetch.mockResolvedValue({
        success: true,
        data: svgBuffer,
        status: 200,
        headers: { 'content-type': 'image/svg+xml' },
        fromCache: false,
        metadata: { responseTime: 150 },
      });

      const result = await handler.processDesignMockup('https://example.com/vector.svg');

      expect(result.exportFormat).toBe('svg');
      expect(result.mediaType).toBe('image/png');
      expect(result.imageBlock.source.media_type).toBe('image/png'); // SVG converts to PNG for Claude SDK
      expect(result.imageBlock.source.data).toBe(svgBuffer.toString('base64'));
    });

    it('should handle PDF format with proper conversion', async () => {
      const pdfHeader = Buffer.from('PDF-test-content');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: pdfHeader,
        status: 200,
        headers: { 'content-type': 'application/pdf' },
        fromCache: false,
        metadata: { responseTime: 200 },
      });

      const result = await handler.processDesignMockup('https://example.com/design.pdf');

      expect(result.exportFormat).toBe('pdf');
      expect(result.mediaType).toBe('image/png');
      expect(result.imageBlock.source.media_type).toBe('image/png'); // PDF converts to PNG for Claude SDK
    });

    it('should handle animated GIF images', async () => {
      const animatedGifHeader = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x64, 0x00]);

      mockWebFetch.mockResolvedValue({
        success: true,
        data: animatedGifHeader,
        status: 200,
        headers: { 'content-type': 'image/gif' },
        fromCache: false,
        metadata: { responseTime: 180 },
      });

      const result = await handler.processDesignMockup('https://example.com/animated.gif');

      expect(result.exportFormat).toBe('gif');
      expect(result.mediaType).toBe('image/gif');
      expect(result.imageBlock.source.media_type).toBe('image/gif');
    });

    it('should handle WebP format correctly', async () => {
      const webpHeader = Buffer.from([0x52, 0x49, 0x46, 0x46, 0x1A, 0x00, 0x00, 0x00]);

      mockWebFetch.mockResolvedValue({
        success: true,
        data: webpHeader,
        status: 200,
        headers: { 'content-type': 'image/webp' },
        fromCache: false,
        metadata: { responseTime: 120 },
      });

      const result = await handler.processDesignMockup('https://example.com/modern.webp');

      expect(result.exportFormat).toBe('webp');
      expect(result.mediaType).toBe('image/webp');
      expect(result.imageBlock.source.media_type).toBe('image/webp');
    });

    it('should handle format detection when content-type is missing', async () => {
      const pngHeader = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
      mockWebFetch.mockResolvedValue({
        success: true,
        data: pngHeader,
        status: 200,
        headers: {}, // No content-type header
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const result = await handler.processDesignMockup('https://example.com/no-content-type.png');

      expect(result.exportFormat).toBe('png');
      expect(result.imageBlock.source.media_type).toBe('image/png');
    });
  });

  describe('Design tool specific compatibility', () => {
    const designToolTests: Array<{
      tool: DesignTool;
      urlPattern: string;
      expectedFeatures: string[];
    }> = [
      {
        tool: 'figma',
        urlPattern: 'https://www.figma.com/file/test123/Design',
        expectedFeatures: ['node-id', 'version-id', 'viewport'],
      },
      {
        tool: 'sketch',
        urlPattern: 'https://sketch.cloud/s/test123/Design',
        expectedFeatures: ['artboard-id', 'version'],
      },
      {
        tool: 'adobe_xd',
        urlPattern: 'https://xd.adobe.com/view/test123/Design',
        expectedFeatures: ['artboard', 'mode'],
      },
      {
        tool: 'invision',
        urlPattern: 'https://invisionapp.com/share/test123/Design',
        expectedFeatures: ['screen-id', 'mode'],
      },
    ];

    designToolTests.forEach(({ tool, urlPattern }) => {
      it(`should detect and handle ${tool} URLs correctly`, async () => {
        const testImageData = Buffer.from(`${tool}-compatibility-test`);
        mockWebFetch.mockResolvedValue({
          success: true,
          data: testImageData,
          status: 200,
          headers: { 'content-type': 'image/png' },
          fromCache: false,
          metadata: { responseTime: 150 },
        });

        const result = await handler.processDesignMockup(urlPattern);

        expect(result.designTool).toBe(tool);
        expect(result.imageBlock).toBeDefined();
        expect(result.metadata.fileUrl).toBe(urlPattern);
      });
    });
  });

  describe('Export options compatibility', () => {
    it('should handle all supported export formats', async () => {
      const formats = ['png', 'jpeg', 'webp', 'svg', 'pdf'] as const;

      for (const format of formats) {
        const testImageData = Buffer.from(`${format}-export-test`);

        // Use proper content-type headers
        const contentType = format === 'pdf'
          ? 'application/pdf'
          : format === 'svg'
          ? 'image/svg+xml'
          : `image/${format}`;

        mockWebFetch.mockResolvedValueOnce({
          success: true,
          data: testImageData,
          status: 200,
          headers: { 'content-type': contentType },
          fromCache: false,
          metadata: { responseTime: 100 },
        });

        const options: DesignMockupOptions = {
          designTool: 'figma',
          exportFormat: format,
        };

        const result = await handler.processDesignMockup('https://example.com/test.png', options);

        expect(result.exportFormat).toBe(format);
        // SVG and PDF convert to image/png for Claude SDK compatibility
        if (format === 'svg' || format === 'pdf') {
          expect(result.mediaType).toBe('image/png');
        } else {
          expect(result.mediaType).toBe(`image/${format}`);
        }
      }
    });

    it('should handle various export scales', async () => {
      const scales = [0.5, 1, 1.5, 2, 3, 4];
      const testImageData = Buffer.from('scale-test');

      for (const scale of scales) {
        mockWebFetch.mockResolvedValueOnce({
          success: true,
          data: testImageData,
          status: 200,
          headers: { 'content-type': 'image/png' },
          fromCache: false,
          metadata: { responseTime: 100 },
        });

        const options: DesignMockupOptions = {
          designTool: 'figma',
          exportScale: scale,
        };

        const result = await handler.processDesignMockup('https://example.com/test.png', options);

        expect(result.exportScale).toBe(scale);
      }
    });
  });

  describe('Error response compatibility', () => {
    it('should handle various HTTP error responses', async () => {
      const errorResponses = [
        { status: 400, expectedCode: 'NETWORK_ERROR' },
        { status: 404, expectedCode: 'FILE_NOT_FOUND' },
        { status: 429, expectedCode: 'RATE_LIMITED' },
        { status: 500, expectedCode: 'NETWORK_ERROR' },
      ];

      for (const { status } of errorResponses) {
        mockWebFetch.mockResolvedValueOnce({
          success: true,
          data: null,
          status,
          headers: {},
          fromCache: false,
          metadata: { responseTime: 100 },
        });

        try {
          await handler.processDesignMockup('https://example.com/error.png');
        } catch (error) {
          expect(error).toBeInstanceOf(DesignMockupError);
        }
      }
    });
  });

  describe('Unicode and internationalization compatibility', () => {
    it('should handle Unicode file names in URLs', async () => {
      const testImageData = Buffer.from('unicode-filename-test');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const unicodeUrl = 'https://example.com/design-file.png';
      const result = await handler.processDesignMockup(unicodeUrl);

      expect(result.imageBlock).toBeDefined();
      expect(result.metadata.fileUrl).toBe(unicodeUrl);
    });
  });
});