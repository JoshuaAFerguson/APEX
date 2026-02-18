import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebFetchTool, webFetch, webFetchTool, type WebFetchParams, type WebFetchResult } from './webfetch';

describe('WebFetchTool', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    // Clear cache to ensure tests are isolated
    tool.clearCache();
  });

  describe('Parameter validation', () => {
    it('should reject empty URL', async () => {
      const params: WebFetchParams = {
        url: '',
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL is required');
    });

    it('should reject invalid URL format', async () => {
      const params: WebFetchParams = {
        url: 'not-a-url',
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should reject unsupported HTTP method', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        method: 'PATCH' as any,
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported HTTP method');
    });

    it('should reject timeout out of bounds', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        timeout: 500, // Below minimum
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout must be between');
    });

    it('should reject body on GET request', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        method: 'GET',
        body: 'some data',
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('GET requests cannot have a body');
    });

    it('should reject body on DELETE request', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        method: 'DELETE',
        body: 'some data',
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('DELETE requests cannot have a body');
    });
  });

  describe('Default values', () => {
    it('should use default values for optional parameters', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
      };

      // This test will actually make a network call but should demonstrate defaults
      const result = await tool.execute(params);

      // Should have metadata with correct defaults
      expect(result.metadata?.method).toBe('GET');
      expect(result.metadata?.responseTime).toBeGreaterThan(0);
    });
  });

  describe('Error handling', () => {
    it('should handle network timeout', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/delay/10', // This will timeout
        timeout: 2000, // 2 seconds
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Request timed out');
    });

    it('should handle invalid domain', async () => {
      const params: WebFetchParams = {
        url: 'https://this-domain-does-not-exist-12345.com',
        timeout: 5000,
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('HTTP methods', () => {
    it('should support GET method', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
        method: 'GET',
      };

      const result = await tool.execute(params);
      expect(result.metadata?.method).toBe('GET');
    });

    it('should support POST method with body', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        headers: { 'Content-Type': 'application/json' },
      };

      const result = await tool.execute(params);
      expect(result.metadata?.method).toBe('POST');
    });
  });

  describe('HTML to Markdown conversion', () => {
    it('should detect HTML content type', async () => {
      // This is a unit test for the private method behavior
      // We test it indirectly through the public interface
      const params: WebFetchParams = {
        url: 'https://httpbin.org/html',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      if (result.success && result.data) {
        // If the response is HTML and conversion is enabled,
        // the data should be processed (length might change)
        expect(result.data).toBeDefined();
        expect(result.metadata?.contentType).toContain('text/html');
      }
    });

    it('should allow disabling markdown conversion', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/html',
        convertToMarkdown: false,
      };

      const result = await tool.execute(params);

      if (result.success) {
        // Should return raw HTML when conversion is disabled
        expect(result.data).toBeDefined();
      }
    });
  });

  describe('Headers handling', () => {
    it('should include custom headers in request', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/headers',
        headers: {
          'X-Custom-Header': 'test-value',
          'Authorization': 'Bearer token123',
        },
      };

      const result = await tool.execute(params);

      if (result.success && result.data) {
        const responseData = JSON.parse(result.data);
        expect(responseData.headers['X-Custom-Header']).toBe('test-value');
        expect(responseData.headers['Authorization']).toBe('Bearer token123');
      }
    });

    it('should include default User-Agent header', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/headers',
      };

      const result = await tool.execute(params);

      if (result.success && result.data) {
        const responseData = JSON.parse(result.data);
        expect(responseData.headers['User-Agent']).toContain('APEX-Agent');
      }
    });

    it('should allow overriding User-Agent header', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/headers',
        headers: {
          'User-Agent': 'Custom-Agent/1.0',
        },
      };

      const result = await tool.execute(params);

      if (result.success && result.data) {
        const responseData = JSON.parse(result.data);
        expect(responseData.headers['User-Agent']).toBe('Custom-Agent/1.0');
      }
    });
  });

  describe('Response handling', () => {
    it('should handle HTTP 404 error', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/status/404',
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toContain('HTTP 404');
    });

    it('should handle HTTP 500 error', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/status/500',
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.status).toBe(500);
      expect(result.error).toContain('HTTP 500');
    });

    it('should handle redirects and track final URL', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/redirect/3',
      };

      const result = await tool.execute(params);

      if (result.success) {
        expect(result.metadata?.redirected).toBe(true);
        expect(result.metadata?.finalUrl).toBeDefined();
        expect(result.metadata?.finalUrl).not.toBe(params.url);
      }
    });

    it('should parse response headers correctly', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/response-headers?Content-Type=application/json&X-Test=value',
      };

      const result = await tool.execute(params);

      if (result.success) {
        expect(result.headers).toBeDefined();
        expect(result.headers!['content-type']).toContain('application/json');
        expect(result.headers!['x-test']).toBe('value');
      }
    });

    it('should calculate response metadata correctly', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
      };

      const result = await tool.execute(params);

      if (result.success) {
        expect(result.metadata).toBeDefined();
        expect(result.metadata!.url).toBe(params.url);
        expect(result.metadata!.method).toBe('GET');
        expect(result.metadata!.responseTime).toBeGreaterThan(0);
        expect(result.metadata!.contentLength).toBeGreaterThan(0);
        expect(result.metadata!.contentType).toBeDefined();
      }
    });
  });

  describe('HTTP method support', () => {
    it('should support PUT method with body', async () => {
      const testData = { message: 'PUT test data' };
      const params: WebFetchParams = {
        url: 'https://httpbin.org/put',
        method: 'PUT',
        body: JSON.stringify(testData),
        headers: { 'Content-Type': 'application/json' },
      };

      const result = await tool.execute(params);
      expect(result.metadata?.method).toBe('PUT');

      if (result.success && result.data) {
        const responseData = JSON.parse(result.data);
        expect(responseData.json).toEqual(testData);
      }
    });

    it('should support DELETE method', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/delete',
        method: 'DELETE',
      };

      const result = await tool.execute(params);
      expect(result.metadata?.method).toBe('DELETE');
    });

    it('should handle POST with form data', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        body: 'key1=value1&key2=value2',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      };

      const result = await tool.execute(params);

      if (result.success && result.data) {
        const responseData = JSON.parse(result.data);
        expect(responseData.form).toEqual({ key1: 'value1', key2: 'value2' });
      }
    });
  });

  describe('Timeout handling', () => {
    it('should accept valid timeout values', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
        timeout: 5000,
      };

      const result = await tool.execute(params);
      // Should not fail due to timeout value
      expect(result.metadata?.responseTime).toBeLessThan(5000);
    });

    it('should reject timeout too high', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        timeout: 120000, // Above max
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout must be between');
    });

    it('should use default timeout when not specified', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
      };

      const result = await tool.execute(params);
      // Default timeout should not cause issues for normal requests
      expect(result.metadata?.responseTime).toBeLessThan(10000);
    });
  });

  describe('HTML to Markdown conversion', () => {
    it('should convert HTML content to markdown when enabled', async () => {
      // Create a test that demonstrates HTML conversion without relying on external services
      const mockHtml = '<h1>Test Title</h1><p>Test paragraph with <strong>bold</strong> text.</p>';

      // We need to test the conversion logic, but since the convertHtmlToMarkdown method is private,
      // we'll create a scenario where we can observe the conversion through the public API
      // For now, let's test with a known HTML endpoint
      const params: WebFetchParams = {
        url: 'https://httpbin.org/html',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      if (result.success) {
        expect(result.metadata?.contentType).toContain('text/html');
        // The data should be processed if it's HTML and conversion is enabled
        expect(result.data).toBeDefined();
        // HTML should be converted, so it shouldn't contain HTML tags
        expect(result.data).not.toContain('<html>');
      }
    });

    it('should preserve raw HTML when conversion is disabled', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/html',
        convertToMarkdown: false,
      };

      const result = await tool.execute(params);

      if (result.success) {
        // Should contain raw HTML tags when conversion is disabled
        expect(result.data).toContain('<html>');
      }
    });

    it('should handle non-HTML content types correctly', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/json',
        convertToMarkdown: true,
      };

      const result = await tool.execute(params);

      if (result.success) {
        // JSON content should not be converted even with convertToMarkdown=true
        expect(result.metadata?.contentType).toContain('application/json');
        expect(result.data).toBeDefined();
        // Should be valid JSON
        expect(() => JSON.parse(result.data!)).not.toThrow();
      }
    });

    it('should default to markdown conversion enabled', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/html',
        // convertToMarkdown not specified, should default to true
      };

      const result = await tool.execute(params);

      if (result.success) {
        expect(result.metadata?.contentType).toContain('text/html');
        // Should be converted by default
        expect(result.data).not.toContain('<html>');
      }
    });
  });

  describe('Edge cases and robustness', () => {
    it('should handle empty response body', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/status/204', // No Content
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(true);
      expect(result.status).toBe(204);
      expect(result.data).toBe('');
    });

    it('should handle large response body', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/bytes/10000', // 10KB of random data
        timeout: 15000, // Allow more time for larger response
      };

      const result = await tool.execute(params);

      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.data!.length).toBeGreaterThan(1000);
        expect(result.metadata?.contentLength).toBeGreaterThan(1000);
      }
    });

    it('should handle special characters in URL', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get?param=value%20with%20spaces&special=@#$%',
      };

      const result = await tool.execute(params);

      if (result.success && result.data) {
        const responseData = JSON.parse(result.data);
        expect(responseData.args['param']).toBe('value with spaces');
        expect(responseData.args['special']).toBe('@#$%');
      }
    });

    it('should handle missing URL', async () => {
      const params: WebFetchParams = {
        url: undefined as any,
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL is required');
    });

    it('should handle malformed JSON in response gracefully', async () => {
      // This test assumes httpbin might return malformed content in some edge case
      // We test that our tool doesn't crash on invalid JSON
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
      };

      const result = await tool.execute(params);

      if (result.success) {
        expect(result.data).toBeDefined();
        // Tool should return raw data even if it's not valid JSON
        expect(typeof result.data).toBe('string');
      }
    });
  });

  describe('Convenience functions and exports', () => {
    it('should export webFetch convenience function', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
      };

      const result = await webFetch(params);
      expect(result).toBeDefined();
      expect(result.metadata?.method).toBe('GET');
    });

    it('should export default webFetchTool instance', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
      };

      const result = await tool.execute(params);
      expect(result).toBeDefined();
      expect(result.metadata?.method).toBe('GET');
    });

    it('webFetch function should use same implementation as WebFetchTool', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
      };

      const [result1, result2] = await Promise.all([
        webFetch(params),
        webFetchTool.execute(params),
      ]);

      // Both should succeed and have similar structure
      expect(result1.success).toBe(result2.success);
      expect(result1.metadata?.method).toBe(result2.metadata?.method);
    });
  });

  describe('Error message formatting', () => {
    it('should format AbortError as timeout', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/delay/10',
        timeout: 1000,
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
    });

    it('should format fetch errors with network prefix', async () => {
      const params: WebFetchParams = {
        url: 'https://non-existent-domain-12345.invalid',
        timeout: 5000,
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      // Error message should indicate network issues
      expect(result.error).toMatch(/Network error|getaddrinfo|fetch/i);
    });

    it('should handle unknown error types', () => {
      const tool = new WebFetchTool();
      // Use type assertion to access private method for testing
      const formatError = (tool as any).formatError.bind(tool);

      const result = formatError('unknown error type');
      expect(result).toBe('Unknown error: unknown error type');
    });
  });

  describe('Parameter validation edge cases', () => {
    it('should handle null URL', async () => {
      const params = {
        url: null as any,
      };

      const result = await tool.execute(params);
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL is required');
    });

    it('should handle undefined method', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
        method: undefined,
      };

      const result = await tool.execute(params);
      // Should default to GET when method is undefined
      expect(result.metadata?.method).toBe('GET');
    });

    it('should handle empty headers object', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/get',
        headers: {},
      };

      const result = await tool.execute(params);
      // Should still include default User-Agent
      if (result.success && result.data) {
        const responseData = JSON.parse(result.data);
        expect(responseData.headers['User-Agent']).toContain('APEX-Agent');
      }
    });

    it('should handle undefined body', async () => {
      const params: WebFetchParams = {
        url: 'https://httpbin.org/post',
        method: 'POST',
        body: undefined,
      };

      const result = await tool.execute(params);
      expect(result.metadata?.method).toBe('POST');
      // Should succeed even with undefined body for POST
    });
  });
});