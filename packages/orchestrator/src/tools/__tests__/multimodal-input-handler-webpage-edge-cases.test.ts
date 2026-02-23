/**
 * Edge case tests for web page processing functionality in MultimodalInputHandler
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import {
  MultimodalInputHandler,
  MultimodalInputError,
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

describe('MultimodalInputHandler - Web Page Processing Edge Cases', () => {
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

  const createMockWebFetchResult = (overrides: Partial<WebFetchResult> = {}): WebFetchResult => ({
    success: true,
    status: 200,
    headers: { 'content-type': 'text/html' },
    data: '<html><head><title>Test Page</title></head><body><p>Test content</p></body></html>',
    fromCache: false,
    metadata: {
      url: 'https://example.com',
      method: 'GET',
      responseTime: 500,
      contentLength: 100,
      contentType: 'text/html',
    },
    ...overrides,
  });

  describe('URL validation edge cases', () => {
    it('should reject empty or null URLs', async () => {
      const invalidUrls = [
        '',
        '   ',
        null,
        undefined,
      ];

      for (const invalidUrl of invalidUrls) {
        await expect(handler.processWebPage(invalidUrl as any)).rejects.toThrow(
          expect.objectContaining({
            name: 'MultimodalInputError',
            code: 'INVALID_URL',
          })
        );
      }

      expect(mockWebFetchExecute).not.toHaveBeenCalled();
    });

    it('should reject malformed URLs', async () => {
      const malformedUrls = [
        'not-a-url',
        'http://',
        'https://',
        'ftp://invalid',
        '://missing-protocol',
        'http://[invalid-ipv6',
        'https://domain with spaces.com',
        'javascript:alert(1)',
        'data:text/html,<script>alert(1)</script>',
        'file:///etc/passwd',
      ];

      for (const malformedUrl of malformedUrls) {
        await expect(handler.processWebPage(malformedUrl)).rejects.toThrow(
          expect.objectContaining({
            name: 'MultimodalInputError',
            code: 'INVALID_URL',
          })
        );
      }

      expect(mockWebFetchExecute).not.toHaveBeenCalled();
    });

    it('should accept valid URLs with various formats', async () => {
      mockWebFetchExecute.mockResolvedValue(createMockWebFetchResult());

      const validUrls = [
        'http://example.com',
        'https://example.com',
        'https://sub.domain.example.com',
        'http://localhost',
        'http://127.0.0.1',
        'http://192.168.1.1:8080',
        'https://example.com:443/path?query=1&param=2',
        'https://example.com/path#fragment',
        'https://user:pass@example.com/path',
        'https://example.com/path%20with%20encoded%20spaces',
        'https://xn--bcher-kva.example', // IDN domain (bücher.example)
      ];

      for (const validUrl of validUrls) {
        await expect(handler.processWebPage(validUrl)).resolves.toBeDefined();
      }

      expect(mockWebFetchExecute).toHaveBeenCalledTimes(validUrls.length);
    });
  });

  describe('HTTP status code edge cases', () => {
    it('should handle successful 2xx status codes', async () => {
      const successfulStatuses = [200, 201, 202, 204, 206];

      for (const status of successfulStatuses) {
        mockWebFetchExecute.mockResolvedValueOnce(
          createMockWebFetchResult({ status })
        );

        const result = await handler.processWebPage('https://example.com');
        expect(result.statusCode).toBe(status);
      }
    });

    it('should throw error for client error 4xx status codes', async () => {
      const clientErrorStatuses = [400, 401, 403, 404, 409, 429];

      for (const status of clientErrorStatuses) {
        mockWebFetchExecute.mockResolvedValueOnce(
          createMockWebFetchResult({
            success: false,
            status,
            error: `HTTP ${status}: Client Error`,
          })
        );

        await expect(handler.processWebPage('https://example.com')).rejects.toThrow(
          expect.objectContaining({
            name: 'MultimodalInputError',
            code: 'FETCH_ERROR',
          })
        );
      }
    });

    it('should throw error for server error 5xx status codes', async () => {
      const serverErrorStatuses = [500, 502, 503, 504];

      for (const status of serverErrorStatuses) {
        mockWebFetchExecute.mockResolvedValueOnce(
          createMockWebFetchResult({
            success: false,
            status,
            error: `HTTP ${status}: Server Error`,
          })
        );

        await expect(handler.processWebPage('https://example.com')).rejects.toThrow(
          expect.objectContaining({
            name: 'MultimodalInputError',
            code: 'FETCH_ERROR',
          })
        );
      }
    });
  });

  describe('content parsing edge cases', () => {
    it('should handle empty HTML content', async () => {
      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({ data: '' })
      );

      const result = await handler.processWebPage('https://example.com');

      expect(result.markdown).toBe('');
      expect(result.title).toBeUndefined();
    });

    it('should handle HTML with malformed title tags', async () => {
      const malformedTitles = [
        '<title>Unclosed title',
        '<TITLE>Case insensitive</TITLE>',
        '<title></title>',
        '<title>   </title>',
        '<title>Multiple<title>Title</title>Tags</title>',
        '<!-- <title>Commented Title</title> -->',
      ];

      for (const html of malformedTitles) {
        mockWebFetchExecute.mockResolvedValueOnce(
          createMockWebFetchResult({ data: `<html><head>${html}</head><body>Content</body></html>` })
        );

        const result = await handler.processWebPage('https://example.com');

        // Should either extract the title correctly or return undefined
        if (result.title) {
          expect(typeof result.title).toBe('string');
          expect(result.title.length).toBeGreaterThan(0);
        }
      }
    });

    it('should handle HTML with special characters and entities', async () => {
      const htmlWithEntities = `
        <html>
          <head><title>Test &amp; Special &lt;Characters&gt; &quot;Quotes&quot; &#39;Apostrophes&#39;</title></head>
          <body>
            <p>Content with &copy; &trade; &nbsp; entities</p>
            <p>Unicode: 你好 こんにちは</p>
          </body>
        </html>
      `;

      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({ data: htmlWithEntities })
      );

      const result = await handler.processWebPage('https://example.com');

      expect(result.title).toContain('Test & Special <Characters> "Quotes" \'Apostrophes\'');
      expect(result.markdown).toBeDefined();
    });

    it('should handle large HTML documents', async () => {
      const largeContent = '<p>Large content</p>'.repeat(10000); // ~150KB
      const largeHtml = `<html><head><title>Large Document</title></head><body>${largeContent}</body></html>`;

      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({
          data: largeHtml,
          metadata: {
            url: 'https://example.com',
            method: 'GET',
            responseTime: 2000,
            contentLength: largeHtml.length,
            contentType: 'text/html',
          },
        })
      );

      const result = await handler.processWebPage('https://example.com');

      expect(result.title).toBe('Large Document');
      expect(result.markdown).toBeDefined();
      expect(result.metadata.contentLength).toBe(largeHtml.length);
    });
  });

  describe('markdown conversion edge cases', () => {
    it('should preserve markdown format when already markdown', async () => {
      const markdownContent = `
# Main Title

## Section 1
Some content here.

### Subsection
- List item 1
- List item 2

**Bold text** and *italic text*.

[Link](https://example.com)
      `;

      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({
          data: markdownContent,
          headers: { 'content-type': 'text/plain' },
        })
      );

      const result = await handler.processWebPage('https://example.com');

      expect(result.markdown).toContain('# Main Title');
      expect(result.title).toBe('Main Title');
    });

    it('should handle mixed HTML and markdown content', async () => {
      const mixedContent = `
        <h1>HTML Title</h1>

        # Markdown Title

        <p>HTML paragraph with <strong>bold</strong> text</p>

        **Markdown bold** and *markdown italic*
      `;

      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({ data: mixedContent })
      );

      const result = await handler.processWebPage('https://example.com');

      expect(result.markdown).toBeDefined();
      expect(result.title).toBeTruthy();
    });
  });

  describe('AI analysis edge cases', () => {
    it('should handle AI analysis with very short content', async () => {
      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({
          data: '<html><body><p>Hi</p></body></html>',
          analysis: {
            content: 'A simple greeting page.',
            model: 'claude-3-5-haiku-latest',
            usage: { inputTokens: 10, outputTokens: 5 },
            truncated: false,
            originalContentLength: 30,
            analyzedContentLength: 30,
          },
        })
      );

      const result = await handler.processWebPage('https://example.com', {
        prompt: 'Analyze this page',
      });

      expect(result.analysis).toBeDefined();
      expect(result.analysis!.content).toBe('A simple greeting page.');
      expect(result.analysis!.truncated).toBe(false);
    });

    it('should handle AI analysis with very long content', async () => {
      const longContent = 'Very long content. '.repeat(10000); // ~190KB
      const longHtml = `<html><body><p>${longContent}</p></body></html>`;

      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({
          data: longHtml,
          analysis: {
            content: 'This page contains repetitive content about being very long.',
            model: 'claude-3-5-haiku-latest',
            usage: { inputTokens: 50000, outputTokens: 50 },
            truncated: true,
            originalContentLength: longHtml.length,
            analyzedContentLength: 100000, // Truncated
          },
        })
      );

      const result = await handler.processWebPage('https://example.com', {
        prompt: 'Summarize this very long page',
        maxAnalysisContent: 100000,
      });

      expect(result.analysis).toBeDefined();
      expect(result.analysis!.truncated).toBe(true);
      expect(result.analysis!.originalContentLength).toBeGreaterThan(result.analysis!.analyzedContentLength);
    });

    it('should handle AI analysis failures gracefully', async () => {
      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({
          analysisError: 'AI service temporarily unavailable',
        })
      );

      const result = await handler.processWebPage('https://example.com', {
        prompt: 'Analyze this page',
      });

      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toBe('AI service temporarily unavailable');
    });
  });

  describe('caching edge cases', () => {
    it('should handle cache misses and hits correctly', async () => {
      // First call - cache miss
      mockWebFetchExecute.mockResolvedValueOnce(
        createMockWebFetchResult({
          fromCache: false,
          metadata: {
            url: 'https://example.com',
            method: 'GET',
            responseTime: 1000,
            contentLength: 100,
            contentType: 'text/html',
            cacheKey: 'cache-key-123',
          },
        })
      );

      const result1 = await handler.processWebPage('https://example.com');
      expect(result1.fromCache).toBe(false);
      expect(result1.metadata.responseTime).toBe(1000);

      // Second call - cache hit
      mockWebFetchExecute.mockResolvedValueOnce(
        createMockWebFetchResult({
          fromCache: true,
          metadata: {
            url: 'https://example.com',
            method: 'GET',
            responseTime: 0, // Cached responses are instant
            contentLength: 100,
            contentType: 'text/html',
            cacheKey: 'cache-key-123',
          },
        })
      );

      const result2 = await handler.processWebPage('https://example.com');
      expect(result2.fromCache).toBe(true);
      expect(result2.metadata.responseTime).toBe(0);
    });

    it('should handle cache bypass correctly', async () => {
      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({ fromCache: false })
      );

      const result = await handler.processWebPage('https://example.com', {
        bypassCache: true,
      });

      expect(mockWebFetchExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          bypassCache: true,
        })
      );
      expect(result.fromCache).toBe(false);
    });
  });

  describe('concurrent processing edge cases', () => {
    it('should handle multiple simultaneous requests to same URL', async () => {
      const mockResult = createMockWebFetchResult();
      mockWebFetchExecute.mockResolvedValue(mockResult);

      const promises = Array.from({ length: 5 }, () =>
        handler.processWebPage('https://example.com')
      );

      const results = await Promise.all(promises);

      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result.url).toBe('https://example.com');
        expect(result.statusCode).toBe(200);
      });
    });

    it('should handle mixed success and failure requests', async () => {
      const urls = [
        'https://success1.com',
        'https://failure1.com',
        'https://success2.com',
        'https://failure2.com',
      ];

      mockWebFetchExecute
        .mockResolvedValueOnce(createMockWebFetchResult()) // success1
        .mockResolvedValueOnce(createMockWebFetchResult({
          success: false,
          error: 'Network error',
        })) // failure1
        .mockResolvedValueOnce(createMockWebFetchResult()) // success2
        .mockResolvedValueOnce(createMockWebFetchResult({
          success: false,
          error: 'Timeout error',
        })); // failure2

      const results = await Promise.allSettled(
        urls.map(url => handler.processWebPage(url))
      );

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('rejected');
    });
  });

  describe('options parameter validation', () => {
    it('should handle undefined options gracefully', async () => {
      mockWebFetchExecute.mockResolvedValue(createMockWebFetchResult());

      const result = await handler.processWebPage('https://example.com', undefined);

      expect(result).toBeDefined();
      expect(mockWebFetchExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          convertToMarkdown: true, // Default value
          timeout: 10000, // Default value
          bypassCache: false, // Default value
        })
      );
    });

    it('should handle empty options object', async () => {
      mockWebFetchExecute.mockResolvedValue(createMockWebFetchResult());

      const result = await handler.processWebPage('https://example.com', {});

      expect(result).toBeDefined();
      expect(mockWebFetchExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          convertToMarkdown: true,
          timeout: 10000,
          bypassCache: false,
        })
      );
    });

    it('should handle extreme timeout values', async () => {
      mockWebFetchExecute.mockResolvedValue(createMockWebFetchResult());

      // Very short timeout
      await handler.processWebPage('https://example.com', { timeout: 1 });
      expect(mockWebFetchExecute).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 1 })
      );

      // Very long timeout
      await handler.processWebPage('https://example.com', { timeout: 300000 });
      expect(mockWebFetchExecute).toHaveBeenLastCalledWith(
        expect.objectContaining({ timeout: 300000 })
      );
    });
  });

  describe('error handling edge cases', () => {
    it('should handle WebFetchTool internal errors', async () => {
      mockWebFetchExecute.mockRejectedValue(new Error('Internal WebFetch error'));

      await expect(handler.processWebPage('https://example.com')).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'WEB_PAGE_PROCESSING_ERROR',
          message: expect.stringContaining('Internal WebFetch error'),
        })
      );
    });

    it('should handle unexpected WebFetch response format', async () => {
      // Mock an invalid response that doesn't match WebFetchResult interface
      mockWebFetchExecute.mockResolvedValue({
        // Missing required properties
        invalid: true,
      } as any);

      await expect(handler.processWebPage('https://example.com')).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'WEB_PAGE_PROCESSING_ERROR',
        })
      );
    });

    it('should provide detailed error context', async () => {
      const testUrl = 'https://detailed-error-test.com';
      mockWebFetchExecute.mockResolvedValue(
        createMockWebFetchResult({
          success: false,
          error: 'DNS resolution failed',
        })
      );

      try {
        await handler.processWebPage(testUrl);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(MultimodalInputError);
        const multimodalError = error as MultimodalInputError;
        expect(multimodalError.message).toContain('DNS resolution failed');
        expect(multimodalError.code).toBe('FETCH_ERROR');
      }
    });
  });
});