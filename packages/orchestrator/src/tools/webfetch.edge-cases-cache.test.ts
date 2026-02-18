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

describe('WebFetchTool - Cache Edge Cases', () => {
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

  describe('Boundary conditions', () => {
    it('should handle zero TTL correctly (no caching)', async () => {
      const mockResponse1 = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Response 1',
      });

      const mockResponse2 = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Response 2',
      });

      mockFetch
        .mockResolvedValueOnce(mockResponse1)
        .mockResolvedValueOnce(mockResponse2);

      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: 0, // Zero TTL
      };

      // First request
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.data).toBe('Response 1');
      expect(result1.fromCache).toBeFalsy();

      // Cache should be empty with zero TTL
      expect(tool.getCacheStats().size).toBe(0);

      // Second request should also hit network
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.data).toBe('Response 2');
      expect(result2.fromCache).toBeFalsy();

      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should handle very long TTL correctly', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Long TTL response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const veryLongTtl = 365 * 24 * 60 * 60 * 1000; // 1 year in milliseconds
      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: veryLongTtl,
      };

      // First request
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      // Should be cached with very long TTL
      const stats = tool.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].ttl).toBe(veryLongTtl);

      // Second request should hit cache
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle maximum safe integer TTL', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Max TTL response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        cacheTtl: Number.MAX_SAFE_INTEGER,
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(true);
      expect(result.fromCache).toBeFalsy();

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(1);
      expect(stats.entries[0].ttl).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('Unusual data handling', () => {
    it('should handle empty response body correctly', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 204, // No Content
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

      // First request
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.data).toBe('');
      expect(result1.fromCache).toBeFalsy();

      // Should be cached
      expect(tool.getCacheStats().size).toBe(1);

      // Second request should hit cache
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.data).toBe('');
      expect(result2.fromCache).toBe(true);

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should handle responses with only whitespace', async () => {
      const whitespaceContent = '   \n\t  \r\n  ';
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: whitespaceContent,
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.data).toBe(whitespaceContent);
      expect(result1.fromCache).toBeFalsy();

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.data).toBe(whitespaceContent);
      expect(result2.fromCache).toBe(true);
    });

    it('should handle binary-like content correctly', async () => {
      const binaryContent = '\x00\x01\x02\xFF\xFE\xFD';
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/octet-stream' },
        url: 'https://test.com',
        redirected: false,
        text: binaryContent,
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.data).toBe(binaryContent);
      expect(result1.fromCache).toBeFalsy();

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.data).toBe(binaryContent);
      expect(result2.fromCache).toBe(true);
    });

    it('should handle very large responses', async () => {
      const largeContent = 'x'.repeat(10 * 1024 * 1024); // 10MB
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/plain',
          'content-length': largeContent.length.toString()
        },
        url: 'https://test.com',
        redirected: false,
        text: largeContent,
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.data?.length).toBe(largeContent.length);
      expect(result1.fromCache).toBeFalsy();

      // Should be cached despite size
      expect(tool.getCacheStats().size).toBe(1);

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.data).toBe(result1.data);
      expect(result2.fromCache).toBe(true);
    });
  });

  describe('URL and parameter edge cases', () => {
    it('should handle URLs with special characters correctly', async () => {
      const specialUrl = 'https://test.com/path with spaces?param=value with spaces&special=!@#$%^&*()';
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: specialUrl,
        redirected: false,
        text: 'Special URL response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: specialUrl,
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should handle URLs with Unicode characters', async () => {
      const unicodeUrl = 'https://test.com/café/résumé?param=naïve&emoji=🚀';
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: unicodeUrl,
        redirected: false,
        text: 'Unicode URL response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: unicodeUrl,
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should handle extremely long URLs', async () => {
      const longPath = 'segment/'.repeat(1000);
      const longUrl = `https://test.com/${longPath}?param=value`;

      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: longUrl,
        redirected: false,
        text: 'Long URL response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: longUrl,
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should distinguish between similar URLs', async () => {
      const urls = [
        'https://test.com/path',
        'https://test.com/Path', // Different case
        'https://test.com/path/',
        'https://test.com/path?',
        'https://test.com/path#',
        'https://TEST.COM/path', // Different domain case
      ];

      // Create unique responses for each URL
      urls.forEach((url, index) => {
        const mockResponse = createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
          url,
          redirected: false,
          text: `Response for URL ${index}`,
        });
        mockFetch.mockResolvedValueOnce(mockResponse);
      });

      // Make requests to all URLs
      const results = await Promise.all(
        urls.map(url => tool.execute({ url }))
      );

      // All should succeed and be unique
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.data).toBe(`Response for URL ${index}`);
        expect(result.fromCache).toBeFalsy();
      });

      // Should have separate cache entries
      expect(tool.getCacheStats().size).toBe(urls.length);
    });
  });

  describe('Header edge cases', () => {
    it('should handle headers with special characters', async () => {
      const specialHeaders = {
        'X-Special-Chars': '!@#$%^&*()_+-=[]{}|;:,.<>?',
        'X-Unicode-Header': 'café résumé naïve 🚀',
        'X-Quoted-Value': '"quoted value"',
        'X-Empty-Value': '',
        'X-Whitespace': '  spaces  ',
      };

      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Special headers response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        headers: specialHeaders,
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should handle very large header values', async () => {
      const largeHeaderValue = 'x'.repeat(100000); // 100KB header value
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Large headers response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        headers: {
          'X-Large-Header': largeHeaderValue,
        },
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should handle headers with different ordering', async () => {
      const headers1 = {
        'Header-A': 'value-a',
        'Header-B': 'value-b',
        'Header-C': 'value-c',
      };

      const headers2 = {
        'Header-C': 'value-c',
        'Header-A': 'value-a',
        'Header-B': 'value-b',
      };

      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Header ordering response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      // First request with headers1 order
      const result1 = await tool.execute({
        url: 'https://test.com',
        headers: headers1,
      });

      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      // Second request with headers2 order (same content, different order)
      // Should hit cache because content is the same
      const result2 = await tool.execute({
        url: 'https://test.com',
        headers: headers2,
      });

      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });
  });

  describe('Body edge cases', () => {
    it('should handle very large request bodies', async () => {
      const largeBody = 'x'.repeat(10 * 1024 * 1024); // 10MB body
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Large body response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        method: 'POST',
        body: largeBody,
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });

    it('should handle bodies with special characters and encoding', async () => {
      const specialBody = JSON.stringify({
        unicode: 'café résumé naïve 🚀',
        binary: '\x00\x01\x02\xFF',
        escape: '\\n\\t\\r\\"',
        html: '<script>alert("xss")</script>',
        json: { nested: { deep: true } },
      });

      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        url: 'https://test.com',
        redirected: false,
        text: 'Special body response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
        method: 'POST',
        body: specialBody,
        headers: { 'Content-Type': 'application/json' },
      };

      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();

      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.data).toBe(result1.data);
    });
  });

  describe('Cache corruption prevention', () => {
    it('should handle concurrent modifications safely', async () => {
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test.com',
        redirected: false,
        text: 'Concurrent test response',
      });

      mockFetch.mockResolvedValue(mockResponse);

      const params: WebFetchParams = {
        url: 'https://test.com',
      };

      // Perform concurrent operations that modify cache
      const operations = [
        tool.execute(params),
        tool.execute(params),
        Promise.resolve(tool.clearCache()),
        tool.execute(params),
        Promise.resolve(tool.forceCleanup()),
        tool.execute(params),
        Promise.resolve(tool.removeCacheEntry(params)),
        tool.execute(params),
      ];

      const results = await Promise.all(operations);

      // Verify cache is in valid state
      const stats = tool.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(0);
      expect(stats.entries).toHaveLength(stats.size);

      // All execute operations should succeed
      const executeResults = results.filter(
        result => result && typeof result === 'object' && 'success' in result
      );
      executeResults.forEach(result => {
        expect(result.success).toBe(true);
      });
    });

    it('should maintain cache integrity after errors', async () => {
      // Add some valid cache entries
      const mockResponse = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://valid.com',
        redirected: false,
        text: 'Valid response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse);
      await tool.execute({ url: 'https://valid.com' });

      expect(tool.getCacheStats().size).toBe(1);

      // Try to corrupt cache by directly manipulating internal state
      try {
        // Access private cache and add invalid entry
        const cache = (tool as any).cache;
        cache.set('invalid-key', 'invalid-value');
      } catch (error) {
        // This might throw, which is fine
      }

      // Cache operations should still work
      const stats = tool.getCacheStats();
      expect(stats.size).toBeGreaterThanOrEqual(1);

      // Should be able to make new requests
      const mockResponse2 = createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://test2.com',
        redirected: false,
        text: 'New response',
      });

      mockFetch.mockResolvedValueOnce(mockResponse2);
      const result = await tool.execute({ url: 'https://test2.com' });
      expect(result.success).toBe(true);
    });
  });
});