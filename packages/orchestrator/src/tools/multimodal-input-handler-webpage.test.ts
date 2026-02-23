/**
 * Tests for web page processing functionality in MultimodalInputHandler
 */
import { describe, it, expect, beforeEach, afterEach, vi, type MockedFunction } from 'vitest';
import {
  MultimodalInputHandler,
  MultimodalInputError,
  processWebPage,
  type WebPageOptions,
  type WebPageContent
} from './multimodal-input-handler';
import { WebFetchTool, type WebFetchResult } from './webfetch';

// Mock WebFetchTool
vi.mock('./webfetch', () => ({
  WebFetchTool: vi.fn(() => ({
    execute: vi.fn(),
  })),
}));

const MockWebFetchTool = WebFetchTool as unknown as vi.MockedClass<typeof WebFetchTool>;

describe('MultimodalInputHandler - Web Page Processing', () => {
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

  describe('processWebPage', () => {
    const mockWebFetchResult: WebFetchResult = {
      success: true,
      status: 200,
      headers: { 'content-type': 'text/html' },
      data: '<html><head><title>Test Page</title></head><body><h1>Hello World</h1><p>This is a test page.</p></body></html>',
      fromCache: false,
      metadata: {
        url: 'https://example.com',
        method: 'GET',
        responseTime: 500,
        contentLength: 100,
        contentType: 'text/html',
      },
    };

    it('should process web page successfully with default options', async () => {
      mockWebFetchExecute.mockResolvedValue(mockWebFetchResult);

      const result = await handler.processWebPage('https://example.com');

      expect(mockWebFetchExecute).toHaveBeenCalledWith({
        url: 'https://example.com',
        method: 'GET',
        headers: undefined,
        body: undefined,
        timeout: 10000,
        convertToMarkdown: true,
        bypassCache: false,
        cacheTtl: undefined,
        prompt: undefined,
        maxAnalysisContent: undefined,
      });

      expect(result).toEqual({
        url: 'https://example.com',
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
        html: undefined, // HTML not included when convertToMarkdown is true
        markdown: mockWebFetchResult.data,
        title: 'Test Page',
        fromCache: false,
        metadata: {
          responseTime: 500,
          contentLength: 100,
          contentType: 'text/html',
          redirected: undefined,
          finalUrl: undefined,
          cacheKey: undefined,
        },
      });
    });

    it('should process web page with custom options', async () => {
      mockWebFetchExecute.mockResolvedValue(mockWebFetchResult);

      const options: WebPageOptions = {
        method: 'POST',
        headers: { 'Authorization': 'Bearer token' },
        body: '{"query": "test"}',
        timeout: 15000,
        convertToMarkdown: false,
        bypassCache: true,
        cacheTtl: 600000,
      };

      const result = await handler.processWebPage('https://api.example.com', options);

      expect(mockWebFetchExecute).toHaveBeenCalledWith({
        url: 'https://api.example.com',
        method: 'POST',
        headers: { 'Authorization': 'Bearer token' },
        body: '{"query": "test"}',
        timeout: 15000,
        convertToMarkdown: false,
        bypassCache: true,
        cacheTtl: 600000,
        prompt: undefined,
        maxAnalysisContent: undefined,
      });

      expect(result.html).toBe(mockWebFetchResult.data);
      expect(result.markdown).toBeUndefined();
    });

    it('should include AI analysis when prompt is provided', async () => {
      const webFetchResultWithAnalysis: WebFetchResult = {
        ...mockWebFetchResult,
        analysis: {
          content: 'This is a simple test page with a greeting.',
          model: 'claude-3-5-haiku-latest',
          usage: { inputTokens: 50, outputTokens: 20 },
          truncated: false,
          originalContentLength: 100,
          analyzedContentLength: 100,
        },
      };
      mockWebFetchExecute.mockResolvedValue(webFetchResultWithAnalysis);

      const options: WebPageOptions = {
        prompt: 'Summarize the main content of this page',
        maxAnalysisContent: 50000,
      };

      const result = await handler.processWebPage('https://example.com', options);

      expect(mockWebFetchExecute).toHaveBeenCalledWith(
        expect.objectContaining({
          prompt: 'Summarize the main content of this page',
          maxAnalysisContent: 50000,
        })
      );

      expect(result.analysis).toEqual({
        content: 'This is a simple test page with a greeting.',
        model: 'claude-3-5-haiku-latest',
        usage: { inputTokens: 50, outputTokens: 20 },
        truncated: false,
        originalContentLength: 100,
        analyzedContentLength: 100,
      });
    });

    it('should handle analysis errors gracefully', async () => {
      const webFetchResultWithAnalysisError: WebFetchResult = {
        ...mockWebFetchResult,
        analysisError: 'AI analysis failed: rate limit exceeded',
      };
      mockWebFetchExecute.mockResolvedValue(webFetchResultWithAnalysisError);

      const result = await handler.processWebPage('https://example.com', {
        prompt: 'Analyze this page',
      });

      expect(result.analysisError).toBe('AI analysis failed: rate limit exceeded');
      expect(result.analysis).toBeUndefined();
    });

    it('should extract title from HTML content', async () => {
      const htmlWithTitle = '<html><head><title>My Custom Title</title></head><body>Content</body></html>';
      mockWebFetchExecute.mockResolvedValue({
        ...mockWebFetchResult,
        data: htmlWithTitle,
      });

      const result = await handler.processWebPage('https://example.com');

      expect(result.title).toBe('My Custom Title');
    });

    it('should extract title from markdown heading', async () => {
      const markdownWithHeading = '# My Markdown Title\n\nSome content here.';
      mockWebFetchExecute.mockResolvedValue({
        ...mockWebFetchResult,
        data: markdownWithHeading,
        headers: { 'content-type': 'text/plain' },
      });

      const result = await handler.processWebPage('https://example.com');

      expect(result.title).toBe('My Markdown Title');
    });

    it('should handle cached responses', async () => {
      const cachedResult: WebFetchResult = {
        ...mockWebFetchResult,
        fromCache: true,
        metadata: {
          ...mockWebFetchResult.metadata!,
          responseTime: 0,
          cacheKey: 'some-cache-key',
        },
      };
      mockWebFetchExecute.mockResolvedValue(cachedResult);

      const result = await handler.processWebPage('https://example.com');

      expect(result.fromCache).toBe(true);
      expect(result.metadata.cacheKey).toBe('some-cache-key');
    });

    it('should throw error for invalid URL', async () => {
      await expect(handler.processWebPage('not-a-url')).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'INVALID_URL',
        })
      );

      expect(mockWebFetchExecute).not.toHaveBeenCalled();
    });

    it('should throw error for unsupported protocol', async () => {
      await expect(handler.processWebPage('ftp://example.com')).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'INVALID_URL',
        })
      );
    });

    it('should throw error when web fetch fails', async () => {
      const failedResult: WebFetchResult = {
        success: false,
        error: 'Network timeout',
        metadata: {
          url: 'https://example.com',
          method: 'GET',
          responseTime: 10000,
        },
      };
      mockWebFetchExecute.mockResolvedValue(failedResult);

      await expect(handler.processWebPage('https://example.com')).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'FETCH_ERROR',
          message: expect.stringContaining('Network timeout'),
        })
      );
    });

    it('should throw error for HTTP error status codes', async () => {
      const errorResult: WebFetchResult = {
        success: false,
        status: 404,
        error: 'HTTP 404: Not Found',
        headers: {},
        metadata: {
          url: 'https://example.com',
          method: 'GET',
          responseTime: 500,
        },
      };
      mockWebFetchExecute.mockResolvedValue(errorResult);

      await expect(handler.processWebPage('https://example.com/notfound')).rejects.toThrow(
        expect.objectContaining({
          name: 'MultimodalInputError',
          code: 'FETCH_ERROR',
        })
      );
    });

    it('should handle empty response data', async () => {
      const emptyResult: WebFetchResult = {
        ...mockWebFetchResult,
        data: '',
      };
      mockWebFetchExecute.mockResolvedValue(emptyResult);

      const result = await handler.processWebPage('https://example.com');

      expect(result.markdown).toBe('');
      expect(result.title).toBeUndefined();
    });
  });

  describe('convenience function', () => {
    it('should work with processWebPage convenience function', async () => {
      mockWebFetchExecute.mockResolvedValue(mockWebFetchResult);

      // Mock the default handler
      const mockProcessWebPage = vi.fn().mockResolvedValue({
        url: 'https://example.com',
        statusCode: 200,
        headers: { 'content-type': 'text/html' },
        markdown: 'Test content',
        fromCache: false,
        metadata: { responseTime: 500 },
      });

      // We need to mock the multimodalInputHandler instance
      vi.doMock('./multimodal-input-handler', async () => {
        const actual = await vi.importActual('./multimodal-input-handler');
        return {
          ...actual,
          multimodalInputHandler: {
            processWebPage: mockProcessWebPage,
          },
        };
      });

      // Re-import to get the mocked version
      const { processWebPage: convenientProcessWebPage } = await import('./multimodal-input-handler');

      const result = await convenientProcessWebPage('https://example.com');

      expect(result.url).toBe('https://example.com');
      expect(result.statusCode).toBe(200);
    });
  });

  describe('URL validation', () => {
    it('should validate URL format properly', async () => {
      const invalidUrls = [
        '',
        null,
        undefined,
        'not-a-url',
        'javascript:alert(1)',
        'file:///etc/passwd',
      ];

      for (const invalidUrl of invalidUrls) {
        await expect(handler.processWebPage(invalidUrl as any)).rejects.toThrow(
          MultimodalInputError
        );
      }
    });

    it('should accept valid HTTP and HTTPS URLs', async () => {
      mockWebFetchExecute.mockResolvedValue(mockWebFetchResult);

      const validUrls = [
        'http://example.com',
        'https://example.com',
        'https://api.example.com/v1/data',
        'http://localhost:3000',
        'https://sub.domain.example.com/path?query=1',
      ];

      for (const validUrl of validUrls) {
        // Should not throw during validation
        await expect(handler.processWebPage(validUrl)).resolves.toBeDefined();
      }
    });
  });
});