/**
 * Stress tests for web page processing functionality in MultimodalInputHandler
 *
 * These tests verify the handler can maintain stability and performance
 * under high load conditions, including concurrent requests, memory pressure,
 * and error scenarios.
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  type WebPageOptions
} from '../multimodal-input-handler';
import { WebFetchTool, type WebFetchResult } from '../webfetch';

// Mock WebFetchTool
vi.mock('../webfetch', () => ({
  WebFetchTool: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));

const MockWebFetchTool = WebFetchTool as unknown as vi.MockedClass<typeof WebFetchTool>;

describe('MultimodalInputHandler - Web Page Stress Tests', () => {
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

  // Helper to create realistic mock responses
  const createMockResponse = (
    overrides: Partial<WebFetchResult> = {}
  ): WebFetchResult => ({
    success: true,
    status: 200,
    headers: { 'content-type': 'text/html' },
    data: '<html><head><title>Test</title></head><body><p>Content</p></body></html>',
    fromCache: false,
    metadata: {
      url: 'https://example.com',
      method: 'GET',
      responseTime: 100 + Math.random() * 200,
      contentLength: 1000 + Math.random() * 5000,
      contentType: 'text/html',
    },
    ...overrides,
  });

  // Helper to simulate variable network conditions
  const simulateVariableDelay = (minDelay: number, maxDelay: number) => {
    const delay = minDelay + Math.random() * (maxDelay - minDelay);
    return new Promise<WebFetchResult>(resolve => {
      setTimeout(() => {
        resolve(createMockResponse({
          metadata: {
            url: 'https://example.com',
            method: 'GET',
            responseTime: delay,
            contentLength: 5000,
            contentType: 'text/html',
          },
        }));
      }, delay);
    });
  };

  describe('high concurrency stress tests', () => {
    it('should handle 50 concurrent web page requests', async () => {
      const concurrentRequests = 50;

      mockWebFetchExecute.mockImplementation(() =>
        simulateVariableDelay(10, 100)
      );

      const startTime = Date.now();
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        handler.processWebPage(`https://example${i}.com`)
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(results).toHaveLength(concurrentRequests);
      results.forEach((result, index) => {
        expect(result.statusCode).toBe(200);
        expect(result.url).toBe(`https://example${index}.com`);
      });

      // Should complete within reasonable time (much less than sequential)
      expect(totalTime).toBeLessThan(5000); // 5 seconds
      console.log(`50 concurrent requests completed in ${totalTime}ms`);
    });

    it('should handle 100 concurrent requests with mixed results', async () => {
      const concurrentRequests = 100;
      let requestCounter = 0;

      mockWebFetchExecute.mockImplementation(() => {
        requestCounter++;
        const shouldFail = requestCounter % 4 === 0; // 25% failure rate

        if (shouldFail) {
          return Promise.resolve({
            success: false,
            error: `Network error for request ${requestCounter}`,
            metadata: {
              url: `https://example${requestCounter}.com`,
              method: 'GET',
              responseTime: 50,
            },
          });
        }

        return simulateVariableDelay(5, 150);
      });

      const startTime = Date.now();
      const promises = Array.from({ length: concurrentRequests }, (_, i) =>
        handler.processWebPage(`https://example${i}.com`).catch(error => ({ error }))
      );

      const results = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const successes = results.filter(r => !r.error).length;
      const failures = results.filter(r => r.error).length;

      expect(successes).toBeGreaterThan(60); // At least 60% should succeed
      expect(failures).toBeGreaterThan(15);  // Some should fail
      expect(successes + failures).toBe(concurrentRequests);

      console.log(`100 mixed requests: ${successes} success, ${failures} failures in ${totalTime}ms`);
    });

    it('should maintain stability under extreme concurrency (200 requests)', async () => {
      const extremeConcurrency = 200;

      mockWebFetchExecute.mockImplementation(() =>
        Promise.resolve(createMockResponse({
          metadata: {
            url: 'https://example.com',
            method: 'GET',
            responseTime: 1 + Math.random() * 10, // Very fast responses
            contentLength: 1000,
            contentType: 'text/html',
          },
        }))
      );

      const startTime = Date.now();

      // Process in batches to avoid overwhelming the system
      const batchSize = 50;
      const batches = Math.ceil(extremeConcurrency / batchSize);
      const allResults = [];

      for (let batch = 0; batch < batches; batch++) {
        const batchStart = batch * batchSize;
        const batchEnd = Math.min((batch + 1) * batchSize, extremeConcurrency);
        const batchSize = batchEnd - batchStart;

        const batchPromises = Array.from({ length: batchSize }, (_, i) =>
          handler.processWebPage(`https://batch${batch}-example${i}.com`)
        );

        const batchResults = await Promise.all(batchPromises);
        allResults.push(...batchResults);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      expect(allResults).toHaveLength(extremeConcurrency);
      allResults.forEach(result => {
        expect(result.statusCode).toBe(200);
      });

      console.log(`200 requests in batches completed in ${totalTime}ms`);
    });
  });

  describe('memory pressure stress tests', () => {
    it('should handle processing many large web pages', async () => {
      const largePageCount = 20;
      const largePageSize = 500 * 1024; // 500KB each

      const largeContent = 'Large web page content with lots of HTML and text. '.repeat(10000);

      mockWebFetchExecute.mockImplementation(() =>
        Promise.resolve(createMockResponse({
          data: largeContent,
          metadata: {
            url: 'https://example.com',
            method: 'GET',
            responseTime: 200,
            contentLength: largePageSize,
            contentType: 'text/html',
          },
        }))
      );

      const memoryBefore = process.memoryUsage();

      const results = await Promise.all(
        Array.from({ length: largePageCount }, (_, i) =>
          handler.processWebPage(`https://large-page${i}.com`)
        )
      );

      const memoryAfter = process.memoryUsage();
      const memoryIncrease = memoryAfter.heapUsed - memoryBefore.heapUsed;

      expect(results).toHaveLength(largePageCount);
      results.forEach(result => {
        expect(result.statusCode).toBe(200);
        expect(result.markdown).toBeDefined();
      });

      // Memory usage should be reasonable (less than 100MB increase)
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024);

      console.log(`Memory increase for ${largePageCount} large pages: ${Math.round(memoryIncrease / 1024 / 1024)}MB`);
    });

    it('should handle rapid sequential processing without memory leaks', async () => {
      const sequentialCount = 100;
      const pageContent = 'Sequential test content. '.repeat(1000);

      mockWebFetchExecute.mockResolvedValue(
        createMockResponse({ data: pageContent })
      );

      const memoryReadings = [];

      for (let i = 0; i < sequentialCount; i++) {
        await handler.processWebPage(`https://sequential${i}.com`);

        // Take memory reading every 10 iterations
        if (i % 10 === 0) {
          memoryReadings.push(process.memoryUsage().heapUsed);
        }
      }

      // Memory should stabilize and not continuously grow
      const firstReading = memoryReadings[0];
      const lastReading = memoryReadings[memoryReadings.length - 1];
      const memoryGrowth = lastReading - firstReading;

      // Allow some memory growth but not excessive
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth

      console.log(`Sequential processing memory growth: ${Math.round(memoryGrowth / 1024 / 1024)}MB`);
    });
  });

  describe('error resilience stress tests', () => {
    it('should recover gracefully from intermittent failures', async () => {
      const requestCount = 50;
      let failureCounter = 0;

      mockWebFetchExecute.mockImplementation(() => {
        failureCounter++;

        // Create intermittent failures (every 3rd request fails)
        if (failureCounter % 3 === 0) {
          const errorTypes = [
            'Network timeout',
            'Connection refused',
            'DNS resolution failed',
            'Server error 500',
          ];
          const randomError = errorTypes[Math.floor(Math.random() * errorTypes.length)];

          return Promise.resolve({
            success: false,
            error: randomError,
            metadata: {
              url: 'https://example.com',
              method: 'GET',
              responseTime: 100 + Math.random() * 200,
            },
          });
        }

        return simulateVariableDelay(20, 200);
      });

      const results = await Promise.allSettled(
        Array.from({ length: requestCount }, (_, i) =>
          handler.processWebPage(`https://resilience-test${i}.com`)
        )
      );

      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      // Should have roughly 2/3 success rate based on our failure pattern
      expect(successes).toBeGreaterThan(requestCount * 0.5);
      expect(failures).toBeGreaterThan(requestCount * 0.2);

      // Verify error handling quality
      const rejectedResults = results.filter(r => r.status === 'rejected') as PromiseRejectedResult[];
      rejectedResults.forEach(rejection => {
        expect(rejection.reason).toBeInstanceOf(MultimodalInputError);
        expect(rejection.reason.code).toMatch(/FETCH_ERROR|WEB_PAGE_PROCESSING_ERROR/);
      });

      console.log(`Resilience test: ${successes}/${requestCount} succeeded, ${failures} failed gracefully`);
    });

    it('should handle timeout cascades without system instability', async () => {
      const timeoutRequests = 30;
      const shortTimeout = 100; // Very short timeout

      mockWebFetchExecute.mockImplementation(() =>
        // Always return requests that exceed the timeout
        simulateVariableDelay(200, 400)
      );

      const startTime = Date.now();

      const results = await Promise.allSettled(
        Array.from({ length: timeoutRequests }, (_, i) =>
          handler.processWebPage(`https://timeout-test${i}.com`, { timeout: shortTimeout })
        )
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // All should fail due to timeout
      expect(results.every(r => r.status === 'rejected')).toBe(true);

      // Should not take much longer than the timeout period
      expect(totalTime).toBeLessThan(shortTimeout * 2);

      // Verify all failures are timeout-related
      const rejectedResults = results as PromiseRejectedResult[];
      rejectedResults.forEach(rejection => {
        expect(rejection.reason).toBeInstanceOf(MultimodalInputError);
      });

      console.log(`${timeoutRequests} timeout failures handled in ${totalTime}ms`);
    });

    it('should maintain performance during error surge conditions', async () => {
      const surgeRequests = 75;
      const errorRate = 0.7; // 70% error rate

      mockWebFetchExecute.mockImplementation(() => {
        const shouldError = Math.random() < errorRate;

        if (shouldError) {
          return Promise.resolve({
            success: false,
            error: 'Surge condition error',
            metadata: {
              url: 'https://example.com',
              method: 'GET',
              responseTime: 50,
            },
          });
        }

        return simulateVariableDelay(10, 100);
      });

      const startTime = Date.now();

      const results = await Promise.allSettled(
        Array.from({ length: surgeRequests }, (_, i) =>
          handler.processWebPage(`https://surge-test${i}.com`)
        )
      );

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      const successes = results.filter(r => r.status === 'fulfilled').length;
      const failures = results.filter(r => r.status === 'rejected').length;

      expect(successes + failures).toBe(surgeRequests);

      // Even under high error conditions, should complete reasonably quickly
      expect(totalTime).toBeLessThan(3000);

      console.log(`Error surge test: ${successes} success, ${failures} errors in ${totalTime}ms`);
    });
  });

  describe('resource exhaustion tests', () => {
    it('should handle URL variations without resource leaks', async () => {
      const urlVariations = [
        'https://example.com',
        'https://example.com/',
        'https://example.com/path',
        'https://example.com/path/',
        'https://example.com/path?query=1',
        'https://example.com/path?query=1&param=2',
        'https://example.com/path#fragment',
        'https://example.com/path?query=1#fragment',
        'https://subdomain.example.com',
        'https://another-subdomain.example.com/deep/path',
      ];

      mockWebFetchExecute.mockResolvedValue(createMockResponse());

      // Process each variation multiple times
      const iterations = 10;
      const allPromises = [];

      for (let i = 0; i < iterations; i++) {
        for (const url of urlVariations) {
          allPromises.push(handler.processWebPage(`${url}?iteration=${i}`));
        }
      }

      const results = await Promise.all(allPromises);

      expect(results).toHaveLength(urlVariations.length * iterations);
      results.forEach(result => {
        expect(result.statusCode).toBe(200);
      });

      console.log(`Processed ${results.length} URL variations successfully`);
    });

    it('should handle various content types under stress', async () => {
      const contentTypes = [
        { type: 'text/html', data: '<html><body><h1>HTML Content</h1></body></html>' },
        { type: 'application/json', data: '{"message": "JSON content", "timestamp": 1234567890}' },
        { type: 'text/plain', data: 'Plain text content for testing' },
        { type: 'text/xml', data: '<?xml version="1.0"?><root><item>XML content</item></root>' },
        { type: 'text/markdown', data: '# Markdown Content\n\nThis is **bold** and *italic*.' },
      ];

      const requestsPerType = 15;
      const allPromises = [];

      contentTypes.forEach((contentType, typeIndex) => {
        for (let i = 0; i < requestsPerType; i++) {
          mockWebFetchExecute.mockResolvedValueOnce(
            createMockResponse({
              headers: { 'content-type': contentType.type },
              data: contentType.data,
              metadata: {
                url: `https://content-type-test${typeIndex}-${i}.com`,
                method: 'GET',
                responseTime: 50 + Math.random() * 100,
                contentLength: contentType.data.length,
                contentType: contentType.type,
              },
            })
          );

          allPromises.push(
            handler.processWebPage(`https://content-type-test${typeIndex}-${i}.com`)
          );
        }
      });

      const results = await Promise.all(allPromises);

      expect(results).toHaveLength(contentTypes.length * requestsPerType);
      results.forEach((result, index) => {
        expect(result.statusCode).toBe(200);
        expect(result.markdown).toBeDefined();
      });

      console.log(`Processed ${results.length} requests with various content types`);
    });
  });

  describe('performance degradation tests', () => {
    it('should maintain consistent performance under sustained load', async () => {
      const loadDuration = 5000; // 5 seconds
      const batchSize = 10;
      const batchInterval = 200; // 200ms between batches

      mockWebFetchExecute.mockImplementation(() =>
        simulateVariableDelay(20, 100)
      );

      const startTime = Date.now();
      const performanceMetrics = [];
      let totalProcessed = 0;

      while (Date.now() - startTime < loadDuration) {
        const batchStartTime = Date.now();

        const batchPromises = Array.from({ length: batchSize }, (_, i) =>
          handler.processWebPage(`https://sustained-load${totalProcessed + i}.com`)
        );

        const batchResults = await Promise.all(batchPromises);
        const batchEndTime = Date.now();

        const batchDuration = batchEndTime - batchStartTime;
        performanceMetrics.push({
          batchNumber: performanceMetrics.length + 1,
          batchDuration,
          throughput: batchSize / (batchDuration / 1000), // requests per second
        });

        totalProcessed += batchSize;

        expect(batchResults).toHaveLength(batchSize);
        batchResults.forEach(result => {
          expect(result.statusCode).toBe(200);
        });

        // Wait before next batch (if there's time remaining)
        if (Date.now() - startTime < loadDuration - batchInterval) {
          await new Promise(resolve => setTimeout(resolve, batchInterval));
        }
      }

      const totalTime = Date.now() - startTime;

      // Analyze performance consistency
      const throughputs = performanceMetrics.map(m => m.throughput);
      const avgThroughput = throughputs.reduce((a, b) => a + b, 0) / throughputs.length;
      const maxThroughput = Math.max(...throughputs);
      const minThroughput = Math.min(...throughputs);

      // Performance should not degrade significantly over time
      const performanceVariation = (maxThroughput - minThroughput) / avgThroughput;
      expect(performanceVariation).toBeLessThan(0.5); // Less than 50% variation

      console.log(`Sustained load test: ${totalProcessed} requests in ${totalTime}ms`);
      console.log(`Average throughput: ${avgThroughput.toFixed(2)} req/sec`);
      console.log(`Performance variation: ${(performanceVariation * 100).toFixed(1)}%`);
    });
  });
});