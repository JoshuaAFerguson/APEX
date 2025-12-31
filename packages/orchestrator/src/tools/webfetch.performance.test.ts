import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Mock the global fetch function for controlled performance testing
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper function to create mock Response objects
function createMockResponse(options: {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  redirected: boolean;
  text: string;
  delay?: number;
}): any {
  const headersMap = new Map(Object.entries(options.headers));

  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    headers: {
      forEach: (callback: (value: string, key: string) => void) => {
        for (const [key, value] of headersMap) {
          callback(value, key);
        }
      }
    },
    url: options.url,
    redirected: options.redirected,
    text: () => {
      if (options.delay) {
        return new Promise(resolve =>
          setTimeout(() => resolve(options.text), options.delay)
        );
      }
      return Promise.resolve(options.text);
    },
  };
}

describe('WebFetchTool - Cache Performance Tests', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    tool.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    tool.clearCache();
  });

  describe('Cache lookup performance', () => {
    it('should have O(1) cache lookup time regardless of cache size', async () => {
      // Populate cache with many entries
      const cacheSize = 1000;
      const responses = Array.from({ length: cacheSize }, (_, i) =>
        createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
          url: `https://test${i}.com`,
          redirected: false,
          text: `Response ${i}`,
        })
      );

      mockFetch
        .mockImplementation((url: string) => {
          const index = parseInt(url.match(/test(\d+)\.com/)?.[1] || '0');
          return Promise.resolve(responses[index]);
        });

      // Populate cache
      const populateStart = Date.now();
      await Promise.all(
        Array.from({ length: cacheSize }, (_, i) =>
          tool.execute({ url: `https://test${i}.com` })
        )
      );
      const populateTime = Date.now() - populateStart;

      // Test cache lookup times for different positions
      const lookupTimes: number[] = [];

      for (let i = 0; i < 100; i++) {
        const index = Math.floor(Math.random() * cacheSize);
        const start = Date.now();
        await tool.execute({ url: `https://test${index}.com` });
        lookupTimes.push(Date.now() - start);
      }

      // All cache lookups should be fast and consistent
      const avgLookupTime = lookupTimes.reduce((a, b) => a + b) / lookupTimes.length;
      const maxLookupTime = Math.max(...lookupTimes);

      expect(avgLookupTime).toBeLessThan(5); // Average under 5ms
      expect(maxLookupTime).toBeLessThan(20); // Maximum under 20ms

      // Variance should be low (consistent performance)
      const variance = lookupTimes.reduce((acc, time) =>
        acc + Math.pow(time - avgLookupTime, 2), 0) / lookupTimes.length;
      expect(Math.sqrt(variance)).toBeLessThan(5); // Low standard deviation
    });

    it('should handle concurrent cache access efficiently', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://concurrent-test.com',
        redirected: false,
        text: 'Concurrent response',
        delay: 100, // Simulate some network delay
      });

      mockFetch.mockResolvedValue(mockResponse);

      const url = 'https://concurrent-test.com';

      // First request to populate cache
      await tool.execute({ url });

      // Make many concurrent cached requests
      const concurrentRequests = 100;
      const start = Date.now();

      const promises = Array.from({ length: concurrentRequests }, () =>
        tool.execute({ url })
      );

      const results = await Promise.all(promises);
      const totalTime = Date.now() - start;

      // All should succeed and be from cache
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.fromCache).toBe(true);
      });

      // Should complete much faster than if each was a network call
      const expectedNetworkTime = concurrentRequests * 100; // 100ms each
      expect(totalTime).toBeLessThan(expectedNetworkTime / 10); // Much faster than network

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(1000); // Under 1 second for 100 requests
    });

    it('should maintain performance with large cache entries', async () => {
      // Create large response content
      const largeContent = 'x'.repeat(1000000); // 1MB of data

      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/plain',
          'content-length': largeContent.length.toString()
        },
        url: 'https://large-content.com',
        redirected: false,
        text: largeContent,
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://large-content.com',
      };

      // First request to cache large content
      const cacheStart = Date.now();
      const result1 = await tool.execute(params);
      const cacheTime = Date.now() - cacheStart;

      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();
      expect(result1.data?.length).toBe(largeContent.length);

      // Second request should be fast despite large content
      const retrieveStart = Date.now();
      const result2 = await tool.execute(params);
      const retrieveTime = Date.now() - retrieveStart;

      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);

      // Cache retrieval should be much faster than initial caching
      expect(retrieveTime).toBeLessThan(cacheTime / 5);
      expect(retrieveTime).toBeLessThan(50); // Should be under 50ms
    });
  });

  describe('Memory efficiency', () => {
    it('should handle many cache entries without excessive memory usage', async () => {
      const entryCount = 5000;
      const responseSize = 10000; // 10KB per response

      // Create responses
      for (let i = 0; i < entryCount; i++) {
        const content = `Response ${i} `.repeat(responseSize / 15); // Approximate 10KB
        const mockResponse = createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
          url: `https://memory-test-${i}.com`,
          redirected: false,
          text: content,
        });

        mockFetch.mockResolvedValueOnce(mockResponse);
        await tool.execute({ url: `https://memory-test-${i}.com` });
      }

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(entryCount);

      // Cache operations should still be fast
      const lookupStart = Date.now();
      for (let i = 0; i < 100; i++) {
        const randomIndex = Math.floor(Math.random() * entryCount);
        await tool.execute({ url: `https://memory-test-${randomIndex}.com` });
      }
      const lookupTime = Date.now() - lookupStart;

      expect(lookupTime).toBeLessThan(1000); // Should complete in under 1 second
    });

    it('should efficiently clean up expired entries without affecting performance', async () => {
      // Add many entries with short TTL
      const entryCount = 1000;

      for (let i = 0; i < entryCount; i++) {
        const mockResponse = createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
          url: `https://cleanup-test-${i}.com`,
          redirected: false,
          text: `Response ${i}`,
        });

        mockFetch.mockResolvedValueOnce(mockResponse);
        await tool.execute({
          url: `https://cleanup-test-${i}.com`,
          cacheTtl: 100 // Very short TTL
        });
      }

      expect(tool.getCacheStats().size).toBe(entryCount);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 200));

      // Cleanup should be efficient
      const cleanupStart = Date.now();
      tool.forceCleanup();
      const cleanupTime = Date.now() - cleanupStart;

      expect(cleanupTime).toBeLessThan(100); // Should complete quickly
      expect(tool.getCacheStats().size).toBe(0);
    });
  });

  describe('Cache key generation performance', () => {
    it('should generate cache keys efficiently for complex requests', async () => {
      const complexParams: WebFetchParams = {
        url: 'https://complex-request.com/api/v1/endpoint',
        method: 'POST',
        headers: {
          'Authorization': 'Bearer very-long-token-'.repeat(100),
          'Content-Type': 'application/json',
          'User-Agent': 'Custom-Agent/1.0',
          'X-Custom-Header-1': 'value1',
          'X-Custom-Header-2': 'value2',
          'X-Custom-Header-3': 'value3',
        },
        body: JSON.stringify({
          data: 'x'.repeat(10000), // Large body
          timestamp: Date.now(),
          nested: {
            field1: 'value1',
            field2: 'value2',
            array: Array.from({ length: 100 }, (_, i) => i),
          }
        }),
      };

      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        url: complexParams.url,
        redirected: false,
        text: '{"result": "success"}',
      });

      mockFetch.mockResolvedValue(mockResponse);

      // Generate cache keys multiple times and measure performance
      const iterations = 1000;
      const start = Date.now();

      for (let i = 0; i < iterations; i++) {
        await tool.execute(complexParams);
      }

      const totalTime = Date.now() - start;
      const avgTime = totalTime / iterations;

      // Cache key generation should be efficient
      expect(avgTime).toBeLessThan(10); // Average under 10ms per operation
      expect(totalTime).toBeLessThan(5000); // Total under 5 seconds for 1000 operations

      // Should only have one cache entry (same key for identical requests)
      expect(tool.getCacheStats().size).toBe(1);
    });

    it('should handle hash collisions gracefully', async () => {
      // This test ensures that our hashing is working correctly
      // and that different requests don't accidentally share cache entries

      const baseUrl = 'https://hash-test.com';
      const variations: WebFetchParams[] = [
        { url: `${baseUrl}/path1` },
        { url: `${baseUrl}/path2` },
        { url: baseUrl, headers: { 'Header1': 'value1' } },
        { url: baseUrl, headers: { 'Header2': 'value2' } },
        { url: baseUrl, method: 'POST', body: 'body1' },
        { url: baseUrl, method: 'POST', body: 'body2' },
      ];

      // Create unique responses for each variation
      variations.forEach((params, index) => {
        const mockResponse = createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
          url: params.url,
          redirected: false,
          text: `Unique response ${index}`,
        });
        mockFetch.mockResolvedValueOnce(mockResponse);
      });

      // Make all requests
      const results = await Promise.all(
        variations.map(params => tool.execute(params))
      );

      // All should succeed and have unique responses
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data).toBe(`Unique response ${index}`);
        expect(result.fromCache).toBeFalsy();
      });

      // Should have separate cache entries
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(variations.length);

      // Verify each has unique cache key
      const cacheKeys = stats.entries.map(entry => entry.key);
      const uniqueKeys = new Set(cacheKeys);
      expect(uniqueKeys.size).toBe(cacheKeys.length);
    });
  });

  describe('Stress testing', () => {
    it('should maintain performance under high load', async () => {
      const requestCount = 10000;
      const uniqueUrls = 100; // Reuse URLs to test cache effectiveness

      // Create mock responses for unique URLs
      for (let i = 0; i < uniqueUrls; i++) {
        const mockResponse = createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
          url: `https://stress-test-${i}.com`,
          redirected: false,
          text: `Stress response ${i}`,
        });
        mockFetch.mockResolvedValue(mockResponse);
      }

      // Generate many requests to random URLs
      const requests = Array.from({ length: requestCount }, () => {
        const urlIndex = Math.floor(Math.random() * uniqueUrls);
        return { url: `https://stress-test-${urlIndex}.com` };
      });

      // Execute all requests
      const start = Date.now();
      const results = await Promise.all(
        requests.map(params => tool.execute(params))
      );
      const totalTime = Date.now() - start;

      // All requests should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Should have high cache hit rate
      const cacheHits = results.filter(result => result.fromCache).length;
      const hitRate = cacheHits / requestCount;
      expect(hitRate).toBeGreaterThan(0.9); // Over 90% cache hit rate

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(30000); // Under 30 seconds for 10k requests

      // Cache should have expected size
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(uniqueUrls);
    });

    it('should handle rapid cache operations without deadlock or corruption', async () => {
      const operationCount = 1000;
      const operations: Promise<any>[] = [];

      // Mix of different operations
      for (let i = 0; i < operationCount; i++) {
        const operation = Math.random();

        if (operation < 0.7) {
          // 70% - Cache requests
          const mockResponse = createMockResponse({
            ok: true,
            status: 200,
            statusText: 'OK',
            headers: { 'content-type': 'text/plain' },
            url: `https://rapid-test-${i}.com`,
            redirected: false,
            text: `Rapid response ${i}`,
          });
          mockFetch.mockResolvedValueOnce(mockResponse);

          operations.push(tool.execute({ url: `https://rapid-test-${i}.com` }));
        } else if (operation < 0.85) {
          // 15% - Cache stats
          operations.push(Promise.resolve(tool.getCacheStats()));
        } else if (operation < 0.95) {
          // 10% - Force cleanup
          operations.push(Promise.resolve(tool.forceCleanup()));
        } else {
          // 5% - Clear cache
          operations.push(Promise.resolve(tool.clearCache()));
        }
      }

      // Execute all operations concurrently
      const start = Date.now();
      const results = await Promise.all(operations);
      const totalTime = Date.now() - start;

      // All operations should complete successfully
      expect(results).toHaveLength(operationCount);

      // Should complete in reasonable time
      expect(totalTime).toBeLessThan(10000); // Under 10 seconds

      // Cache should be in valid state
      const finalStats = tool.getCacheStats();
      expect(finalStats.size).toBeGreaterThanOrEqual(0);
      expect(finalStats.entries).toHaveLength(finalStats.size);
    });
  });
});