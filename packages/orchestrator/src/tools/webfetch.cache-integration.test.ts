import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Integration tests using real network calls (httpbin.org)
describe('WebFetchTool - Cache Integration Tests', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    tool.clearCache();
  });

  afterEach(() => {
    tool.clearCache();
  });

  describe('Real network caching scenarios', () => {
    it('should cache real GET requests and serve from cache', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get?cache_test=1',
        timeout: 10000,
      };

      // First request - should hit network
      const start1 = Date.now();
      const result1 = await tool.execute(params);
      const time1 = Date.now() - start1;

      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();
      expect(result1.metadata?.responseTime).toBeGreaterThan(0);

      // Verify request details in response
      if (result1.data) {
        const responseData = JSON.parse(result1.data);
        expect(responseData.args.cache_test).toBe('1');
        expect(responseData.headers['User-Agent']).toContain('APEX-Agent');
      }

      // Second request - should hit cache
      const start2 = Date.now();
      const result2 = await tool.execute(params);
      const time2 = Date.now() - start2;

      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.metadata?.responseTime).toBe(0);
      expect(result2.data).toBe(result1.data);

      // Cache hit should be much faster
      expect(time2).toBeLessThan(time1);
      expect(time2).toBeLessThan(50); // Cache access should be very fast

      // Verify cache stats
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].url).toBe(params.url);
    });

    it('should cache different URLs separately', async () => {
      const urls = [
        'https://httpbin.org/get?test=1',
        'https://httpbin.org/get?test=2',
        'https://httpbin.org/get?test=3',
      ];

      // Make requests to different URLs
      const results = await Promise.all(
        urls.map(url => tool.execute({ url, timeout: 10000 }))
      );

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.fromCache).toBeFalsy();
      });

      // Should have separate cache entries
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(3);

      // Second requests should hit cache
      const cachedResults = await Promise.all(
        urls.map(url => tool.execute({ url, timeout: 10000 }))
      );

      cachedResults.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.fromCache).toBe(true);
        expect(result.data).toBe(results[index].data);
      });
    });

    it('should cache requests with custom headers separately', async () => {
      const baseUrl = 'https://httpbin.org/headers';

      const params1: WebFetchParams = {
        url: baseUrl,
        headers: { 'X-Test-Header': 'value1' },
        timeout: 10000,
      };

      const params2: WebFetchParams = {
        url: baseUrl,
        headers: { 'X-Test-Header': 'value2' },
        timeout: 10000,
      };

      // Make requests with different headers
      const result1 = await tool.execute(params1);
      const result2 = await tool.execute(params2);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();
      expect(result2.fromCache).toBeFalsy();

      // Should have different responses due to different headers
      expect(result1.data).not.toBe(result2.data);

      // Should have separate cache entries
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(2);

      // Subsequent requests should hit cache
      const cachedResult1 = await tool.execute(params1);
      const cachedResult2 = await tool.execute(params2);

      expect(cachedResult1.fromCache).toBe(true);
      expect(cachedResult2.fromCache).toBe(true);
      expect(cachedResult1.data).toBe(result1.data);
      expect(cachedResult2.data).toBe(result2.data);
    });

    it('should handle POST requests with cache bypass', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      };

      // POST requests should work
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      if (result1.data) {
        const responseData = JSON.parse(result1.data);
        expect(responseData.json).toEqual({ test: 'data' });
      }

      // Second POST request should also work and be cached
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should bypass cache when requested', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/uuid', // Returns different UUID each time
        timeout: 10000,
      };

      // First request - cache it
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      // Second request with cache bypass
      const result2 = await tool.execute({ ...params, bypassCache: true });
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBeFalsy();

      // Should get different responses (different UUIDs)
      if (result1.data && result2.data) {
        const uuid1 = JSON.parse(result1.data).uuid;
        const uuid2 = JSON.parse(result2.data).uuid;
        expect(uuid1).not.toBe(uuid2);
      }
    });

    it('should handle HTML content caching with markdown conversion', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/html',
        convertToMarkdown: true,
        timeout: 10000,
      };

      // First request
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();
      expect(result1.metadata?.contentType).toContain('text/html');

      // Should be converted to markdown
      expect(result1.data).toBeDefined();
      expect(result1.data).not.toContain('<html>');
      expect(result1.data).not.toContain('<head>');

      // Second request should hit cache
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should handle error responses without caching them', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/status/404',
        timeout: 10000,
      };

      // First request - should get error
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(false);
      expect(result1.status).toBe(404);
      expect(result1.fromCache).toBeFalsy();

      // Should not be cached
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(0);

      // Second request should also hit network (not cached)
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(false);
      expect(result2.status).toBe(404);
      expect(result2.fromCache).toBeFalsy();
    });
  });

  describe('Cache expiration in real scenarios', () => {
    it('should expire cache entries after TTL and make fresh requests', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/uuid', // Returns different UUID each time
        cacheTtl: 1000, // 1 second TTL
        timeout: 10000,
      };

      // First request
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      // Immediate second request should hit cache
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);

      // Wait for TTL expiration
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Third request should miss cache and get fresh data
      const result3 = await tool.execute(params);
      expect(result3.success).toBe(true);
      expect(result3.fromCache).toBeFalsy();

      // Should get different UUID
      if (result1.data && result3.data) {
        const uuid1 = JSON.parse(result1.data).uuid;
        const uuid3 = JSON.parse(result3.data).uuid;
        expect(uuid1).not.toBe(uuid3);
      }
    });

    it('should handle mixed TTL scenarios correctly', async () => {
      const shortTtlParams: WebFetchParams = {
        url: 'https://httpbin.org/get?ttl=short',
        cacheTtl: 500, // 0.5 seconds
        timeout: 10000,
      };

      const longTtlParams: WebFetchParams = {
        url: 'https://httpbin.org/get?ttl=long',
        cacheTtl: 5000, // 5 seconds
        timeout: 10000,
      };

      // Make both requests
      await tool.execute(shortTtlParams);
      await tool.execute(longTtlParams);

      expect(tool.getCacheStats().size).toBe(2);

      // Wait for short TTL to expire
      await new Promise(resolve => setTimeout(resolve, 700));

      // Short TTL should be expired, long TTL should still be cached
      const shortResult = await tool.execute(shortTtlParams);
      const longResult = await tool.execute(longTtlParams);

      expect(shortResult.fromCache).toBeFalsy(); // Fresh request
      expect(longResult.fromCache).toBe(true);   // From cache
    });
  });

  describe('Performance characteristics', () => {
    it('should demonstrate significant performance improvement with caching', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/delay/0.5', // 500ms delay
        timeout: 10000,
      };

      // First request - network call
      const start1 = Date.now();
      const result1 = await tool.execute(params);
      const time1 = Date.now() - start1;

      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();
      expect(time1).toBeGreaterThan(400); // Should take at least 400ms due to delay

      // Second request - cache hit
      const start2 = Date.now();
      const result2 = await tool.execute(params);
      const time2 = Date.now() - start2;

      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(time2).toBeLessThan(50); // Cache should be much faster

      // Performance improvement should be significant
      const improvement = time1 / time2;
      expect(improvement).toBeGreaterThan(10); // At least 10x faster
    });

    it('should handle concurrent requests to same URL efficiently', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get?concurrent=test',
        timeout: 10000,
      };

      // Make multiple concurrent requests to same URL
      const startTime = Date.now();
      const promises = Array.from({ length: 5 }, () => tool.execute(params));
      const results = await Promise.all(promises);
      const totalTime = Date.now() - startTime;

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
      });

      // Only first request should be from network
      expect(results[0].fromCache).toBeFalsy();

      // Others might be from cache if first completes fast enough
      // But all should have same data
      const firstData = results[0].data;
      results.slice(1).forEach(result => {
        expect(result.data).toBe(firstData);
      });

      // Should only have one cache entry
      expect(tool.getCacheStats().size).toBe(1);

      // Total time should be reasonable (not 5x network time)
      expect(totalTime).toBeLessThan(10000); // Should complete within reasonable time
    });
  });

  describe('Cache management in real scenarios', () => {
    it('should provide accurate cache statistics after real operations', async () => {
      const urls = [
        'https://httpbin.org/get?stat=1',
        'https://httpbin.org/get?stat=2',
        'https://httpbin.org/json',
      ];

      // Make requests
      await Promise.all(
        urls.map(url => tool.execute({ url, timeout: 10000 }))
      );

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(3);
      expect(stats.entries).toHaveLength(3);

      stats.entries.forEach(entry => {
        expect(entry).toHaveProperty('key');
        expect(entry).toHaveProperty('createdAt');
        expect(entry).toHaveProperty('ttl');
        expect(entry).toHaveProperty('url');
        expect(entry.createdAt).toBeGreaterThan(Date.now() - 10000);
        expect(entry.ttl).toBe(900000); // Default TTL
      });
    });

    it('should remove specific cache entries correctly', async () => {
      const params1: WebFetchParams = {
        url: 'https://httpbin.org/get?remove=1',
        timeout: 10000,
      };

      const params2: WebFetchParams = {
        url: 'https://httpbin.org/get?remove=2',
        timeout: 10000,
      };

      // Cache two entries
      await tool.execute(params1);
      await tool.execute(params2);
      expect(tool.getCacheStats().size).toBe(2);

      // Remove specific entry
      const removed = tool.removeCacheEntry(params1);
      expect(removed).toBe(true);
      expect(tool.getCacheStats().size).toBe(1);

      // Verify correct entry was removed
      const remainingEntry = tool.getCacheStats().entries[0];
      expect(remainingEntry.url).toBe(params2.url);

      // Next request for removed entry should hit network
      const result = await tool.execute(params1);
      expect(result.fromCache).toBeFalsy();
    });

    it('should clear entire cache correctly', async () => {
      const urls = [
        'https://httpbin.org/get?clear=1',
        'https://httpbin.org/get?clear=2',
        'https://httpbin.org/json',
      ];

      // Populate cache
      await Promise.all(
        urls.map(url => tool.execute({ url, timeout: 10000 }))
      );

      expect(tool.getCacheStats().size).toBe(3);

      // Clear cache
      tool.clearCache();
      expect(tool.getCacheStats().size).toBe(0);

      // All subsequent requests should hit network
      const results = await Promise.all(
        urls.map(url => tool.execute({ url, timeout: 10000 }))
      );

      results.forEach(result => {
        expect(result.fromCache).toBeFalsy();
      });
    });
  });
});