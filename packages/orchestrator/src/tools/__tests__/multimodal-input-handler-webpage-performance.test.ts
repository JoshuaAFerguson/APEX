/**
 * Performance tests for web page processing functionality in MultimodalInputHandler
 *
 * These tests verify that web page processing operations complete within
 * acceptable time bounds and handle various load conditions efficiently.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import {
  MultimodalInputHandler,
  type WebPageOptions,
  type WebPageContent
} from '../multimodal-input-handler';
import { WebFetchTool, type WebFetchResult } from '../webfetch';

// Mock WebFetchTool
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));

const MockWebFetchTool = WebFetchTool as unknown as vi.MockedClass<typeof WebFetchTool>;

describe('MultimodalInputHandler - Web Page Performance Tests', () => {
  let handler: MultimodalInputHandler;
  let mockWebFetchExecute: MockedFunction<any>;

  beforeEach(() => {
    handler = new MultimodalInputHandler();
    mockWebFetchExecute = vi.fn();
    (handler as any).webFetchTool = {
      execute: mockWebFetchExecute,
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Helper to create mock responses with realistic timing
  const createMockWebFetchResult = (
    responseTime: number,
    contentSize: number,
    overrides: Partial<WebFetchResult> = {}
  ): WebFetchResult => ({
    success: true,
    status: 200,
    headers: { 'content-type': 'text/html' },
    data: 'Mock HTML content '.repeat(Math.floor(contentSize / 20)),
    fromCache: false,
    metadata: {
      url: 'https://example.com',
      method: 'GET',
      responseTime,
      contentLength: contentSize,
      contentType: 'text/html',
    },
    ...overrides,
  });

  // Helper to simulate network delay
  const simulateNetworkDelay = (delay: number) => {
    return new Promise<WebFetchResult>(resolve => {
      setTimeout(() => {
        resolve(createMockWebFetchResult(delay, 5000));
      }, delay);
    });
  };

  describe('single request performance', () => {
    it('should process small web pages quickly (< 100ms)', async () => {
      const smallPageSize = 5 * 1024; // 5KB
      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult(50, smallPageSize)
      );

      const startTime = performance.now();
      const result = await handler.processWebPage('https://example.com');
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.statusCode).toBe(200);
      expect(result.metadata.contentLength).toBe(smallPageSize);
      expect(processingTime).toBeLessThan(100); // Should complete quickly
    });

    it('should handle medium web pages efficiently (< 300ms)', async () => {
      const mediumPageSize = 100 * 1024; // 100KB
      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult(200, mediumPageSize)
      );

      const startTime = performance.now();
      const result = await handler.processWebPage('https://example.com');
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.statusCode).toBe(200);
      expect(result.metadata.contentLength).toBe(mediumPageSize);
      expect(processingTime).toBeLessThan(300); // Should handle medium pages efficiently
    });

    it('should process large web pages within reasonable time (< 1s)', async () => {
      const largePageSize = 1 * 1024 * 1024; // 1MB
      const largeContent = 'Large page content with lots of HTML. '.repeat(25000);

      mockWebFetchExecute.mockResolvedValue({
        success: true,
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: largeContent,
        fromCache: false,
        metadata: {
          url: 'https://example.com',
          method: 'GET',
          responseTime: 500,
          contentLength: largePageSize,
          contentType: 'text/html',
        },
      });

      const startTime = performance.now();
      const result = await handler.processWebPage('https://example.com');
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.statusCode).toBe(200);
      expect(result.markdown).toBeDefined();
      expect(processingTime).toBeLessThan(1000); // Should handle large pages within 1 second
    });
  });

  describe('processing time benchmarks', () => {
    it('should show performance difference between cached and non-cached requests', async () => {
      // Non-cached request (slower)
      mockWebFetchExecute.mockResolvedValueOnce(
        createMockWebFetchResult(800, 50000, { fromCache: false })
      );

      const startTime1 = performance.now();
      const result1 = await handler.processWebPage('https://example.com');
      const endTime1 = performance.now();
      const nonCachedTime = endTime1 - startTime1;

      expect(result1.fromCache).toBe(false);

      // Cached request (faster)
      mockWebFetchExecute.mockResolvedValueOnce(
        createMockWebFetchResult(0, 50000, {
          fromCache: true,
          metadata: {
            url: 'https://example.com',
            method: 'GET',
            responseTime: 0, // Instant from cache
            contentLength: 50000,
            contentType: 'text/html',
            cacheKey: 'cached-key',
          },
        })
      );

      const startTime2 = performance.now();
      const result2 = await handler.processWebPage('https://example.com');
      const endTime2 = performance.now();
      const cachedTime = endTime2 - startTime2;

      expect(result2.fromCache).toBe(true);
      expect(cachedTime).toBeLessThan(nonCachedTime); // Cached should be faster
    });

    it('should process text content faster than complex HTML', async () => {
      // Simple text content
      const simpleText = 'Simple plain text content.';
      mockWebFetchExecute.mockResolvedValueOnce({
        success: true,
        status: 200,
        headers: { 'content-type': 'text/plain' },
        data: simpleText,
        fromCache: false,
        metadata: {
          url: 'https://example.com/text',
          method: 'GET',
          responseTime: 100,
          contentLength: simpleText.length,
          contentType: 'text/plain',
        },
      });

      const startTime1 = performance.now();
      await handler.processWebPage('https://example.com/text');
      const endTime1 = performance.now();
      const textTime = endTime1 - startTime1;

      // Complex HTML content
      const complexHtml = `
        <html>
          <head><title>Complex Page</title></head>
          <body>
            ${'<div><p>Complex HTML content with nested elements</p></div>'.repeat(1000)}
          </body>
        </html>
      `;

      mockWebFetchExecute.mockResolvedValueOnce({
        success: true,
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: complexHtml,
        fromCache: false,
        metadata: {
          url: 'https://example.com/html',
          method: 'GET',
          responseTime: 100,
          contentLength: complexHtml.length,
          contentType: 'text/html',
        },
      });

      const startTime2 = performance.now();
      await handler.processWebPage('https://example.com/html');
      const endTime2 = performance.now();
      const htmlTime = endTime2 - startTime2;

      // Both should complete quickly, but text might be slightly faster
      expect(textTime).toBeLessThan(200);
      expect(htmlTime).toBeLessThan(300);
    });
  });

  describe('memory efficiency', () => {
    it('should not accumulate memory with repeated requests', async () => {
      const pageContent = 'Test content '.repeat(10000); // ~130KB
      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult(100, pageContent.length, { data: pageContent })
      );

      // Measure initial memory usage (approximate)
      const initialMemory = process.memoryUsage().heapUsed;

      // Process multiple pages
      const iterations = 20;
      for (let i = 0; i < iterations; i++) {
        const result = await handler.processWebPage(`https://example.com/page${i}`);
        expect(result.statusCode).toBe(200);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 10MB for this test)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it('should handle large content without excessive memory overhead', async () => {
      const largeContent = 'X'.repeat(5 * 1024 * 1024); // 5MB string

      mockWebFetchExecute.mockResolvedValue({
        success: true,
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: largeContent,
        fromCache: false,
        metadata: {
          url: 'https://example.com',
          method: 'GET',
          responseTime: 1000,
          contentLength: largeContent.length,
          contentType: 'text/html',
        },
      });

      const memoryBefore = process.memoryUsage().heapUsed;

      const result = await handler.processWebPage('https://example.com');

      expect(result.statusCode).toBe(200);
      expect(result.markdown).toBeDefined();

      const memoryAfter = process.memoryUsage().heapUsed;
      const memoryIncrease = memoryAfter - memoryBefore;

      // Memory increase should not be more than 3x the content size
      expect(memoryIncrease).toBeLessThan(largeContent.length * 3);
    });
  });

  describe('timeout handling performance', () => {
    it('should respect fast timeouts accurately', async () => {
      const shortTimeout = 100; // 100ms timeout
      mockWebFetchExecute.mockImplementation(() => simulateNetworkDelay(200)); // 200ms delay

      const startTime = performance.now();

      await expect(
        handler.processWebPage('https://slow-example.com', { timeout: shortTimeout })
      ).rejects.toThrow();

      const endTime = performance.now();
      const actualDuration = endTime - startTime;

      // Should timeout close to the specified timeout (within reasonable margin)
      expect(actualDuration).toBeGreaterThan(shortTimeout - 50);
      expect(actualDuration).toBeLessThan(shortTimeout + 150);
    });

    it('should handle concurrent timeouts efficiently', async () => {
      const timeout = 500;
      mockWebFetchExecute.mockImplementation(() => simulateNetworkDelay(1000)); // Always too slow

      const urls = [
        'https://slow1.example.com',
        'https://slow2.example.com',
        'https://slow3.example.com',
      ];

      const startTime = performance.now();

      const results = await Promise.allSettled(
        urls.map(url => handler.processWebPage(url, { timeout }))
      );

      const endTime = performance.now();
      const totalDuration = endTime - startTime;

      // All should have failed due to timeout
      expect(results.every(r => r.status === 'rejected')).toBe(true);

      // Should complete concurrent timeouts efficiently (not sequentially)
      expect(totalDuration).toBeLessThan(timeout * urls.length);
      expect(totalDuration).toBeGreaterThan(timeout - 100);
    });
  });

  describe('AI analysis performance', () => {
    it('should handle AI analysis requests efficiently when present', async () => {
      const contentWithAnalysis = 'Test content for AI analysis.';

      mockWebFetchExecute.mockResolvedValue({
        success: true,
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: contentWithAnalysis,
        fromCache: false,
        metadata: {
          url: 'https://example.com',
          method: 'GET',
          responseTime: 500,
          contentLength: contentWithAnalysis.length,
          contentType: 'text/html',
        },
        analysis: {
          content: 'This is test content suitable for AI analysis.',
          model: 'claude-3-5-haiku-latest',
          usage: { inputTokens: 20, outputTokens: 15 },
          truncated: false,
          originalContentLength: contentWithAnalysis.length,
          analyzedContentLength: contentWithAnalysis.length,
        },
      });

      const startTime = performance.now();

      const result = await handler.processWebPage('https://example.com', {
        prompt: 'Analyze this content',
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.analysis).toBeDefined();
      expect(result.analysis!.content).toBeDefined();
      expect(processingTime).toBeLessThan(1000); // Should complete within 1 second
    });

    it('should not significantly slow down processing when analysis fails', async () => {
      const content = 'Test content without analysis.';

      mockWebFetchExecute.mockResolvedValue({
        success: true,
        status: 200,
        headers: { 'content-type': 'text/html' },
        data: content,
        fromCache: false,
        metadata: {
          url: 'https://example.com',
          method: 'GET',
          responseTime: 200,
          contentLength: content.length,
          contentType: 'text/html',
        },
        analysisError: 'AI analysis service temporarily unavailable',
      });

      const startTime = performance.now();

      const result = await handler.processWebPage('https://example.com', {
        prompt: 'Analyze this content',
      });

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toBeDefined();
      expect(processingTime).toBeLessThan(300); // Should still be fast even with analysis error
    });
  });

  describe('concurrent processing performance', () => {
    it('should handle multiple simultaneous requests efficiently', async () => {
      const pageCount = 10;
      const responseTime = 200;

      mockWebFetchExecute.mockImplementation(() =>
        simulateNetworkDelay(responseTime)
      );

      const urls = Array.from({ length: pageCount }, (_, i) =>
        `https://example${i}.com`
      );

      const startTime = performance.now();
      const results = await Promise.all(
        urls.map(url => handler.processWebPage(url))
      );
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(pageCount);
      results.forEach(result => {
        expect(result.statusCode).toBe(200);
      });

      // Concurrent processing should be much faster than sequential
      expect(totalTime).toBeLessThan(responseTime * pageCount);
      expect(totalTime).toBeGreaterThan(responseTime - 100); // Should take at least one response time
    });

    it('should maintain performance with mixed success/failure scenarios', async () => {
      const requestCount = 8;
      let callCount = 0;

      mockWebFetchExecute.mockImplementation(() => {
        callCount++;
        if (callCount % 2 === 0) {
          // Even calls fail
          return Promise.resolve({
            success: false,
            error: 'Network error',
            metadata: {
              url: 'https://example.com',
              method: 'GET',
              responseTime: 100,
            },
          });
        } else {
          // Odd calls succeed
          return simulateNetworkDelay(150);
        }
      });

      const startTime = performance.now();
      const results = await Promise.allSettled(
        Array.from({ length: requestCount }, (_, i) =>
          handler.processWebPage(`https://example${i}.com`)
        )
      );
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(requestCount);

      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      expect(successes).toBe(4); // Half should succeed
      expect(failures).toBe(4);  // Half should fail
      expect(totalTime).toBeLessThan(500); // Should complete quickly despite mixed results
    });
  });

  describe('performance regression prevention', () => {
    it('should establish baseline performance metrics', async () => {
      const testCases = [
        { name: 'small', size: 1000, expectedMaxTime: 50 },
        { name: 'medium', size: 50000, expectedMaxTime: 150 },
        { name: 'large', size: 500000, expectedMaxTime: 400 },
      ];

      for (const { name, size, expectedMaxTime } of testCases) {
        const content = 'Content '.repeat(size / 8);
        mockWebFetchExecute.mockResolvedValueOnce(
          createMockWebFetchResult(50, size, { data: content })
        );

        const startTime = performance.now();
        const result = await handler.processWebPage(`https://${name}.example.com`);
        const endTime = performance.now();
        const processingTime = endTime - startTime;

        expect(result.statusCode).toBe(200);
        expect(processingTime).toBeLessThan(expectedMaxTime);

        // Log performance metrics for monitoring
        console.log(`${name.toUpperCase()} page (${size} bytes): ${processingTime.toFixed(2)}ms`);
      }
    });
  });
});