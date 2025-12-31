/**
 * WebFetch Tool - Comprehensive AI Analysis Tests
 *
 * Comprehensive testing of the AI analysis functionality including
 * content truncation, error handling, caching with prompts, and
 * integration with different content types.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Mock Anthropic SDK
const mockCreate = vi.fn();
vi.mock('@anthropic-ai/sdk', () => {
  const MockAnthropic = vi.fn(() => ({
    messages: {
      create: mockCreate
    }
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

describe('WebFetch Tool - Comprehensive AI Analysis', () => {
  let tool: WebFetchTool;

  beforeEach(() => {
    tool = new WebFetchTool();
    tool.clearCache();
    vi.clearAllMocks();

    // Default successful AI response
    mockCreate.mockResolvedValue({
      content: [
        {
          type: 'text',
          text: 'AI analysis result: The content discusses key topics with important details.',
        },
      ],
      usage: {
        input_tokens: 150,
        output_tokens: 30,
      },
    });

    // Default successful HTTP response
    mockFetch.mockResolvedValue(createMockResponse({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: { 'content-type': 'text/html' },
      url: 'https://example.com',
      text: '<h1>Test Content</h1><p>This is test content for analysis.</p>'
    }));
  });

  afterEach(() => {
    tool.clearCache();
    vi.restoreAllMocks();
  });

  describe('Basic AI Analysis', () => {
    it('should perform AI analysis when prompt is provided', async () => {
      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'What are the main topics discussed in this content?'
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toContain('AI analysis result');
      expect(result.analysis?.model).toBe('claude-3-5-haiku-latest');
      expect(result.analysis?.usage.inputTokens).toBe(150);
      expect(result.analysis?.usage.outputTokens).toBe(30);
      expect(result.analysis?.truncated).toBe(false);
    });

    it('should not perform AI analysis when prompt is not provided', async () => {
      const result = await tool.execute({
        url: 'https://example.com'
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toBeUndefined();
    });

    it('should include correct metadata in AI analysis', async () => {
      const content = '<h1>Title</h1><p>Some content here.</p>';
      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: content
      }));

      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'Analyze this content'
      });

      expect(result.analysis).toEqual(
        expect.objectContaining({
          content: expect.any(String),
          model: 'claude-3-5-haiku-latest',
          usage: {
            inputTokens: 150,
            outputTokens: 30,
          },
          truncated: false,
          originalContentLength: expect.any(Number),
          analyzedContentLength: expect.any(Number),
        })
      );
    });
  });

  describe('Content Truncation', () => {
    it('should truncate very long content for analysis', async () => {
      const longContent = '<h1>Title</h1>' + '<p>Long paragraph</p>'.repeat(5000);

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
        prompt: 'Summarize this content',
        maxAnalysisContent: 1000
      });

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(1200); // Some buffer for truncation notice
      expect(result.analysis?.originalContentLength).toBeGreaterThan(1000);
    });

    it('should preserve structure when truncating content', async () => {
      const structuredContent = `
        <html>
          <body>
            <h1>Main Title</h1>
            <h2>Section 1</h2>
            <p>${'Content '.repeat(1000)}</p>
            <h2>Section 2</h2>
            <p>${'More content '.repeat(1000)}</p>
            <h3>Subsection</h3>
            <p>${'Final content '.repeat(1000)}</p>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: structuredContent
      }));

      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'Analyze the structure',
        maxAnalysisContent: 2000
      });

      // Should capture the analysis call with truncated content that still has headers
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('# Main Title')
            }
          ]
        })
      );

      expect(result.analysis?.truncated).toBe(true);
    });

    it('should not truncate content under the limit', async () => {
      const shortContent = '<h1>Title</h1><p>Short content</p>';

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: shortContent
      }));

      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'Analyze this short content',
        maxAnalysisContent: 100000
      });

      expect(result.analysis?.truncated).toBe(false);
      expect(result.analysis?.originalContentLength).toBe(result.analysis?.analyzedContentLength);
    });

    it('should include truncation notice in truncated content', async () => {
      const longContent = '<h1>Title</h1>' + '<p>Content</p>'.repeat(10000);

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
        prompt: 'Analyze this long content',
        maxAnalysisContent: 500
      });

      // Check that the AI was called with truncated content including notice
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('[Content truncated:')
            }
          ]
        })
      );
    });
  });

  describe('AI Analysis Error Handling', () => {
    it('should handle AI API errors gracefully', async () => {
      mockCreate.mockRejectedValue(new Error('API rate limit exceeded'));

      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'This will fail'
      });

      expect(result.success).toBe(true); // HTTP request should still succeed
      expect(result.data).toBeTruthy(); // Should have content
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toContain('AI analysis failed: API rate limit exceeded');
    });

    it('should handle AI API timeout errors', async () => {
      mockCreate.mockRejectedValue(new Error('Request timeout'));

      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'Analyze this'
      });

      expect(result.success).toBe(true);
      expect(result.analysisError).toContain('AI analysis failed: Request timeout');
    });

    it('should handle malformed AI responses', async () => {
      mockCreate.mockResolvedValue({
        content: [], // Empty content array
        usage: {
          input_tokens: 100,
          output_tokens: 0,
        },
      });

      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'Analyze this'
      });

      expect(result.success).toBe(true);
      expect(result.analysis?.content).toBe(''); // Should handle gracefully
    });

    it('should handle non-Error thrown objects', async () => {
      mockCreate.mockRejectedValue('String error');

      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'This will fail with string'
      });

      expect(result.success).toBe(true);
      expect(result.analysisError).toContain('AI analysis failed: String error');
    });
  });

  describe('AI Analysis Caching', () => {
    it('should cache AI analysis results with same prompt', async () => {
      const params = {
        url: 'https://example.com',
        prompt: 'Analyze the main content'
      };

      // First request
      const result1 = await tool.execute(params);
      expect(result1.success).toBe(true);
      expect(result1.analysis).toBeDefined();
      expect(result1.fromCache).toBeFalsy();
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Second identical request should use cache
      const result2 = await tool.execute(params);
      expect(result2.success).toBe(true);
      expect(result2.analysis).toBeDefined();
      expect(result2.fromCache).toBe(true);
      expect(mockCreate).toHaveBeenCalledTimes(1); // No additional AI calls
    });

    it('should not cache AI analysis with different prompts', async () => {
      const baseParams = { url: 'https://example.com' };

      // First request with first prompt
      await tool.execute({
        ...baseParams,
        prompt: 'Summarize the content'
      });

      // Second request with different prompt should not use cache
      await tool.execute({
        ...baseParams,
        prompt: 'Extract key points'
      });

      expect(tool.getCacheStats().size).toBe(2); // Should be separate cache entries
      expect(mockCreate).toHaveBeenCalledTimes(2); // Two AI calls
    });

    it('should bypass AI analysis cache when requested', async () => {
      const params = {
        url: 'https://example.com',
        prompt: 'Analyze content',
        bypassCache: true
      };

      // First request
      await tool.execute(params);
      expect(mockCreate).toHaveBeenCalledTimes(1);

      // Second request with bypass should make new AI call
      await tool.execute(params);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(tool.getCacheStats().size).toBe(0); // No cache entries due to bypass
    });
  });

  describe('AI Analysis with Different Content Types', () => {
    it('should analyze markdown content directly', async () => {
      const markdownContent = `
        # Main Title

        This is a paragraph with **bold** text.

        ## Subsection

        - List item 1
        - List item 2

        [Link](https://example.com)
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/markdown' },
        url: 'https://example.com/doc.md',
        text: markdownContent
      }));

      const result = await tool.execute({
        url: 'https://example.com/doc.md',
        prompt: 'Summarize this markdown document'
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();

      // Should pass markdown content directly to AI (not converted)
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('# Main Title')
            }
          ]
        })
      );
    });

    it('should analyze JSON content when prompted', async () => {
      const jsonContent = JSON.stringify({
        title: 'API Response',
        data: [
          { id: 1, name: 'Item 1', value: 100 },
          { id: 2, name: 'Item 2', value: 200 }
        ],
        meta: { total: 2, page: 1 }
      }, null, 2);

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'application/json' },
        url: 'https://api.example.com/data',
        text: jsonContent
      }));

      const result = await tool.execute({
        url: 'https://api.example.com/data',
        prompt: 'What data structure is returned by this API?'
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();

      // Should analyze the JSON content
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('"title": "API Response"')
            }
          ]
        })
      );
    });

    it('should analyze plain text content', async () => {
      const textContent = `
        This is a plain text document.
        It contains multiple lines and paragraphs.

        Some important information is here.
        The document discusses various topics.
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/plain' },
        url: 'https://example.com/readme.txt',
        text: textContent
      }));

      const result = await tool.execute({
        url: 'https://example.com/readme.txt',
        prompt: 'What is the main purpose of this document?'
      });

      expect(result.success).toBe(true);
      expect(result.analysis).toBeDefined();
    });
  });

  describe('AI Analysis Integration', () => {
    it('should include analysis in comprehensive workflow', async () => {
      const htmlContent = `
        <html>
          <head>
            <title>Product Page</title>
          </head>
          <body>
            <h1>Amazing Product</h1>
            <div class="price">$99.99</div>
            <div class="description">
              <p>This product has amazing features including:</p>
              <ul>
                <li>Feature 1: High quality</li>
                <li>Feature 2: Great value</li>
                <li>Feature 3: Fast shipping</li>
              </ul>
            </div>
            <button>Add to Cart</button>
          </body>
        </html>
      `;

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html; charset=utf-8' },
        url: 'https://shop.example.com/product/123',
        text: htmlContent
      }));

      const result = await tool.execute({
        url: 'https://shop.example.com/product/123',
        prompt: 'Extract the product name, price, and key features from this page',
        convertToMarkdown: true
      });

      expect(result.success).toBe(true);

      // Should have converted HTML to markdown
      expect(result.data).toContain('# Amazing Product');
      expect(result.data).toContain('$99.99');
      expect(result.data).toContain('- Feature 1: High quality');

      // Should have AI analysis
      expect(result.analysis).toBeDefined();
      expect(result.analysis?.content).toBeTruthy();

      // AI should receive markdown content for analysis
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: [
            {
              role: 'user',
              content: expect.stringContaining('# Amazing Product')
            }
          ]
        })
      );
    });

    it('should handle failed HTTP request without AI analysis', async () => {
      mockFetch.mockResolvedValue(createMockResponse({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        headers: {},
        url: 'https://example.com/notfound',
        text: 'Page not found'
      }));

      const result = await tool.execute({
        url: 'https://example.com/notfound',
        prompt: 'This should not be analyzed'
      });

      expect(result.success).toBe(false);
      expect(result.analysis).toBeUndefined();
      expect(result.analysisError).toBeUndefined();
      expect(mockCreate).not.toHaveBeenCalled(); // No AI analysis for failed requests
    });
  });

  describe('AI Analysis System Prompt and Message Structure', () => {
    it('should use correct system prompt and message structure', async () => {
      const result = await tool.execute({
        url: 'https://example.com',
        prompt: 'Analyze this content for key insights'
      });

      expect(result.success).toBe(true);
      expect(mockCreate).toHaveBeenCalledWith({
        model: 'claude-3-5-haiku-latest',
        max_tokens: 4096,
        system: expect.stringContaining('You are a content analysis assistant'),
        messages: [
          {
            role: 'user',
            content: expect.stringMatching(/## Web Page Content[\s\S]*## Your Task[\s\S]*Analyze this content for key insights/)
          }
        ]
      });
    });

    it('should properly format user message with content and prompt', async () => {
      const content = '<h1>Test Title</h1><p>Test content</p>';
      const userPrompt = 'Extract the main title';

      mockFetch.mockResolvedValue(createMockResponse({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: { 'content-type': 'text/html' },
        url: 'https://example.com',
        text: content
      }));

      await tool.execute({
        url: 'https://example.com',
        prompt: userPrompt
      });

      const call = mockCreate.mock.calls[0][0];
      const userMessage = call.messages[0].content;

      expect(userMessage).toContain('## Web Page Content');
      expect(userMessage).toContain('# Test Title'); // Converted to markdown
      expect(userMessage).toContain('Test content');
      expect(userMessage).toContain('---');
      expect(userMessage).toContain('## Your Task');
      expect(userMessage).toContain(userPrompt);
    });
  });
});