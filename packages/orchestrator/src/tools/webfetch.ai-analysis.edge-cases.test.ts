/**
 * WebFetch AI Analysis Edge Cases Tests
 *
 * Comprehensive edge case testing for the AI-powered content analysis feature.
 * Tests scenarios that could cause failures, unexpected behavior, or performance issues.
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Mock Anthropic SDK
const mockAnthropicResponse = {
  content: [
    {
      type: 'text',
      text: 'Mock AI analysis response',
    },
  ],
  usage: {
    input_tokens: 100,
    output_tokens: 50,
  },
};

const mockAnthropic = {
  messages: {
    create: vi.fn().mockResolvedValue(mockAnthropicResponse),
  },
};

vi.mock('@anthropic-ai/sdk', () => {
  return {
    default: vi.fn(() => mockAnthropic),
  };
});

// Mock fetch
global.fetch = vi.fn();

describe('WebFetch AI Analysis Edge Cases', () => {
  let webFetchTool: WebFetchTool;

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
    webFetchTool.clearCache();
    vi.clearAllMocks();

    // Default successful fetch response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'text/html']]),
      text: () => Promise.resolve('<html><body><h1>Test</h1><p>Content</p></body></html>'),
      url: 'https://example.com',
      redirected: false,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('prompt parameter edge cases', () => {
    it('should handle empty prompt string', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: '',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toBeUndefined();
      expect(result.data).toBeDefined();
    });

    it('should handle very long prompts', async () => {
      const longPrompt = 'Analyze this content '.repeat(1000); // ~20k chars
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: longPrompt,
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(mockAnthropic.messages.create).toHaveBeenCalled();

      // Verify the prompt was passed to the AI
      const call = mockAnthropic.messages.create.mock.calls[0][0];
      expect(call.messages[0].content).toContain(longPrompt);
    });

    it('should handle prompts with special characters', async () => {
      const specialPrompt = 'Extract info with symbols: @#$%^&*()[]{}|\\:";\'<>?,./ and unicode: 🚀 🎯 ñáéíóú';
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: specialPrompt,
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(mockAnthropic.messages.create).toHaveBeenCalled();

      const call = mockAnthropic.messages.create.mock.calls[0][0];
      expect(call.messages[0].content).toContain(specialPrompt);
    });

    it('should handle multi-line prompts with formatting', async () => {
      const multiLinePrompt = `Extract the following information:
1. Main heading
2. Key points (as bullet list)
3. Contact information if any

Please format the response as JSON with these keys:
{
  "heading": "...",
  "keyPoints": ["...", "..."],
  "contact": "..."
}`;

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: multiLinePrompt,
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(mockAnthropic.messages.create).toHaveBeenCalled();

      const call = mockAnthropic.messages.create.mock.calls[0][0];
      expect(call.messages[0].content).toContain(multiLinePrompt);
    });

    it('should handle prompt with only whitespace', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: '   \n\t   \r\n   ',
      };

      const result = await webFetchTool.execute(params);

      // Should treat whitespace-only prompt as no prompt
      expect(result.success).toBe(true);
      expect(result.analysis).toBeUndefined();
      expect(mockAnthropic.messages.create).not.toHaveBeenCalled();
    });
  });

  describe('content truncation edge cases', () => {
    it('should handle content at exact limit boundary', async () => {
      const content = 'x'.repeat(1000);
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(`<html><body><p>${content}</p></body></html>`),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
        maxAnalysisContent: 1000, // Exactly at content length
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.truncated).toBe(false); // Should not be truncated
    });

    it('should handle very small maxAnalysisContent values', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
        maxAnalysisContent: 10, // Very small limit
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(10);
    });

    it('should handle zero maxAnalysisContent', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
        maxAnalysisContent: 0,
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.analyzedContentLength).toBe(0);
    });

    it('should handle negative maxAnalysisContent', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
        maxAnalysisContent: -100,
      };

      const result = await webFetchTool.execute(params);

      // Should use default value for invalid negative input
      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
    });

    it('should handle content with only headers', async () => {
      const headersOnlyContent = '<html><body><h1>Title</h1><h2>Subtitle</h2><h3>Section</h3></body></html>';
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(headersOnlyContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Extract headers',
        maxAnalysisContent: 50, // Small limit to test header preservation
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(mockAnthropic.messages.create).toHaveBeenCalled();

      // Check that content was processed
      const call = mockAnthropic.messages.create.mock.calls[0][0];
      const processedContent = call.messages[0].content;
      expect(processedContent).toContain('Title');
    });

    it('should handle empty content after HTML conversion', async () => {
      const emptyHtmlContent = '<html><head><script>console.log("test");</script></head><body></body></html>';
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(emptyHtmlContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.originalContentLength).toBeGreaterThan(0);
    });
  });

  describe('AI service error scenarios', () => {
    it('should handle API rate limiting', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('Rate limit exceeded. Try again later.'));

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true); // Fetch succeeded
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toContain('Rate limit exceeded');
      expect(result.data).toBeDefined(); // Raw content still available
    });

    it('should handle API authentication errors', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('Authentication failed: Invalid API key'));

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toContain('Authentication failed');
      expect(result.data).toBeDefined();
    });

    it('should handle API timeout errors', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('Request timeout'));

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toContain('Request timeout');
    });

    it('should handle malformed AI response', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [], // Empty content array
        usage: {
          input_tokens: 100,
          output_tokens: 0,
        },
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toBe(''); // Should handle empty content gracefully
    });

    it('should handle AI response without text block', async () => {
      mockAnthropic.messages.create.mockResolvedValue({
        content: [
          {
            type: 'image', // Non-text block
            source: {},
          },
        ],
        usage: {
          input_tokens: 100,
          output_tokens: 50,
        },
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toBe(''); // Should default to empty string
    });

    it('should handle network errors during AI analysis', async () => {
      mockAnthropic.messages.create.mockRejectedValue(new Error('Network connection failed'));

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toContain('Network connection failed');
    });
  });

  describe('complex content scenarios', () => {
    it('should handle content with mixed encodings', async () => {
      const mixedContent = `<html><body>
        <h1>Title with émojis 🚀</h1>
        <p>Text with ñáéíóú characters</p>
        <p>Mixed symbols: ©®™€£¥</p>
        <p>Math: ∫∑∆√∞±</p>
      </body></html>`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html; charset=utf-8']]),
        text: () => Promise.resolve(mixedContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Extract all text content',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(mockAnthropic.messages.create).toHaveBeenCalled();

      const call = mockAnthropic.messages.create.mock.calls[0][0];
      const content = call.messages[0].content;
      expect(content).toContain('émojis 🚀');
      expect(content).toContain('ñáéíóú');
    });

    it('should handle deeply nested HTML structures', async () => {
      const deeplyNested = `<html><body>
        ${'<div>'.repeat(100)}
          <p>Deep content</p>
        ${'</div>'.repeat(100)}
      </body></html>`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(deeplyNested),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Find the deep content',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(mockAnthropic.messages.create).toHaveBeenCalled();
    });

    it('should handle malformed HTML gracefully', async () => {
      const malformedHtml = '<html><body><h1>Title<p>Missing closing header<div>Unclosed div<span>Text</body></html>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(malformedHtml),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Extract content from malformed HTML',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysisError).toBeUndefined();
    });

    it('should handle binary content that fails HTML conversion', async () => {
      // Simulate binary content that would cause Turndown to fail
      const binaryLikeContent = '\x00\x01\x02\x03\xFF\xFE\xFD';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(binaryLikeContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze content',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      // Should handle the content even if HTML conversion fails
    });
  });

  describe('cache behavior with AI analysis', () => {
    it('should create different cache entries for different prompts on same URL', async () => {
      const baseParams = { url: 'https://example.com' };

      const result1 = await webFetchTool.execute({ ...baseParams, prompt: 'Extract titles' });
      const result2 = await webFetchTool.execute({ ...baseParams, prompt: 'Extract links' });
      const result3 = await webFetchTool.execute({ ...baseParams, prompt: 'Extract titles' }); // Same as first

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result3.success).toBe(true);

      expect(result1.fromCache).toBeFalsy();
      expect(result2.fromCache).toBeFalsy(); // Different prompt, not cached
      expect(result3.fromCache).toBe(true); // Same prompt, should be cached

      // Should have called AI analysis 2 times (not 3)
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(2);
    });

    it('should handle cache with maxAnalysisContent differences', async () => {
      const baseParams = {
        url: 'https://example.com',
        prompt: 'Analyze content'
      };

      const result1 = await webFetchTool.execute({ ...baseParams, maxAnalysisContent: 1000 });
      const result2 = await webFetchTool.execute({ ...baseParams, maxAnalysisContent: 2000 });

      // Different maxAnalysisContent should create different cache entries
      expect(result1.fromCache).toBeFalsy();
      expect(result2.fromCache).toBeFalsy();
      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(2);
    });

    it('should not cache results when AI analysis fails', async () => {
      mockAnthropic.messages.create.mockRejectedValueOnce(new Error('API Error'));

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result1 = await webFetchTool.execute(params);

      // Fix the mock for retry
      mockAnthropic.messages.create.mockResolvedValue(mockAnthropicResponse);

      const result2 = await webFetchTool.execute(params);

      expect(result1.success).toBe(true);
      expect(result1.analysisError).toBeDefined();
      expect(result2.success).toBe(true);
      expect(result2.analysis).toBeDefined();
      expect(result2.fromCache).toBeFalsy(); // Should retry, not use cache
    });
  });

  describe('performance and resource management', () => {
    it('should handle multiple concurrent AI analysis requests', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this content',
      };

      // Make multiple concurrent requests with different URLs to avoid cache
      const promises = Array.from({ length: 5 }, (_, i) =>
        webFetchTool.execute({ ...params, url: `https://example${i}.com` })
      );

      const results = await Promise.all(promises);

      results.forEach((result, i) => {
        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
        expect(result.metadata?.url).toBe(`https://example${i}.com`);
      });

      expect(mockAnthropic.messages.create).toHaveBeenCalledTimes(5);
    });

    it('should handle very large content efficiently', async () => {
      const largeContent = '<html><body>' + '<p>Large content paragraph. '.repeat(10000) + '</p></body></html>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(largeContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Summarize this large document',
        maxAnalysisContent: 50000,
      };

      const startTime = Date.now();
      const result = await webFetchTool.execute(params);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.originalContentLength).toBeGreaterThan(50000);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete reasonably fast
    });
  });

  describe('usage tracking and metadata', () => {
    it('should track token usage correctly', async () => {
      const customUsage = {
        input_tokens: 250,
        output_tokens: 75,
      };

      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Analysis result' }],
        usage: customUsage,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.analysis?.usage).toEqual(customUsage);
      expect(result.analysis?.model).toBe('claude-3-5-haiku-latest');
    });

    it('should provide accurate content length metadata', async () => {
      const specificContent = '<html><body><h1>Title</h1><p>This is exactly 25 chars</p></body></html>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(specificContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze',
      };

      const result = await webFetchTool.execute(params);

      expect(result.analysis?.originalContentLength).toBeGreaterThan(0);
      expect(result.analysis?.analyzedContentLength).toBeGreaterThan(0);
      expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(result.analysis?.originalContentLength || 0);
    });
  });
});