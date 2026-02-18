/**
 * WebFetch Tool - Comprehensive Test Suite
 *
 * This test file ensures comprehensive coverage of all WebFetch functionality
 * to meet the acceptance criteria of >80% code coverage and complete testing
 * of all features including:
 *
 * - Unit tests for URL fetching
 * - HTML parsing
 * - Caching behavior
 * - Integration tests for end-to-end flow
 * - Mock HTTP responses
 * - Error cases
 * - Timeouts
 * - Cache invalidation
 * - AI analysis functionality
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebFetchTool, webFetch, webFetchTool, type WebFetchParams, type WebFetchResult } from './webfetch';

// Mock Anthropic SDK for AI analysis testing
vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'Mock AI analysis result: The content contains a heading and a paragraph.',
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 25,
        },
      }),
    },
  }));
  return { default: MockAnthropic };
});

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

describe('WebFetch Tool - Comprehensive Coverage', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    tool.clearCache();
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useFakeTimers();
  });

  afterEach(() => {
    tool.clearCache();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  // =============================================================================
  // PARAMETER VALIDATION TESTS
  // =============================================================================
  describe('Parameter Validation', () => {
    it('should reject empty URL', async () => {
      const result = await tool.execute({ url: '' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL is required');
    });

    it('should reject invalid URL format', async () => {
      const result = await tool.execute({ url: 'invalid-url' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL format');
    });

    it('should reject unsupported HTTP methods', async () => {
      const result = await tool.execute({
        url: 'https://example.com',
        method: 'PATCH' as any
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported HTTP method');
    });

    it('should reject timeout below minimum', async () => {
      const result = await tool.execute({
        url: 'https://example.com',
        timeout: 500
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout must be between');
    });

    it('should reject timeout above maximum', async () => {
      const result = await tool.execute({
        url: 'https://example.com',
        timeout: 70000
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Timeout must be between');
    });

    it('should reject body for GET requests', async () => {
      const result = await tool.execute({
        url: 'https://example.com',
        method: 'GET',
        body: 'should not be allowed'
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('GET requests cannot have a body');
    });

    it('should reject body for DELETE requests', async () => {
      const result = await tool.execute({
        url: 'https://example.com',
        method: 'DELETE',
        body: 'should not be allowed'
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('DELETE requests cannot have a body');
    });

    it('should reject negative cache TTL', async () => {
      const result = await tool.execute({
        url: 'https://example.com',
        cacheTtl: -1000
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Cache TTL cannot be negative');
    });
  });

  // =============================================================================
  // HTTP METHODS TESTS
  // =============================================================================
  describe('HTTP Methods', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        url: 'https://api.example.com',
        text: '{"result": "success"}'
      }));
    });

    it('should handle GET requests', async () => {
      const result = await tool.execute({
        url: 'https://api.example.com/data',
        method: 'GET'
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe(200);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/data',
        expect.objectContaining({
          method: 'GET',
          body: undefined
        })
      );
    });

    it('should handle POST requests with body', async () => {
      const postData = '{"name": "test"}';
      const result = await tool.execute({
        url: 'https://api.example.com/create',
        method: 'POST',
        body: postData,
        headers: { 'Content-Type': 'application/json' }
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/create',
        expect.objectContaining({
          method: 'POST',
          body: postData,
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      );
    });

    it('should handle PUT requests', async () => {
      const putData = '{"id": 1, "name": "updated"}';
      const result = await tool.execute({
        url: 'https://api.example.com/update/1',
        method: 'PUT',
        body: putData
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/update/1',
        expect.objectContaining({
          method: 'PUT',
          body: putData
        })
      );
    });

    it('should handle DELETE requests', async () => {
      const result = await tool.execute({
        url: 'https://api.example.com/delete/1',
        method: 'DELETE'
      });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/delete/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      );
    });
  });

  // =============================================================================
  // ERROR HANDLING TESTS
  // =============================================================================
  describe('Error Handling', () => {
    it('should handle network timeouts', async () => {
      mockFetch.mockImplementation(() =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new DOMException('Operation timed out', 'AbortError'));
          }, 100);
        })
      );

      const promise = tool.execute({
        url: 'https://slow.example.com',
        timeout: 1000
      });

      // Advance time to trigger timeout
      vi.advanceTimersByTime(1000);

      const result = await promise;
      expect(result.success).toBe(false);
      expect(result.error).toContain('Request timed out');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network fetch error'));

      const result = await tool.execute({
        url: 'https://unreachable.example.com'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network error');
    });

    it('should handle HTTP error status codes', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {},
        url: 'https://example.com/notfound',
        text: 'Page not found'
      }));

      const result = await tool.execute({
        url: 'https://example.com/notfound'
      });

      expect(result.success).toBe(false);
      expect(result.status).toBe(404);
      expect(result.error).toBe('HTTP 404: Not Found');
    });

    it('should handle AbortError specifically', async () => {
      mockFetch.mockRejectedValue(new DOMException('Operation was aborted', 'AbortError'));

      const result = await tool.execute({
        url: 'https://example.com'
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Request timed out');
    });

    it('should handle unknown errors gracefully', async () => {
      mockFetch.mockRejectedValue('Unknown error type');

      const result = await tool.execute({
        url: 'https://example.com'
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unknown error');
    });
  });

  // =============================================================================
  // CACHING BEHAVIOR TESTS
  // =============================================================================
  describe('Caching Behavior', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://cache-test.com',
        text: 'Cached content'
      }));
    });

    it('should cache successful responses by default', async () => {
      const params = { url: 'https://cache-test.com' };

      // First request
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.fromCache).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request should hit cache
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.fromCache).toBe(true);
      expect(result2.metadata?.responseTime).toBe(0);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional call
    });

    it('should respect cache bypass option', async () => {
      const params = { url: 'https://cache-test.com' };

      // First request
      await tool.execute(params);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second request with bypass should hit network again
      const result = await tool.execute({ ...params, bypassCache: true });
      expect(result.success).toBe(true);
      expect(result.fromCache).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should not cache error responses', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        headers: {},
        url: 'https://error-test.com',
        text: 'Server error'
      }));

      const params = { url: 'https://error-test.com' };

      // First error request
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(false);

      // Second request should hit network again (not cached)
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(false);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should expire cache entries after TTL', async () => {
      const shortTtl = 1000; // 1 second
      const params = {
        url: 'https://ttl-test.com',
        cacheTtl: shortTtl
      };

      // First request
      const result1 = await tool.execute(params);
      expect(result1.fromCache).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Advance time past TTL
      vi.advanceTimersByTime(shortTtl + 100);

      // Second request should miss cache and hit network
      const result2 = await tool.execute(params);
      expect(result2.fromCache).toBeFalsy();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('should clean up expired entries automatically', async () => {
      const params = { url: 'https://cleanup-test.com', cacheTtl: 1000 };

      // Add entry to cache
      await tool.execute(params);
      expect(tool.getCacheStats().size).toBe(1);

      // Advance time past TTL
      vi.advanceTimersByTime(2000);

      // Trigger cleanup manually (simulating interval)
      tool.forceCleanup();

      // Cache should be empty
      expect(tool.getCacheStats().size).toBe(0);
    });

    it('should generate different cache keys for different parameters', async () => {
      const baseUrl = 'https://param-test.com';

      // Different URLs
      await tool.execute({ url: `${baseUrl}/path1` });
      await tool.execute({ url: `${baseUrl}/path2` });

      // Different methods
      await tool.execute({ url: baseUrl, method: 'GET' });
      await tool.execute({ url: baseUrl, method: 'POST', body: 'test' });

      // Different headers
      await tool.execute({ url: baseUrl, headers: { 'X-Test': 'value1' } });
      await tool.execute({ url: baseUrl, headers: { 'X-Test': 'value2' } });

      expect(tool.getCacheStats().size).toBe(6); // All should be separate entries
    });
  });

  // =============================================================================
  // HTML PARSING TESTS
  // =============================================================================
  describe('HTML Parsing and Markdown Conversion', () => {
    it('should convert HTML to markdown by default', async () => {
      const htmlContent = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Main Heading</h1>
            <p>This is a <strong>paragraph</strong> with <em>emphasis</em>.</p>
            <ul>
              <li>Item 1</li>
              <li>Item 2</li>
            </ul>
            <a href="https://example.com">Link</a>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: htmlContent
      }));

      const result = await tool.execute({
        url: 'https://example.com',
        convertToMarkdown: true
      });

      expect(result.success).toBe(true);
      expect(result.data).toContain('# Main Heading');
      expect(result.data).toContain('**paragraph**');
      expect(result.data).toContain('*emphasis*');
      expect(result.data).toContain('[Link](https://example.com)');
    });

    it('should remove scripts and styles from HTML', async () => {
      const htmlWithScripts = `
        <html>
          <head>
            <script>console.log('should be removed');</script>
            <style>.class { color: red; }</style>
          </head>
          <body>
            <h1>Clean Content</h1>
            <script>alert('also removed');</script>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: htmlWithScripts
      }));

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data).toContain('# Clean Content');
      expect(result.data).not.toContain('console.log');
      expect(result.data).not.toContain('color: red');
      expect(result.data).not.toContain('alert');
    });

    it('should preserve images with alt text', async () => {
      const htmlWithImages = `
        <html>
          <body>
            <img src="https://example.com/image.jpg" alt="Test Image" title="Image Title">
            <img src="https://example.com/logo.png" alt="Company Logo">
            <img src="https://example.com/icon.ico">
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: htmlWithImages
      }));

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data).toContain('![Test Image](https://example.com/image.jpg "Image Title")');
      expect(result.data).toContain('![Company Logo](https://example.com/logo.png)');
      expect(result.data).toContain('![](https://example.com/icon.ico)');
    });

    it('should describe form elements', async () => {
      const htmlWithForms = `
        <html>
          <body>
            <form action="/submit" method="post">
              <input type="text" placeholder="Enter name" value="John">
              <input type="email" placeholder="Enter email">
              <select>
                <option>Option 1</option>
                <option>Option 2</option>
              </select>
              <textarea placeholder="Comments"></textarea>
              <button type="submit">Submit Form</button>
            </form>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: htmlWithForms
      }));

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.data).toContain('[Input: text, placeholder: "Enter name", value: "John"]');
      expect(result.data).toContain('[Input: email, placeholder: "Enter email"]');
      expect(result.data).toContain('[Select:');
      expect(result.data).toContain('[Textarea: Comments]');
      expect(result.data).toContain('[Button: Submit Form]');
    });

    it('should disable markdown conversion when requested', async () => {
      const htmlContent = '<h1>Should stay as HTML</h1>';

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: htmlContent
      }));

      const result = await tool.execute({
        url: 'https://example.com',
        convertToMarkdown: false
      });

      expect(result.success).toBe(true);
      expect(result.data).toBe(htmlContent);
    });

    it('should not convert non-HTML content types', async () => {
      const jsonContent = '{"message": "This is JSON"}';

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        url: 'https://api.example.com',
        text: jsonContent
      }));

      const result = await tool.execute({ url: 'https://api.example.com' });

      expect(result.success).toBe(true);
      expect(result.data).toBe(jsonContent);
    });
  });

  // =============================================================================
  // AI ANALYSIS TESTS
  // =============================================================================
  describe('AI Analysis Functionality', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: '<h1>Test Content</h1><p>This is test content for analysis.</p>'
      }));
    });

    it('should perform AI analysis when prompt is provided', async () => {
      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'Summarize the main content of this page'
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toContain('Mock AI analysis result');
      expect(result.analysis?.model).toBe('claude-3-5-haiku-latest');
      expect(result.analysis?.usage.inputTokens).toBe(100);
      expect(result.analysis?.usage.outputTokens).toBe(25);
    });

    it('should include prompt in cache key for AI analysis', async () => {
      const baseParams = { url: 'https://example.com' };

      // Same URL with different prompts should create separate cache entries
      await tool.execute({ ...baseParams, prompt: 'Summarize content' });
      await tool.execute({ ...baseParams, prompt: 'Extract key points' });

      expect(tool.getCacheStats().size).toBe(2);
    });

    it('should truncate content for AI analysis if too long', async () => {
      const longContent = '<h1>Title</h1>' + '<p>'.repeat(50000) + 'Long content' + '</p>'.repeat(50000);

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: longContent
      }));

      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'Analyze this content',
        maxAnalysisContent: 1000
      });

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(1000);
    });

    it('should handle AI analysis errors gracefully', async () => {
      // Mock Anthropic to throw an error
      const mockAnthropic = await import('@anthropic-ai/sdk');
      const mockCreate = vi.fn().mockRejectedValue(new Error('API rate limit exceeded'));
      (mockAnthropic.default as any).mockImplementation(() => ({
        messages: { create: mockCreate }
      }));

      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'This will fail'
      });

      expect(result.success).toBe(true); // Fetch should still succeed
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toContain('AI analysis failed');
    });
  });

  // =============================================================================
  // METADATA AND RESPONSE HANDLING TESTS
  // =============================================================================
  describe('Metadata and Response Handling', () => {
    it('should include comprehensive metadata', async () => {
      const mockText = 'Response content';

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/plain',
          'content-length': mockText.length.toString()
        },
        url: 'https://example.com/redirected',
        redirected: true,
        text: mockText
      }));

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.metadata).toEqual(
        expect.objectContaining({
          url: 'https://example.com',
          method: 'GET',
          responseTime: expect.any(Number),
          contentLength: expect.any(Number),
          contentType: 'text/plain',
          redirected: true,
          finalUrl: 'https://example.com/redirected'
        })
      );
    });

    it('should handle missing content-length header', async () => {
      const mockText = 'Content without length header';

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://example.com',
        text: mockText
      }));

      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(result.metadata?.contentLength).toBe(mockText.length);
    });

    it('should include response headers', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'application/json',
          'x-custom-header': 'custom-value',
          'cache-control': 'max-age=3600'
        },
        url: 'https://api.example.com',
        text: '{"data": "value"}'
      }));

      const result = await tool.execute({ url: 'https://api.example.com' });

      expect(result.success).toBe(true);
      expect(result.headers).toEqual({
        'content-type': 'application/json',
        'x-custom-header': 'custom-value',
        'cache-control': 'max-age=3600'
      });
    });
  });

  // =============================================================================
  // CACHE MANAGEMENT API TESTS
  // =============================================================================
  describe('Cache Management API', () => {
    it('should provide cache statistics', async () => {
      // Add some entries to cache
      await tool.execute({ url: 'https://test1.com' });
      await tool.execute({ url: 'https://test2.com' });

      const stats = tool.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.entries).toHaveLength(2);
      expect(stats.entries[0]).toEqual(
        expect.objectContaining({
          key: expect.any(String),
          createdAt: expect.any(Number),
          ttl: expect.any(Number),
          url: expect.stringContaining('test')
        })
      );
    });

    it('should clear entire cache', async () => {
      await tool.execute({ url: 'https://test.com' });
      expect(tool.getCacheStats().size).toBe(1);

      tool.clearCache();
      expect(tool.getCacheStats().size).toBe(0);
    });

    it('should remove specific cache entries', async () => {
      const params1 = { url: 'https://test1.com' };
      const params2 = { url: 'https://test2.com' };

      await tool.execute(params1);
      await tool.execute(params2);
      expect(tool.getCacheStats().size).toBe(2);

      const removed = tool.removeCacheEntry(params1);
      expect(removed).toBe(true);
      expect(tool.getCacheStats().size).toBe(1);

      // Try to remove non-existent entry
      const notRemoved = tool.removeCacheEntry({ url: 'https://nonexistent.com' });
      expect(notRemoved).toBe(false);
    });
  });

  // =============================================================================
  // CONVENIENCE FUNCTIONS TESTS
  // =============================================================================
  describe('Convenience Functions', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://example.com',
        text: 'test response'
      }));
    });

    it('should export webFetch function', async () => {
      expect(typeof webFetch).toBe('function');

      const result = await webFetch({ url: 'https://example.com' });
      expect(result.success).toBe(true);
    });

    it('should export webFetchTool instance', () => {
      expect(webFetchTool).toBeInstanceOf(WebFetchTool);
    });

    it('should have webFetch function use default instance', async () => {
      const directResult = await webFetchTool.execute({ url: 'https://example.com' });
      const functionResult = await webFetch({ url: 'https://example.com' });

      // Both should behave the same way (though cache will make second faster)
      expect(directResult.success).toBe(functionResult.success);
      expect(directResult.data).toBe(functionResult.data);
    });
  });

  // =============================================================================
  // HEADERS AND USER-AGENT TESTS
  // =============================================================================
  describe('Headers and User-Agent', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://example.com',
        text: 'response'
      }));
    });

    it('should include default User-Agent header', async () => {
      await tool.execute({ url: 'https://example.com' });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'APEX-Agent/1.0'
          })
        })
      );
    });

    it('should allow custom headers', async () => {
      await tool.execute({
        url: 'https://example.com',
        headers: {
          'X-Custom-Header': 'custom-value',
          'Authorization': 'Bearer token123'
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'APEX-Agent/1.0',
            'X-Custom-Header': 'custom-value',
            'Authorization': 'Bearer token123'
          })
        })
      );
    });

    it('should allow User-Agent override', async () => {
      await tool.execute({
        url: 'https://example.com',
        headers: {
          'User-Agent': 'CustomBot/2.0'
        }
      });

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': 'CustomBot/2.0'
          })
        })
      );
    });
  });

  // =============================================================================
  // DEFAULT VALUES TESTS
  // =============================================================================
  describe('Default Values', () => {
    beforeEach(() => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: '<h1>Test</h1>'
      }));
    });

    it('should use default values for optional parameters', async () => {
      const result = await tool.execute({ url: 'https://example.com' });

      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'User-Agent': 'APEX-Agent/1.0'
          }),
          body: undefined
        })
      );

      // Should convert to markdown by default
      expect(result.data).toContain('# Test');
    });

    it('should use 10 second timeout by default', async () => {
      const abortController = { abort: vi.fn() };
      const spy = vi.spyOn(global, 'AbortController').mockReturnValue(abortController as any);
      const timeoutSpy = vi.spyOn(global, 'setTimeout');

      await tool.execute({ url: 'https://example.com' });

      expect(timeoutSpy).toHaveBeenCalledWith(expect.any(Function), 10000);

      spy.mockRestore();
      timeoutSpy.mockRestore();
    });
  });

  // =============================================================================
  // INTEGRATION END-TO-END TESTS
  // =============================================================================
  describe('End-to-End Integration', () => {
    it('should handle complete workflow with all features', async () => {
      const htmlContent = `
        <html>
          <head>
            <title>Complete Test Page</title>
            <script>console.log('remove me');</script>
          </head>
          <body>
            <h1>Main Title</h1>
            <p>Content with <strong>bold</strong> text.</p>
            <img src="https://example.com/image.jpg" alt="Test Image">
            <form>
              <input type="text" placeholder="Name">
              <button>Submit</button>
            </form>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: {
          'content-type': 'text/html; charset=utf-8',
          'x-response-time': '123ms'
        },
        url: 'https://test-site.example.com/page',
        redirected: true,
        text: htmlContent
      }));

      const result = await tool.execute({
        url: 'https://test-site.example.com',
        method: 'GET',
        headers: { 'Accept': 'text/html' },
        convertToMarkdown: true,
        prompt: 'What is the main topic of this page?'
      });

      // Verify successful response
      expect(result.success).toBe(true);
      expect(result.status).toBe(200);

      // Verify HTML-to-markdown conversion
      expect(result.data).toContain('# Main Title');
      expect(result.data).toContain('**bold**');
      expect(result.data).toContain('![Test Image](https://example.com/image.jpg)');
      expect(result.data).toContain('[Input: text, placeholder: "Name"]');
      expect(result.data).toContain('[Button: Submit]');
      expect(result.data).not.toContain('console.log');

      // Verify metadata
      expect(result.metadata).toEqual(
        expect.objectContaining({
          url: 'https://test-site.example.com',
          method: 'GET',
          responseTime: expect.any(Number),
          contentType: 'text/html; charset=utf-8',
          redirected: true,
          finalUrl: 'https://test-site.example.com/page'
        })
      );

      // Verify AI analysis
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toBeTruthy();
      expect(result.analysis?.model).toBe('claude-3-5-haiku-latest');

      // Verify headers
      expect(result.headers).toEqual(
        expect.objectContaining({
          'content-type': 'text/html; charset=utf-8',
          'x-response-time': '123ms'
        })
      );

      // Verify caching
      expect(result.fromCache).toBeFalsy();

      // Second request should hit cache
      const cachedResult = await tool.execute({
        url: 'https://test-site.example.com',
        method: 'GET',
        headers: { 'Accept': 'text/html' },
        convertToMarkdown: true,
        prompt: 'What is the main topic of this page?'
      });

      expect(cachedResult.fromCache).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(1); // No additional network call
    });
  });
});