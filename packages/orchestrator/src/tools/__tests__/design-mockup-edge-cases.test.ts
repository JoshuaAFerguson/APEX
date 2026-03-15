/**
 * Edge case tests for processDesignMockup functionality
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { MultimodalInputHandler } from '../multimodal-input-handler';
import { DesignMockupError } from '../design-mockup-types';
import type { DesignMockupOptions } from '../design-mockup-types';

// Mock WebFetchTool
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn().mockImplementation(() => ({
    execute: vi.fn(),
  })),
}));

describe('MultimodalInputHandler - processDesignMockup Edge Cases', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetch: any;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetch = (handler as any).webFetchTool.execute;
    vi.clearAllMocks();
  });

  describe('Data format handling edge cases', () => {
    it('should handle ArrayBuffer response data', async () => {
      const testArrayBuffer = new ArrayBuffer(16);
      const view = new Uint8Array(testArrayBuffer);
      for (let i = 0; i < view.length; i++) {
        view[i] = i * 16;
      }

      mockWebFetch.mockResolvedValue({
        success: true,
        data: testArrayBuffer,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const result = await handler.processDesignMockup('https://example.com/arraybuffer.png');
      expect(result.imageBlock.source.data).toBe(Buffer.from(testArrayBuffer).toString('base64'));
      expect(result.fileSizeBytes).toBe(16);
    });

    it('should handle unknown data types', async () => {
      const unknownData = { data: 'test' };
      mockWebFetch.mockResolvedValue({
        success: true,
        data: unknownData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const result = await handler.processDesignMockup('https://example.com/unknown.png');
      expect(result.imageBlock.source.data).toBe(Buffer.from(String(unknownData), 'binary').toString('base64'));
    });
  });

  describe('Error code verification', () => {
    it('should return correct error code for rate limiting', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        status: 429,
        data: null,
        headers: {},
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      try {
        await handler.processDesignMockup('https://www.figma.com/file/test123/Design');
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        expect((error as DesignMockupError).code).toBe('RATE_LIMITED');
      }
    });

    it('should return correct error code for authentication', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        status: 403,
        data: null,
        headers: {},
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      try {
        await handler.processDesignMockup('https://www.figma.com/file/private123/Private');
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        expect((error as DesignMockupError).code).toBe('AUTHENTICATION_REQUIRED');
      }
    });

    it('should return correct error code for not found', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        status: 404,
        data: null,
        headers: {},
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      try {
        await handler.processDesignMockup('https://example.com/notfound.png');
      } catch (error) {
        expect(error).toBeInstanceOf(DesignMockupError);
        expect((error as DesignMockupError).code).toBe('FILE_NOT_FOUND');
      }
    });
  });

  describe('URL validation edge cases', () => {
    it('should handle malformed URLs', async () => {
      await expect(handler.processDesignMockup('not-a-valid-url')).rejects.toThrow(DesignMockupError);
    });

    it('should handle very long URLs', async () => {
      const testImageData = Buffer.from('test-data');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const longUrl = 'https://example.com/' + 'a'.repeat(1000) + '.png';
      const result = await handler.processDesignMockup(longUrl);
      expect(result.metadata.fileUrl).toBe(longUrl);
    });
  });

  describe('Processing time measurement', () => {
    it('should measure processing time with artificial delay', async () => {
      const testImageData = Buffer.from('timing-test');
      mockWebFetch.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              data: testImageData,
              status: 200,
              headers: { 'content-type': 'image/png' },
              fromCache: false,
              metadata: { responseTime: 100 },
            });
          }, 100);
        });
      });

      const result = await handler.processDesignMockup('https://example.com/timing.png');
      expect(result.processingTime).toBeGreaterThan(90);
    });
  });

  describe('Export scale validation', () => {
    beforeEach(() => {
      const testImageData = Buffer.from('scale-test');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });
    });

    it('should handle decimal export scales', async () => {
      const result = await handler.processDesignMockup('https://example.com/test.png', {
        designTool: 'other',
        exportScale: 1.5
      });
      expect(result.exportScale).toBe(1.5);
    });

    it('should handle very small export scales', async () => {
      const result = await handler.processDesignMockup('https://example.com/test.png', {
        designTool: 'other',
        exportScale: 0.1
      });
      expect(result.exportScale).toBe(0.1);
    });

    it('should handle large export scales', async () => {
      const result = await handler.processDesignMockup('https://example.com/test.png', {
        designTool: 'other',
        exportScale: 10
      });
      expect(result.exportScale).toBe(10);
    });
  });

  describe('Zero-byte file handling', () => {
    it('should reject zero-byte files', async () => {
      mockWebFetch.mockResolvedValue({
        success: true,
        data: Buffer.alloc(0),
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      await expect(handler.processDesignMockup('https://example.com/empty.png'))
        .rejects
        .toThrow(DesignMockupError);
    });
  });

  describe('Cache behavior verification', () => {
    it('should properly set cache flags', async () => {
      const testImageData = Buffer.from('cache-test');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: true,
        metadata: {
          responseTime: 5,
          cacheKey: 'test-key-123'
        },
      });

      const result = await handler.processDesignMockup('https://example.com/cached.png');
      expect(result.fromCache).toBe(true);
      expect(result.cacheKey).toBe('test-key-123');
    });
  });
});