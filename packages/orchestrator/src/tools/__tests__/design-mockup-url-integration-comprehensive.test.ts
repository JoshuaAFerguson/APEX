/**
 * Comprehensive integration tests for URL-based design mockup downloads
 *
 * This test suite covers real-world scenarios for processing design mockups from various URLs,
 * including different design tools, formats, and network conditions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultimodalInputHandler } from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';
import type { DesignMockupOptions } from '../design-mockup-types';

// Mock WebFetchTool for controlled testing
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

describe('Design Mockup URL Integration - Comprehensive', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetch: any;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetch = (handler as any).webFetchTool.execute;
    vi.clearAllMocks();
  });

  describe('Figma URL integration scenarios', () => {
    it('should successfully process complete Figma file URL workflow', async () => {
      const figmaUrl = 'https://www.figma.com/file/abc123def456ghi789jkl012mno345/E-commerce-Dashboard?node-id=123:456&version-id=987654321&mode=design&scale-factor=2&viewport=0,0,1920,1080';

      // Mock realistic Figma image response
      const figmaImageData = Buffer.alloc(2048, 0x89); // PNG-like data
      mockWebFetch.mockResolvedValue({
        success: true,
        data: figmaImageData,
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': figmaImageData.length.toString(),
          'cache-control': 'public, max-age=3600',
        },
        fromCache: false,
        metadata: {
          responseTime: 850,
          contentLength: figmaImageData.length,
          finalUrl: figmaUrl,
        },
      });

      const result = await handler.processDesignMockup(figmaUrl);

      // Verify comprehensive result structure
      expect(result).toMatchObject({
        designTool: 'figma',
        exportFormat: 'png',
        exportScale: 2,
        mediaType: 'image/png',
        fileSizeBytes: figmaImageData.length,
        fromCache: false,
      });

      // Verify metadata extraction from Figma URL
      expect(result.metadata).toMatchObject({
        fileId: 'abc123def456ghi789jkl012mno345',
        nodeId: '123:456',
        fileUrl: figmaUrl,
        frameName: 'E-commerce Dashboard',
        fileVersion: '987654321',
      });

      // Verify dimensions from viewport
      expect(result.dimensions).toMatchObject({
        width: 1920,
        height: 1080,
        unit: 'px',
      });

      // Verify image block structure
      expect(result.imageBlock).toMatchObject({
        type: 'image',
        source: {
          type: 'base64',
          media_type: 'image/png',
          data: figmaImageData.toString('base64'),
        },
      });

      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle Figma design mode URLs with branch information', async () => {
      const figmaDesignUrl = 'https://www.figma.com/design/xyz789abc012/Mobile-App-Redesign?branch-name=feature%2Fdark-mode&node-id=456:789&mode=dev';

      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('figma-design-data'),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 650 },
      });

      const result = await handler.processDesignMockup(figmaDesignUrl);

      expect(result.designTool).toBe('figma');
      expect(result.metadata).toMatchObject({
        fileId: 'xyz789abc012',
        nodeId: '456:789',
        frameName: 'Mobile App Redesign',
        branchName: 'feature/dark-mode',
        mode: 'dev',
      });
    });

    it('should handle Figma prototype URLs with interaction data', async () => {
      const figmaProtoUrl = 'https://www.figma.com/proto/proto123xyz456/Interactive-Prototype?node-id=1:2&scaling=scale-down&page-id=0:1&starting-point-node-id=1:2';

      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('figma-proto-data'),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: true,
        metadata: {
          responseTime: 50,
          cacheKey: 'figma-proto-cache-key',
        },
      });

      const result = await handler.processDesignMockup(figmaProtoUrl);

      expect(result.designTool).toBe('figma');
      expect(result.fromCache).toBe(true);
      expect(result.cacheKey).toBe('figma-proto-cache-key');
      expect(result.metadata.frameName).toBe('Interactive Prototype');
    });

    it('should handle Figma authentication errors gracefully', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: null,
        status: 403,
        headers: { 'www-authenticate': 'Bearer realm="Figma"' },
        fromCache: false,
        metadata: { responseTime: 200 },
      });

      await expect(handler.processDesignMockup('https://www.figma.com/file/private123/Private-Design'))
        .rejects
        .toThrow(DesignMockupError);
    });
  });

  describe('Multi-platform design tool integration', () => {
    const designToolTestCases = [
      {
        name: 'Sketch Cloud',
        url: 'https://sketch.cloud/s/abc123/Design-System/preview',
        tool: 'sketch',
      },
      {
        name: 'Adobe XD',
        url: 'https://xd.adobe.com/view/abc123/Design-Specs',
        tool: 'adobe_xd',
      },
      {
        name: 'InVision',
        url: 'https://invisionapp.com/share/ABCDEFGHIJ',
        tool: 'invision',
      },
      {
        name: 'Zeplin',
        url: 'https://zeplin.io/project/5f8b123456789/screen/5f8b123456789',
        tool: 'zeplin',
      },
      {
        name: 'Framer',
        url: 'https://framer.com/share/Dashboard--WxYzAbCdEf',
        tool: 'framer',
      },
      {
        name: 'Canva',
        url: 'https://www.canva.com/design/ABCDEFGHIJK/Social-Media-Post/view',
        tool: 'canva',
      },
    ];

    designToolTestCases.forEach(({ name, url, tool }) => {
      it(`should process ${name} URLs correctly`, async () => {
        const testImageData = Buffer.from(`${tool}-image-data`);
        mockWebFetch.mockResolvedValue({
          success: true,
          data: testImageData,
          status: 200,
          headers: { 'content-type': 'image/png' },
          fromCache: false,
          metadata: { responseTime: Math.random() * 1000 + 100 },
        });

        const result = await handler.processDesignMockup(url);

        expect(result.designTool).toBe(tool);
        expect(result.imageBlock.source.data).toBe(testImageData.toString('base64'));
        expect(result.metadata.fileUrl).toBe(url);
      });
    });
  });

  describe('Real-world image format scenarios', () => {
    const formatTestCases = [
      {
        url: 'https://cdn.dribbble.com/shots/12345/mobile-ui-design.png',
        contentType: 'image/png',
        expectedFormat: 'png',
        expectedTool: 'other',
      },
      {
        url: 'https://mir-s3-cdn-cf.behance.net/project_modules/max_1200/abc123/87654321.jpg',
        contentType: 'image/jpeg',
        expectedFormat: 'jpeg',
        expectedTool: 'other',
      },
      {
        url: 'https://images.unsplash.com/photo-1234567890/design-inspiration.webp',
        contentType: 'image/webp',
        expectedFormat: 'webp',
        expectedTool: 'other',
      },
      {
        url: 'https://raw.githubusercontent.com/user/repo/main/assets/icon.svg',
        contentType: 'image/svg+xml',
        expectedFormat: 'svg',
        expectedTool: 'other',
      },
    ];

    formatTestCases.forEach(({ url, contentType, expectedFormat, expectedTool }) => {
      it(`should handle ${expectedFormat.toUpperCase()} format from real CDN: ${url}`, async () => {
        const sampleImageData = Buffer.alloc(1024, Math.floor(Math.random() * 256));
        mockWebFetch.mockResolvedValue({
          success: true,
          data: sampleImageData,
          status: 200,
          headers: {
            'content-type': contentType,
            'content-length': sampleImageData.length.toString(),
            'etag': `"${Math.random().toString(36)}"`,
            'last-modified': new Date().toUTCString(),
          },
          fromCache: false,
          metadata: {
            responseTime: Math.random() * 500 + 200,
            contentLength: sampleImageData.length,
          },
        });

        const result = await handler.processDesignMockup(url);

        expect(result.designTool).toBe(expectedTool);
        expect(result.exportFormat).toBe(expectedFormat);
        expect(result.mediaType).toBe(contentType);
        expect(result.fileSizeBytes).toBe(sampleImageData.length);
        expect(result.processingTime).toBeGreaterThan(0);
      });
    });
  });

  describe('Complex workflow integration scenarios', () => {
    it('should handle complete design workflow with caching', async () => {
      const workflowUrl = 'https://www.figma.com/file/workflow123/Design-System-Components';
      const cachedImageData = Buffer.from('cached-workflow-data');

      // First request - cache miss
      mockWebFetch.mockResolvedValueOnce({
        success: true,
        data: cachedImageData,
        status: 200,
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=3600',
          'etag': '"workflow-etag-123"',
        },
        fromCache: false,
        metadata: {
          responseTime: 1200,
          cacheKey: 'figma-workflow-123',
        },
      });

      const firstResult = await handler.processDesignMockup(workflowUrl);
      expect(firstResult.fromCache).toBe(false);
      expect(firstResult.processingTime).toBeGreaterThan(0);

      // Second request - cache hit
      mockWebFetch.mockResolvedValueOnce({
        success: true,
        data: cachedImageData,
        status: 200,
        headers: {
          'content-type': 'image/png',
          'cache-control': 'public, max-age=3600',
          'etag': '"workflow-etag-123"',
        },
        fromCache: true,
        metadata: {
          responseTime: 25,
          cacheKey: 'figma-workflow-123',
        },
      });

      const secondResult = await handler.processDesignMockup(workflowUrl);
      expect(secondResult.fromCache).toBe(true);
      expect(secondResult.cacheKey).toBe('figma-workflow-123');
    });

    it('should handle design mockup with custom options and headers', async () => {
      const customOptions: DesignMockupOptions = {
        designTool: 'figma',
        exportFormat: 'jpeg',
        exportScale: 3,
        headers: {
          'Authorization': 'Bearer figma-token-123',
          'User-Agent': 'ApexCLI/0.6.0',
        },
        timeout: 30000,
        bypassCache: true,
      };

      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.from('custom-options-data'),
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
        fromCache: false,
        metadata: { responseTime: 800 },
      });

      const result = await handler.processDesignMockup(
        'https://www.figma.com/file/custom123/Custom-Design',
        customOptions
      );

      expect(result.exportFormat).toBe('jpeg');
      expect(result.exportScale).toBe(3);
      expect(result.mediaType).toBe('image/jpeg');

      // Verify custom headers were passed to WebFetch
      expect(mockWebFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer figma-token-123',
            'User-Agent': 'ApexCLI/0.6.0',
          },
          timeout: 30000,
          bypassCache: true,
        })
      );
    });

    it('should handle high-resolution design exports', async () => {
      const hiResUrl = 'https://www.figma.com/file/hires123/High-Resolution-Design?scale-factor=4&export-format=png';
      const hiResImageData = Buffer.alloc(15 * 1024 * 1024, 0x42); // 15MB high-res image

      mockWebFetch.mockResolvedValue({
        success: true,
        data: hiResImageData,
        status: 200,
        headers: {
          'content-type': 'image/png',
          'content-length': hiResImageData.length.toString(),
        },
        fromCache: false,
        metadata: {
          responseTime: 8000, // 8 seconds for large file
          contentLength: hiResImageData.length,
        },
      });

      const result = await handler.processDesignMockup(hiResUrl);

      expect(result.fileSizeBytes).toBe(15 * 1024 * 1024);
      expect(result.exportScale).toBe(4);
      expect(result.processingTime).toBeGreaterThan(7000);
      expect(result.imageBlock.source.data).toBe(hiResImageData.toString('base64'));
    });
  });

  describe('Error recovery and resilience', () => {
    it('should handle network instability and retry scenarios', async () => {
      const unstableUrl = 'https://unstable-cdn.com/design.png';

      // Simulate network failure followed by success
      mockWebFetch
        .mockResolvedValueOnce({
          success: false,
          error: 'ECONNRESET: Connection reset by peer',
          status: 0,
        })
        .mockResolvedValueOnce({
          success: true,
          data: Buffer.from('recovered-image-data'),
          status: 200,
          headers: { 'content-type': 'image/png' },
          fromCache: false,
          metadata: { responseTime: 2000, retries: 1 },
        });

      // First call should fail
      await expect(handler.processDesignMockup(unstableUrl))
        .rejects
        .toThrow(DesignMockupError);

      // Second call should succeed
      const result = await handler.processDesignMockup(unstableUrl);
      expect(result.imageBlock).toBeDefined();
      expect(result.processingTime).toBeGreaterThan(0);
    });

    it('should handle rate limiting with appropriate backoff', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: null,
        status: 429,
        headers: {
          'retry-after': '60',
          'x-ratelimit-remaining': '0',
        },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      await expect(handler.processDesignMockup('https://api.figma.com/v1/files/rate-limited'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should handle CDN failures and fallback scenarios', async () => {
      const cdnUrls = [
        'https://primary-cdn.figma.com/image.png',
        'https://fallback-cdn.figma.com/image.png',
      ];

      // Primary CDN fails
      mockWebFetch.mockResolvedValueOnce({
        success: false,
        error: 'Service Unavailable',
        status: 503,
      });

      await expect(handler.processDesignMockup(cdnUrls[0]))
        .rejects
        .toThrow(DesignMockupError);

      // Fallback CDN succeeds
      mockWebFetch.mockResolvedValueOnce({
        success: true,
        data: Buffer.from('fallback-image-data'),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 1500 },
      });

      const result = await handler.processDesignMockup(cdnUrls[1]);
      expect(result.imageBlock).toBeDefined();
    });
  });

  describe('Performance benchmarks', () => {
    it('should process small images efficiently (< 1 second)', async () => {
      const smallImageData = Buffer.alloc(50 * 1024, 0x42); // 50KB
      mockWebFetch.mockResolvedValue({
        success: true,
        data: smallImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 200 },
      });

      const startTime = Date.now();
      const result = await handler.processDesignMockup('https://example.com/small.png');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(1000);
      expect(result.processingTime).toBeLessThan(500);
    });

    it('should handle medium images within reasonable time (< 3 seconds)', async () => {
      const mediumImageData = Buffer.alloc(2 * 1024 * 1024, 0x42); // 2MB
      mockWebFetch.mockResolvedValue({
        success: true,
        data: mediumImageData,
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
        fromCache: false,
        metadata: { responseTime: 1500 },
      });

      const startTime = Date.now();
      const result = await handler.processDesignMockup('https://example.com/medium.jpg');
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(3000);
      expect(result.processingTime).toBeLessThan(2000);
    });

    it('should process large images within acceptable limits (< 10 seconds)', async () => {
      const largeImageData = Buffer.alloc(10 * 1024 * 1024, 0x42); // 10MB
      mockWebFetch.mockResolvedValue({
        success: true,
        data: largeImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 5000 },
      });

      const result = await handler.processDesignMockup('https://example.com/large.png');

      expect(result.fileSizeBytes).toBe(10 * 1024 * 1024);
      expect(result.processingTime).toBeLessThan(10000);
      expect(result.imageBlock.source.data).toBe(largeImageData.toString('base64'));
    });
  });

  describe('Metadata extraction validation', () => {
    it('should extract comprehensive metadata from complex filenames', async () => {
      const complexUrls = [
        {
          url: 'https://example.com/Dashboard_Mobile_v2.3_@3x_Active_Page1.png',
          expectedMetadata: {
            frameName: 'Dashboard',
            platformName: 'mobile',
            version: '2.3',
            scaleFactor: 3,
            stateName: 'active',
            pageNumber: 1,
          },
        },
        {
          url: 'https://example.com/Button-Primary-Hover_Desktop_Large.svg',
          expectedMetadata: {
            frameName: 'Button',
            componentName: 'button',
            stateName: 'hover',
            platformName: 'desktop',
          },
        },
        {
          url: 'https://example.com/Modal-Form-Input-Disabled_Tablet_v1.jpg',
          expectedMetadata: {
            frameName: 'Modal',
            componentName: 'modal',
            stateName: 'disabled',
            platformName: 'tablet',
            version: '1',
          },
        },
      ];

      for (const { url, expectedMetadata } of complexUrls) {
        mockWebFetch.mockResolvedValue({
          success: true,
          data: Buffer.from('complex-metadata-image'),
          status: 200,
          headers: { 'content-type': 'image/png' },
          fromCache: false,
          metadata: { responseTime: 300 },
        });

        const result = await handler.processDesignMockup(url);

        Object.entries(expectedMetadata).forEach(([key, value]) => {
          expect(result.metadata).toHaveProperty(key, value);
        });
      }
    });

    it('should handle internationalized filenames and URLs', async () => {
      const internationalUrls = [
        'https://example.com/设计稿_移动端_v1.png',
        'https://example.com/Diseño-Móvil_es.jpg',
        'https://example.com/デザイン_モバイル_v2.webp',
      ];

      for (const url of internationalUrls) {
        mockWebFetch.mockResolvedValue({
          success: true,
          data: Buffer.from('international-image'),
          status: 200,
          headers: { 'content-type': 'image/png' },
          fromCache: false,
          metadata: { responseTime: 400 },
        });

        const result = await handler.processDesignMockup(url);
        expect(result.metadata.fileName).toBeDefined();
        expect(result.metadata.fileUrl).toBe(url);
      }
    });
  });
});