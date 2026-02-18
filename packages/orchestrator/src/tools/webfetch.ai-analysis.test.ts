/**
 * WebFetch AI Analysis Integration Tests
 *
 * Tests for the new AI-powered content analysis feature added to WebFetch.
 * These tests verify that the prompt parameter works correctly and AI analysis
 * is performed when requested.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Mock Anthropic SDK
vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'This is a mock analysis response from Claude Haiku.',
          },
        ],
        usage: {
          input_tokens: 150,
          output_tokens: 50,
        },
      }),
    },
  }));
  return { default: MockAnthropic };
});

// Mock fetch
global.fetch = vi.fn();

describe('WebFetch AI Analysis', () => {
  let webFetchTool: WebFetchTool;

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
    webFetchTool.clearCache(); // Start with clean cache
    vi.clearAllMocks();

    // Setup default successful fetch response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: new Map([['content-type', 'text/html']]),
      text: () => Promise.resolve('<html><body><h1>Test Content</h1><p>This is test content for analysis.</p></body></html>'),
      url: 'https://example.com',
      redirected: false,
    });
  });

  describe('prompt parameter', () => {
    it('should include analysis when prompt is provided', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Extract the main heading from this page',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toBe('This is a mock analysis response from Claude Haiku.');
      expect(result.analysis?.model).toBe('claude-3-5-haiku-latest');
      expect(result.analysis?.usage).toEqual({
        inputTokens: 150,
        outputTokens: 50,
      });
    });

    it('should not call AI when prompt is not provided', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeUndefined();
      expect(result.data).toBeDefined(); // Original content still available
    });

    it('should include prompt in cache key', async () => {
      const baseParams: WebFetchParams = {
        url: 'https://example.com',
      };

      const promptParams: WebFetchParams = {
        ...baseParams,
        prompt: 'Analyze this content',
      };

      // First call without prompt
      const result1 = await webFetchTool.execute(baseParams);
      // Second call with prompt - should not be cached
      const result2 = await webFetchTool.execute(promptParams);

      expect(result1.analysis).toBeUndefined();
      expect(result2.analysis).toBeDefined();
      expect(result2.fromCache).toBeFalsy();
    });

    it('should return cached analysis for same URL+prompt', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Extract key information',
      };

      // First call
      const result1 = await webFetchTool.execute(params);
      // Second identical call should be cached
      const result2 = await webFetchTool.execute(params);

      expect(result1.analysis).toBeDefined();
      expect(result2.fromCache).toBe(true);
      expect(result2.analysis).toEqual(result1.analysis);
    });
  });

  describe('content truncation', () => {
    it('should not truncate content under limit', async () => {
      const shortContent = '<html><body><h1>Short</h1><p>Brief content.</p></body></html>';
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(shortContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
        maxAnalysisContent: 1000, // Larger than content
      };

      const result = await webFetchTool.execute(params);

      expect(result.analysis?.truncated).toBe(false);
      expect(result.analysis?.originalContentLength).toBeLessThan(1000);
    });

    it('should truncate content over limit', async () => {
      const longContent = '<html><body><h1>Long Content</h1>' + '<p>Very long paragraph. '.repeat(1000) + '</p></body></html>';
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(longContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
        maxAnalysisContent: 500, // Smaller than content
      };

      const result = await webFetchTool.execute(params);

      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.originalContentLength).toBeGreaterThan(500);
      expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(500);
    });

    it('should report truncation in analysis metadata', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
        maxAnalysisContent: 100, // Very small limit
      };

      const result = await webFetchTool.execute(params);

      expect(result.analysis?.originalContentLength).toBeDefined();
      expect(result.analysis?.analyzedContentLength).toBeDefined();
      expect(typeof result.analysis?.truncated).toBe('boolean');
    });
  });

  describe('error handling', () => {
    it('should return fetch result even if analysis fails', async () => {
      // Mock Anthropic to throw error
      const Anthropic = require('@anthropic-ai/sdk').default;
      const mockAnthropic = new Anthropic();
      mockAnthropic.messages.create.mockRejectedValue(new Error('API Error'));

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined(); // Original content still available
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toContain('AI analysis failed');
    });

    it('should include analysis error in result', async () => {
      // Mock Anthropic to throw specific error
      const Anthropic = require('@anthropic-ai/sdk').default;
      const mockAnthropic = new Anthropic();
      mockAnthropic.messages.create.mockRejectedValue(new Error('Rate limit exceeded'));

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result = await webFetchTool.execute(params);

      expect(result.analysisError).toContain('Rate limit exceeded');
    });

    it('should not cache failed analysis', async () => {
      // First call with analysis failure
      const Anthropic = require('@anthropic-ai/sdk').default;
      const mockAnthropic = new Anthropic();
      mockAnthropic.messages.create.mockRejectedValueOnce(new Error('API Error'));

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze this',
      };

      const result1 = await webFetchTool.execute(params);
      expect(result1.analysisError).toBeDefined();

      // Fix the mock for second call
      mockAnthropic.messages.create.mockResolvedValue({
        content: [{ type: 'text', text: 'Success on retry' }],
        usage: { input_tokens: 100, output_tokens: 25 },
      });

      const result2 = await webFetchTool.execute(params);
      expect(result2.analysis?.content).toBe('Success on retry');
      expect(result2.fromCache).toBeFalsy(); // Should not be from cache
    });
  });

  describe('API usage examples', () => {
    it('should work with simple extraction prompt', async () => {
      const params: WebFetchParams = {
        url: 'https://example.com/pricing',
        prompt: 'Extract all pricing tiers and their features',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.data).toBeDefined(); // Original markdown still available
    });

    it('should work with summarization prompt', async () => {
      const params: WebFetchParams = {
        url: 'https://blog.example.com/article',
        prompt: 'Summarize the main points of this article in 3 bullet points',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
    });

    it('should work with API documentation extraction', async () => {
      const params: WebFetchParams = {
        url: 'https://api.example.com/docs',
        prompt: 'List all available API endpoints with their methods and descriptions',
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
    });
  });
});