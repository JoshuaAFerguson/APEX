/**
 * Integration tests for processDesignMockup convenience functions and advanced scenarios
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { processDesignMockup, isFigmaUrl, parseFigmaUrl } from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';
import type { DesignMockupOptions, DesignTool } from '../design-mockup-types';

// Mock WebFetchTool
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

describe('Design Mockup Integration Tests', () => {
  describe('Convenience function - processDesignMockup', () => {
    let mockWebFetch: any;

    beforeEach(() => {
      // Reset modules to ensure clean state
      vi.resetModules();

      // Mock the WebFetchTool execution
      const mockWebFetchTool = {
        execute: vi.fn(),
      };
      mockWebFetch = mockWebFetchTool.execute;

      vi.doMock('../webfetch', () => ({
        WebFetchTool: vi.fn().mockImplementation(() => mockWebFetchTool),
      }));
    });

    afterEach(() => {
      vi.resetAllMocks();
    });

    it('should process design mockup with default configuration', async () => {
      const testImageData = Buffer.from('test-default-config');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const { processDesignMockup: actualFunction } = await import('../multimodal-input-handler');
      const result = await actualFunction('https://example.com/design.png');

      expect(result.imageBlock).toBeDefined();
      expect(result.designTool).toBe('other');
      expect(result.exportFormat).toBe('png');
      expect(mockWebFetch).toHaveBeenCalledTimes(1);
    });

    it('should process design mockup with custom options', async () => {
      const testImageData = Buffer.from('test-custom-options');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/jpeg' },
        fromCache: false,
        metadata: { responseTime: 150 },
      });

      const options: Partial<DesignMockupOptions> = {
        exportFormat: 'jpeg',
        exportScale: 2,
        timeout: 45000,
        bypassCache: true,
      };

      const { processDesignMockup: actualFunction } = await import('../multimodal-input-handler');
      const result = await actualFunction('https://example.com/design.jpg', options);

      expect(result.exportFormat).toBe('jpeg');
      expect(result.exportScale).toBe(2);
      expect(mockWebFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 45000,
          bypassCache: true,
        })
      );
    });

    it('should process design mockup with custom handler configuration', async () => {
      const testImageData = Buffer.from('test-custom-handler');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const config = { maxFileSizeBytes: 5 * 1024 * 1024 }; // 5MB limit
      const options: Partial<DesignMockupOptions> = {
        exportFormat: 'png',
        exportScale: 1.5,
      };

      const { processDesignMockup: actualFunction } = await import('../multimodal-input-handler');
      const result = await actualFunction('https://example.com/small-design.png', options, config);

      expect(result.exportScale).toBe(1.5);
      expect(result.fileSizeBytes).toBeLessThanOrEqual(5 * 1024 * 1024);
    });

    it('should handle errors from underlying handler', async () => {
      mockWebFetch.mockRejectedValue(new DesignMockupError('Test error', 'PROCESSING_ERROR'));

      const { processDesignMockup: actualFunction } = await import('../multimodal-input-handler');

      await expect(actualFunction('https://example.com/error.png'))
        .rejects
        .toThrow(DesignMockupError);
    });

    it('should work with all supported design tools', async () => {
      const testImageData = Buffer.from('test-design-tools');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const designToolTests: Array<{ url: string; expectedTool: DesignTool }> = [
        { url: 'https://www.figma.com/file/abc123/Design', expectedTool: 'figma' },
        { url: 'https://sketch.cloud/s/abc123/Sketch', expectedTool: 'sketch' },
        { url: 'https://xd.adobe.com/view/abc123', expectedTool: 'adobe_xd' },
        { url: 'https://example.com/generic-design.png', expectedTool: 'other' },
      ];

      const { processDesignMockup: actualFunction } = await import('../multimodal-input-handler');

      for (const { url, expectedTool } of designToolTests) {
        const result = await actualFunction(url);
        expect(result.designTool).toBe(expectedTool);
      }
    });
  });

  describe('Convenience function - isFigmaUrl', () => {
    it('should correctly identify Figma URLs', () => {
      const figmaUrls = [
        'https://www.figma.com/file/abc123/Design',
        'https://figma.com/design/xyz789/Prototype',
        'https://www.figma.com/proto/def456/Interactive',
      ];

      const nonFigmaUrls = [
        'https://sketch.cloud/s/abc123',
        'https://example.com/design.png',
        'https://adobe.com/products/xd',
      ];

      figmaUrls.forEach(url => {
        expect(isFigmaUrl(url)).toBe(true);
      });

      nonFigmaUrls.forEach(url => {
        expect(isFigmaUrl(url)).toBe(false);
      });
    });

    it('should work with custom configuration', () => {
      const customConfig = { maxFileSizeBytes: 10 * 1024 * 1024 };

      expect(isFigmaUrl('https://www.figma.com/file/abc123/Design', customConfig)).toBe(true);
      expect(isFigmaUrl('https://example.com/image.png', customConfig)).toBe(false);
    });
  });

  describe('Convenience function - parseFigmaUrl', () => {
    it('should parse Figma URLs correctly', () => {
      const url = 'https://www.figma.com/file/abc123def456/My-Design?node-id=123:456';
      const result = parseFigmaUrl(url);

      expect(result.success).toBe(true);
      expect(result.info).toMatchObject({
        fileKey: 'abc123def456',
        fileName: 'My-Design',
        nodeId: '123:456',
        urlType: 'file',
      });
    });

    it('should handle parsing errors gracefully', () => {
      const result = parseFigmaUrl('invalid-url');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should work with custom configuration', () => {
      const customConfig = { maxFileSizeBytes: 50 * 1024 * 1024 };
      const url = 'https://www.figma.com/design/xyz789/Dashboard';

      const result = parseFigmaUrl(url, customConfig);

      expect(result.success).toBe(true);
      expect(result.info?.urlType).toBe('design');
    });
  });

  describe('End-to-end scenarios', () => {
    let mockWebFetch: jest.MockedFunction<any>;

    beforeEach(() => {
      jest.resetModules();

      const mockWebFetchTool = {
        execute: jest.fn(),
      };
      mockWebFetch = mockWebFetchTool.execute;

      jest.doMock('../webfetch', () => ({
        WebFetchTool: jest.fn().mockImplementation(() => mockWebFetchTool),
      }));
    });

    it('should handle complete Figma workflow', async () => {
      const testImageData = Buffer.from('figma-workflow-test');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 200 },
      });

      const figmaUrl = 'https://www.figma.com/file/abc123def456/Mobile-App-Design?node-id=123:456&version-id=987654321';

      // First, verify it's a Figma URL
      expect(isFigmaUrl(figmaUrl)).toBe(true);

      // Parse the URL to extract metadata
      const parseResult = parseFigmaUrl(figmaUrl);
      expect(parseResult.success).toBe(true);
      expect(parseResult.info?.fileKey).toBe('abc123def456');

      // Process the design mockup
      const { processDesignMockup: actualFunction } = await import('../multimodal-input-handler');
      const result = await actualFunction(figmaUrl, {
        exportFormat: 'png',
        exportScale: 2,
      });

      expect(result.designTool).toBe('figma');
      expect(result.metadata.fileId).toBe('abc123def456');
      expect(result.metadata.nodeId).toBe('123:456');
      expect(result.metadata.fileVersion).toBe('987654321');
      expect(result.exportScale).toBe(2);
    });

    it('should handle error recovery scenarios', async () => {
      // Simulate network error first
      mockWebFetch.mockRejectedValueOnce(new Error('Network timeout'));

      const { processDesignMockup: actualFunction } = await import('../multimodal-input-handler');

      await expect(actualFunction('https://example.com/design.png'))
        .rejects
        .toThrow(DesignMockupError);

      // Now simulate success on retry
      const testImageData = Buffer.from('retry-success');
      mockWebFetch.mockResolvedValueOnce({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const result = await actualFunction('https://example.com/design-retry.png');
      expect(result.imageBlock).toBeDefined();
    });

    it('should handle large file processing', async () => {
      const largeImageData = Buffer.alloc(15 * 1024 * 1024); // 15MB
      largeImageData.fill('large-image-data');

      mockWebFetch.mockResolvedValue({
        success: true,
        data: largeImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 5000 },
      });

      const { processDesignMockup: actualFunction } = await import('../multimodal-input-handler');
      const result = await actualFunction('https://example.com/large-design.png');

      expect(result.fileSizeBytes).toBe(15 * 1024 * 1024);
      expect(result.imageBlock.source.data).toBe(largeImageData.toString('base64'));
    });

    it('should handle concurrent requests efficiently', async () => {
      const testImageData = Buffer.from('concurrent-test');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const { processDesignMockup: actualFunction } = await import('../multimodal-input-handler');

      const urls = [
        'https://example.com/design1.png',
        'https://example.com/design2.png',
        'https://example.com/design3.png',
      ];

      const results = await Promise.all(
        urls.map(url => actualFunction(url))
      );

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.imageBlock).toBeDefined();
        expect(result.designTool).toBe('other');
      });

      expect(mockWebFetch).toHaveBeenCalledTimes(3);
    });
  });
});