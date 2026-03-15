/**
 * Performance and stress tests for processDesignMockup functionality
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

describe('MultimodalInputHandler - processDesignMockup Performance Tests', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetch: any;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetch = (handler as any).webFetchTool.execute;
    vi.clearAllMocks();
  });

  describe('Performance benchmarks', () => {
    it('should process small images quickly', async () => {
      const smallImageData = Buffer.from('small-image-data');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: smallImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 50 },
      });

      const startTime = performance.now();
      const result = await handler.processDesignMockup('https://example.com/small.png');
      const endTime = performance.now();

      expect(result.imageBlock).toBeDefined();
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should handle large images within reasonable time', async () => {
      const largeImageData = Buffer.alloc(10 * 1024 * 1024); // 10MB
      largeImageData.fill('large-image-data');

      mockWebFetch.mockImplementation(() => {
        return new Promise(resolve => {
          // Simulate network delay for large file
          setTimeout(() => {
            resolve({
              success: true,
              data: largeImageData,
              status: 200,
              headers: { 'content-type': 'image/png' },
              fromCache: false,
              metadata: { responseTime: 2000 },
            });
          }, 100);
        });
      });

      const startTime = performance.now();
      const result = await handler.processDesignMockup('https://example.com/large.png');
      const endTime = performance.now();

      expect(result.imageBlock).toBeDefined();
      expect(result.fileSizeBytes).toBe(10 * 1024 * 1024);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete in under 5 seconds
    });

    it('should measure and report processing time accurately', async () => {
      const testImageData = Buffer.from('timing-measurement-test');
      mockWebFetch.mockImplementation(() => {
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: true,
              data: testImageData,
              status: 200,
              headers: { 'content-type': 'image/png' },
              fromCache: false,
              metadata: { responseTime: 250 },
            });
          }, 250);
        });
      });

      const result = await handler.processDesignMockup('https://example.com/timing.png');

      expect(result.processingTime).toBeGreaterThan(240);
      expect(result.processingTime).toBeLessThan(300);
    });
  });

  describe('Memory usage optimization', () => {
    it('should efficiently handle base64 conversion for large files', async () => {
      const testSize = 5 * 1024 * 1024; // 5MB
      const largeImageData = Buffer.alloc(testSize);
      largeImageData.fill(0x89); // Fill with PNG magic number pattern

      mockWebFetch.mockResolvedValue({
        success: true,
        data: largeImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 500 },
      });

      const result = await handler.processDesignMockup('https://example.com/large-memory.png');

      expect(result.imageBlock.source.data).toBe(largeImageData.toString('base64'));
      expect(result.fileSizeBytes).toBe(testSize);

      // Verify the base64 data is correct
      const decodedData = Buffer.from(result.imageBlock.source.data, 'base64');
      expect(decodedData.length).toBe(testSize);
      expect(decodedData[0]).toBe(0x89);
    });

    it('should handle different buffer types efficiently', async () => {
      const testCases = [
        { type: 'string', data: 'string-binary-data' },
        { type: 'Buffer', data: Buffer.from('buffer-data') },
        { type: 'ArrayBuffer', data: new ArrayBuffer(16) },
        { type: 'unknown', data: { someData: 'unknown-type' } },
      ];

      for (const testCase of testCases) {
        mockWebFetch.mockResolvedValueOnce({
          success: true,
          data: testCase.data,
          status: 200,
          headers: { 'content-type': 'image/png' },
          fromCache: false,
          metadata: { responseTime: 100 },
        });

        const startTime = performance.now();
        const result = await handler.processDesignMockup(`https://example.com/${testCase.type}.png`);
        const endTime = performance.now();

        expect(result.imageBlock).toBeDefined();
        expect(endTime - startTime).toBeLessThan(500); // Should be fast for all types
      }
    });
  });

  describe('Concurrent processing stress tests', () => {
    it('should handle multiple concurrent requests efficiently', async () => {
      const concurrentRequests = 10;
      const testImageData = Buffer.from('concurrent-test-data');

      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 100 },
      });

      const urls = Array.from({ length: concurrentRequests }, (_, i) =>
        `https://example.com/concurrent-${i}.png`
      );

      const startTime = performance.now();
      const results = await Promise.all(
        urls.map(url => handler.processDesignMockup(url))
      );
      const endTime = performance.now();

      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result, index) => {
        expect(result.imageBlock).toBeDefined();
        expect(result.metadata.fileUrl).toBe(urls[index]);
      });

      // Should not take much longer than sequential processing
      expect(endTime - startTime).toBeLessThan(2000);
      expect(mockWebFetch).toHaveBeenCalledTimes(concurrentRequests);
    });

    it('should handle mixed success/failure scenarios under load', async () => {
      const totalRequests = 20;
      const successRequests = 15;
      const failureRequests = 5;

      let callCount = 0;
      mockWebFetch.mockImplementation(() => {
        callCount++;
        if (callCount <= successRequests) {
          return Promise.resolve({
            success: true,
            data: Buffer.from(`success-${callCount}`),
            status: 200,
            headers: { 'content-type': 'image/png' },
            fromCache: false,
            metadata: { responseTime: 100 },
          });
        } else {
          return Promise.resolve({
            success: false,
            error: `Network error for request ${callCount}`,
          });
        }
      });

      const urls = Array.from({ length: totalRequests }, (_, i) =>
        `https://example.com/mixed-${i}.png`
      );

      const results = await Promise.allSettled(
        urls.map(url => handler.processDesignMockup(url))
      );

      const successful = results.filter(r => r.status === 'fulfilled').length;
      const failed = results.filter(r => r.status === 'rejected').length;

      expect(successful).toBe(successRequests);
      expect(failed).toBe(failureRequests);
    });
  });

  describe('Cache performance optimization', () => {
    it('should leverage caching for repeated requests', async () => {
      const testImageData = Buffer.from('cached-performance-test');
      const url = 'https://example.com/cached-performance.png';

      // First request - cache miss
      mockWebFetch.mockResolvedValueOnce({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 500, cacheKey: 'performance-test-key' },
      });

      const firstStart = performance.now();
      const firstResult = await handler.processDesignMockup(url);
      const firstEnd = performance.now();

      expect(firstResult.fromCache).toBe(false);

      // Second request - cache hit (simulated)
      mockWebFetch.mockResolvedValueOnce({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: true,
        metadata: { responseTime: 5, cacheKey: 'performance-test-key' },
      });

      const secondStart = performance.now();
      const secondResult = await handler.processDesignMockup(url);
      const secondEnd = performance.now();

      expect(secondResult.fromCache).toBe(true);
      expect(secondResult.cacheKey).toBe('performance-test-key');

      // Cached request should be faster
      const firstDuration = firstEnd - firstStart;
      const secondDuration = secondEnd - secondStart;
      expect(secondDuration).toBeLessThan(firstDuration);
    });

    it('should handle cache bypass efficiently when requested', async () => {
      const testImageData = Buffer.from('cache-bypass-test');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 200 },
      });

      const options: DesignMockupOptions = {
        designTool: 'other',
        bypassCache: true,
      };

      const result = await handler.processDesignMockup('https://example.com/bypass.png', options);

      expect(result.fromCache).toBe(false);
      expect(mockWebFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          bypassCache: true,
        })
      );
    });
  });

  describe('Resource cleanup and limits', () => {
    it('should handle timeout scenarios gracefully', async () => {
      // Simulate a slow response that times out
      mockWebFetch.mockImplementation(() => {
        return new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error('Request timeout after 30000ms'));
          }, 100); // Simulate quick timeout for testing
        });
      });

      const options: DesignMockupOptions = {
        designTool: 'other',
        timeout: 50, // Very short timeout
      };

      const startTime = performance.now();

      await expect(handler.processDesignMockup('https://example.com/slow.png', options))
        .rejects
        .toThrow(DesignMockupError);

      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThan(1000); // Should fail quickly
    });

    it('should enforce strict file size limits under load', async () => {
      const customHandler = new MultimodalInputHandler({
        maxFileSizeBytes: 1024 * 1024, // 1MB limit
      });
      (customHandler as any).webFetchTool.execute = mockWebFetch;

      const oversizedData = Buffer.alloc(1024 * 1024 + 1); // Just over 1MB
      mockWebFetch.mockResolvedValue({
        success: true,
        data: oversizedData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 1000 },
      });

      await expect(customHandler.processDesignMockup('https://example.com/oversized.png'))
        .rejects
        .toThrow(DesignMockupError);
    });
  });

  describe('Figma-specific performance tests', () => {
    it('should parse complex Figma URLs efficiently', async () => {
      const complexFigmaUrl = 'https://www.figma.com/file/abc123def456ghi789/Complex-Design-File-Name-With-Lots-Of-Details?node-id=123:456&version-id=987654321&viewport=100,200,800,600&mode=dev&scale-factor=2&branch-name=feature-branch';

      const startTime = performance.now();
      const parseResult = handler.parseFigmaUrl(complexFigmaUrl);
      const endTime = performance.now();

      expect(parseResult.success).toBe(true);
      expect(parseResult.info?.fileKey).toBe('abc123def456ghi789');
      expect(parseResult.info?.nodeId).toBe('123:456');
      expect(parseResult.info?.versionId).toBe('987654321');
      expect(parseResult.info?.mode).toBe('dev');
      expect(parseResult.info?.scaleFactor).toBe(2);

      // URL parsing should be very fast
      expect(endTime - startTime).toBeLessThan(10);
    });

    it('should handle batch Figma URL processing efficiently', async () => {
      const testImageData = Buffer.from('figma-batch-test');
      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 150 },
      });

      const figmaUrls = [
        'https://www.figma.com/file/file1/Design-One?node-id=1:1',
        'https://www.figma.com/design/file2/Design-Two?node-id=2:2',
        'https://www.figma.com/proto/file3/Design-Three?node-id=3:3',
        'https://www.figma.com/file/file4/Design-Four?node-id=4:4&version-id=123',
        'https://www.figma.com/file/file5/Design-Five?viewport=0,0,400,300',
      ];

      const startTime = performance.now();
      const results = await Promise.all(
        figmaUrls.map(url => handler.processDesignMockup(url))
      );
      const endTime = performance.now();

      expect(results).toHaveLength(5);
      results.forEach((result, index) => {
        expect(result.designTool).toBe('figma');
        expect(result.imageBlock).toBeDefined();
        expect(result.metadata.fileUrl).toBe(figmaUrls[index]);
      });

      // Batch processing should be efficient
      expect(endTime - startTime).toBeLessThan(2000);
    });
  });

  describe('Stress testing edge cases', () => {
    it('should handle rapid sequential requests without degradation', async () => {
      const sequentialRequests = 50;
      const testImageData = Buffer.from('sequential-stress-test');

      mockWebFetch.mockResolvedValue({
        success: true,
        data: testImageData,
        status: 200,
        headers: { 'content-type': 'image/png' },
        fromCache: false,
        metadata: { responseTime: 50 },
      });

      const processingTimes: number[] = [];

      for (let i = 0; i < sequentialRequests; i++) {
        const startTime = performance.now();
        const result = await handler.processDesignMockup(`https://example.com/sequential-${i}.png`);
        const endTime = performance.now();

        expect(result.imageBlock).toBeDefined();
        processingTimes.push(endTime - startTime);
      }

      // Processing times should remain consistent (no significant degradation)
      const avgProcessingTime = processingTimes.reduce((sum, time) => sum + time, 0) / processingTimes.length;
      const maxProcessingTime = Math.max(...processingTimes);
      const minProcessingTime = Math.min(...processingTimes);

      expect(maxProcessingTime - minProcessingTime).toBeLessThan(avgProcessingTime * 2);
    });

    it('should handle various image formats without performance penalty', async () => {
      const formats = ['png', 'jpg', 'jpeg', 'webp', 'gif'];
      const testImageData = Buffer.from('format-performance-test');

      for (const format of formats) {
        mockWebFetch.mockResolvedValueOnce({
          success: true,
          data: testImageData,
          status: 200,
          headers: { 'content-type': `image/${format === 'jpg' ? 'jpeg' : format}` },
          fromCache: false,
          metadata: { responseTime: 100 },
        });

        const startTime = performance.now();
        const result = await handler.processDesignMockup(`https://example.com/test.${format}`);
        const endTime = performance.now();

        expect(result.imageBlock).toBeDefined();
        expect(endTime - startTime).toBeLessThan(500);
      }
    });
  });
});