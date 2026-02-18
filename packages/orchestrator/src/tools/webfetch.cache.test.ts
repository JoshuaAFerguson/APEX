import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Mock the global fetch function
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
    text: () => Promise.resolve(options.text),
  };
}

describe('WebFetchTool - Cache Functionality', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    vi.clearAllMocks();

    // Clear any existing cache
    tool.clearCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    tool.clearCache();
  });

  describe('Basic cache functionality', () => {
    it('should cache successful GET requests by default', async () => {
      const mockResponseText = 'Cached response';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/plain',
          'content-length': mockResponseText.length.toString(),
        },
        url: 'https://test.com',
        redirected: false,
        text: mockResponseText,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      // First request should hit the network
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.data).toBe(mockResponseText);
      expect(result1.fromCache).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second identical request should hit the cache
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.data).toBe(mockResponseText);
      expect(result2.fromCache).toBe(true);
      expect(result2.metadata?.responseTime).toBe(0); // Cache hits have zero response time
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional network call
    });

    it('should cache with different TTL values', async () => {
      const mockResponseText = 'TTL test response';

      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/plain',
        },
        url: 'https://test.com',
        redirected: false,
        text: mockResponseText,
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: 5000, // 5 seconds
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(true);
      expect(result.fromCache).toBeFalsy();

      // Check cache stats
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].ttl).toBe(5000);
    });

    it('should bypass cache when bypassCache is true', async () => {
      const mockResponseText1 = 'First response';
      const mockResponseText2 = 'Second response';

      mockFetch
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
          url: 'https://test.com',
          redirected: false,
          text: mockResponseText1,
        }))
        .mockResolvedValueOnce(createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
          url: 'https://test.com',
          redirected: false,
          text: mockResponseText2,
        }));

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      // First request (cached)
      const result1 = await tool.execute(params);
      expect(result1.data).toBe(mockResponseText1);
      expect(result1.fromCache).toBeFalsy();

      // Second request bypassing cache
      const result2 = await tool.execute({ ...params, bypassCache: true });
      expect(result2.data).toBe(mockResponseText2);
      expect(result2.fromCache).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not cache error responses', async () => {
      mockFetch.mockResolvedValueOnce(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Not Found',
      }));

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.status).toBe(404);

      // Check that nothing was cached
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(0);
    });
  });

  describe('Cache key generation', () => {
    it('should generate different cache keys for different URLs', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      // Make requests to different URLs
      await tool.execute({ url: 'https://test1.com' });
      await tool.execute({ url: 'https://test2.com' });

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries[0].key).not.toBe(stats.entries[1].key);
    });

    it('should generate different cache keys for different methods', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      // Make requests with different methods
      await tool.execute({ url: 'https://test.com', method: 'GET' });
      await tool.execute({ url: 'https://test.com', method: 'POST', body: '{}' });

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries[0].key).not.toBe(stats.entries[1].key);
    });

    it('should generate different cache keys for different headers', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      // Make requests with different headers
      await tool.execute({ url: 'https://test.com', headers: { 'Authorization': 'Bearer token1' } });
      await tool.execute({ url: 'https://test.com', headers: { 'Authorization': 'Bearer token2' } });

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries[0].key).not.toBe(stats.entries[1].key);
    });

    it('should generate same cache key for identical requests', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        headers: { 'Authorization': 'Bearer token' },
      };

      // First request
      await tool.execute(params);

      // Second identical request should use cache (only 1 entry)
      await tool.execute(params);

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(1);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('Cache expiration and cleanup', () => {
    it('should expire entries after TTL', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: 100, // 100ms
      };

      // First request
      const result1 = await tool.execute(params);
      expect(result1.fromCache).toBeFalsy();

      // Wait for TTL to expire
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second request should miss cache and make new network call
      const result2 = await tool.execute(params);
      expect(result2.fromCache).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clean up expired entries on demand', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: 100, // 100ms
      };

      await tool.execute(params);

      // Check entry exists
      let stats = tool.getCacheStats();
      expect(stats.size).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Force cleanup
      tool.forceCleanup();

      // Check entry was removed
      stats = tool.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should handle cache validation on access', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch
        .mockResolvedValueOnce(mockResponse)
        .mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: 100, // 100ms
      };

      // First request
      await tool.execute(params);

      let stats = tool.getCacheStats();
      expect(stats.size).toBe(1);

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Second request should remove expired entry and make new network call
      const result2 = await tool.execute(params);
      expect(result2.fromCache).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Cache should have new entry
      stats = tool.getCacheStats();
      expect(stats.size).toBe(1);
    });
  });

  describe('Cache management', () => {
    it('should provide cache statistics', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      await tool.execute({ url: 'https://test1.com' });
      await tool.execute({ url: 'https://test2.com', cacheTtl: 5000 });

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0]).toHaveProperty('key');
      expect(stats.entries[0]).toHaveProperty('createdAt');
      expect(stats.entries[0]).toHaveProperty('ttl');
      expect(stats.entries[0]).toHaveProperty('url');
    });

    it('should clear entire cache', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      await tool.execute({ url: 'https://test1.com' });
      await tool.execute({ url: 'https://test2.com' });

      let stats = tool.getCacheStats();
      expect(stats.size).toBe(2);

      tool.clearCache();

      stats = tool.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should remove specific cache entries', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      const params1: WebFetchParams = { url: 'https://test1.com' };
      const params2: WebFetchParams = { url: 'https://test2.com' };

      await tool.execute(params1);
      await tool.execute(params2);

      let stats = tool.getCacheStats();
      expect(stats.size).toBe(2);

      // Remove specific entry
      const removed = tool.removeCacheEntry(params1);
      expect(removed).toBe(true);

      stats = tool.getCacheStats();
      expect(stats.size).toBe(1);

      // Try to remove non-existent entry
      const notRemoved = tool.removeCacheEntry(params1);
      expect(notRemoved).toBe(false);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty response caching', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 204,
        statusText: 'No Content',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: '',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.data).toBe('');
      expect(result1.fromCache).toBeFalsy();

      // Second request should hit cache
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.data).toBe('');
      expect(result2.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle zero TTL (no caching)', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: 0,
      };

      await tool.execute(params);
      await tool.execute(params);

      // Both requests should hit network
      expect(mockFetch).toHaveBeenCalledTimes(2);

      // Cache should be empty
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(0);
    });

    it('should validate negative TTL', async () => {
      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: -1000,
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cache TTL cannot be negative');
    });

    it('should include cache key in metadata', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result = await tool.execute(params);
      expect(result.metadata?.cacheKey).toBeDefined();
      expect(typeof result.metadata?.cacheKey).toBe('string');
      expect(result.metadata?.cacheKey?.length).toBe(64); // SHA-256 hex length
    });
  });
});