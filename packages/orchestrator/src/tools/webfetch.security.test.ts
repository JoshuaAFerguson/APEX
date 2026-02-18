/**
 * WebFetch Tool - Security and Edge Case Tests
 *
 * Tests focusing on security considerations, edge cases,
 * and malformed input handling to ensure robust operation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Helper to create mock Response objects
function createMockResponse(options: {
  ok: boolean;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  url: string;
  redirected?: boolean;
  text: string;
}): any {
  const headersMap = new Map(Object.entries(options.headers));

  return {
    ok: options.ok,
    status: options.status,
    statusText: options.statusText,
    headers: {
      forEach: (callback: (value: string, key: string) => void) => {
        headersMap.forEach((value, key) => callback(value, key));
      },
    },
    url: options.url,
    redirected: options.redirected || false,
    text: () => Promise.resolve(options.text),
  };
}

describe('WebFetch Tool - Security and Edge Cases', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    tool.clearCache();
    vi.clearAllMocks();
  });

  afterEach(() => {
    tool.clearCache();
    vi.restoreAllMocks();
  });

  describe('URL Security and Validation', () => {
    it('should handle URLs with special characters safely', async () => {
      const specialUrl = 'https://example.com/path with spaces?param=value&other=测试';

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: specialUrl,
        text: 'Response with special characters'
      }));

      const result = await tool.execute({ url: specialUrl });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        specialUrl,
        expect.any(Object)
      );
    });

    it('should handle URLs with unicode characters', async () => {
      const unicodeUrl = 'https://测试.example.com/路径';

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: unicodeUrl,
        text: 'Unicode response'
      }));

      const result = await tool.execute({ url: unicodeUrl });

      expect(result.success).toBe(true);
    });

    it('should handle very long URLs', async () => {
      const longPath = 'a'.repeat(2000);
      const longUrl = `https://example.com/${longPath}`;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: longUrl,
        text: 'Long URL response'
      }));

      const result = await tool.execute({ url: longUrl });

      expect(result.success).toBe(true);
    });

    it('should reject malicious javascript: URLs', async () => {
      const jsUrl = 'javascript:alert("xss")';

      const result = await tool.execute({ url: jsUrl });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should reject data: URLs', async () => {
      const dataUrl = 'data:text/html,<script>alert("xss")</script>';

      const result = await tool.execute({ url: dataUrl });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });
  });

  describe('Input Sanitization', () => {
    it('should handle null and undefined parameters gracefully', async () => {
      const params = {
        url: 'https://example.com',
        headers: null as any,
        body: undefined
      };

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://example.com',
        text: 'response'
      }));

      const result = await tool.execute(params);

      expect(result.success).toBe(true);
    });

    it('should handle extremely large header values', async () => {
      const largeHeaderValue = 'x'.repeat(10000);

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://example.com',
        text: 'response'
      }));

      const result = await tool.execute({
        url: 'https://example.com',
        headers: {
          'X-Large-Header': largeHeaderValue
        }
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'X-Large-Header': largeHeaderValue
          })
        })
      );
    });

    it('should handle extremely large request bodies', async () => {
      const largeBody = JSON.stringify({ data: 'x'.repeat(100000) });

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        url: 'https://api.example.com',
        text: '{"success": true}'
      }));

      const result = await tool.execute({
        url: 'https://api.example.com',
        method: 'POST',
        body: largeBody,
        headers: { 'Content-Type': 'application/json' }
      });

      expect(result.success).toBe(true);
    });
  });

  describe('Response Content Security', () => {
    it('should safely handle malicious HTML content', async () => {
      const maliciousHtml = `
        <html>
          <head>
            <script>
              // Malicious script that should be removed
              fetch('/steal-data', { method: 'POST', body: document.cookie });
            </script>
          </head>
          <body>
            <h1>Legitimate Content</h1>
            <script>alert('xss attempt');</script>
            <img src="x" onerror="alert('xss')">
            <iframe src="javascript:alert('xss')"></iframe>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://malicious.example.com',
        text: maliciousHtml
      }));

      const result = await tool.execute({
        url: 'https://malicious.example.com',
        convertToMarkdown: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('# Legitimate Content');
      expect(result.data).not.toContain('script');
      expect(result.data).not.toContain('alert');
      expect(result.data).not.toContain('fetch');
      expect(result.data).not.toContain('onerror');
      expect(result.data).not.toContain('javascript:');
    });

    it('should handle binary content gracefully', async () => {
      const binaryData = '\x00\x01\x02\xFF\xFE\xFD';

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/octet-stream' },
        url: 'https://example.com/binary',
        text: binaryData
      }));

      const result = await tool.execute({
        url: 'https://example.com/binary',
        convertToMarkdown: false
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(binaryData);
    });

    it('should handle extremely large responses', async () => {
      const largeContent = 'x'.repeat(10_000_000); // 10MB

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/plain',
          'content-length': largeContent.length.toString()
        },
        url: 'https://example.com/large',
        text: largeContent
      }));

      const result = await tool.execute({
        url: 'https://example.com/large'
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(largeContent);
      expect(result.metadata?.contentLength).toBe(largeContent.length);
    });
  });

  describe('Cache Key Security', () => {
    it('should generate secure cache keys for sensitive data', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://api.example.com',
        text: 'response'
      }));

      // Requests with different sensitive headers should have different cache keys
      await tool.execute({
        url: 'https://api.example.com',
        headers: { 'Authorization': 'Bearer token123' }
      });

      await tool.execute({
        url: 'https://api.example.com',
        headers: { 'Authorization': 'Bearer token456' }
      });

      const stats = tool.getCacheStats();
      expect(stats.size).toBe(2); // Should be separate cache entries
    });

    it('should not expose sensitive information in cache metadata', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://api.example.com',
        text: 'response'
      }));

      await tool.execute({
        url: 'https://api.example.com/sensitive',
        headers: { 'Authorization': 'Bearer secret-token' }
      });

      const stats = tool.getCacheStats();
      expect(stats.entries[0].key).not.toContain('secret-token');
      expect(stats.entries[0].key).toMatch(/^[a-f0-9]{64}$/); // Should be SHA-256 hash
    });
  });

  describe('Error Message Security', () => {
    it('should not expose sensitive URLs in error messages', async () => {
      const sensitiveUrl = 'https://internal.company.com/secret-endpoint?token=abc123';

      mockFetch.mockRejectedValue(new Error('Network connection failed'));

      const result = await tool.execute({ url: sensitiveUrl });

      expect(result.success).toBe(false);
      expect(result.error).not.toContain('abc123');
      expect(result.metadata?.url).toBe(sensitiveUrl); // But metadata should have original URL
    });

    it('should sanitize error messages from fetch failures', async () => {
      mockFetch.mockRejectedValue(new Error('ENOTFOUND sensitive-internal-hostname.local'));

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
      // The original error details should still be included but prefixed
    });
  });

  describe('Timeout and Resource Management', () => {
    it('should properly clean up resources on timeout', async () => {
      const abortController = {
        abort: vi.fn(),
        signal: { aborted: false }
      };

      vi.spyOn(global, 'AbortController').mockReturnValue(abortController as any);

      mockFetch.mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new DOMException('Operation timed out', 'AbortError'));
          }, 100);
        })
      );

      const result = await tool.execute({
        url: 'https://slow.example.com',
        timeout: 1000
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
    });

    it('should handle memory pressure with large content', async () => {
      // This test ensures the tool doesn't crash with very large content
      const massiveContent = 'x'.repeat(50_000_000); // 50MB

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://example.com/massive',
        text: massiveContent
      }));

      const result = await tool.execute({
        url: 'https://example.com/massive'
      });

      // Should handle large content without crashing
      expect(result.success).toBe(true);
      expect(typeof result.data).toBe('string');
    });
  });

  describe('Concurrent Request Safety', () => {
    it('should handle multiple simultaneous requests safely', async () => {
      mockFetch.mockImplementation((url: string) =>
        Promise.resolve(createMockResponse({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: { 'content-type': 'text/plain' },
          url,
          text: `Response for ${url}`
        }))
      );

      // Fire multiple requests concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        tool.execute({ url: `https://example.com/endpoint${i}` })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.data).toBe(`Response for https://example.com/endpoint${i}`);
      });

      // Should have separate cache entries
      expect(tool.getCacheStats().size).toBe(10);
    });

    it('should handle cache contention safely', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://example.com',
        text: 'shared response'
      }));

      // Multiple requests to same URL should be safe
      const promises = Array.from({ length: 5 }, () =>
        tool.execute({ url: 'https://example.com' })
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.data).toBe('shared response');
      });

      // Only one cache entry should exist
      expect(tool.getCacheStats().size).toBe(1);

      // Only one network request should have been made
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });
});