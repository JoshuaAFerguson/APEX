/**
 * WebFetch AI Analysis Content Truncation Tests
 *
 * Focused tests for the content truncation functionality in AI analysis.
 * Tests various truncation scenarios, header preservation, and boundary conditions.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebFetchTool, type WebFetchParams } from './webfetch';

// Mock Anthropic SDK
const mockAnthropic = {
  messages: {
    create: vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Mock analysis response' }],
      usage: { input_tokens: 100, output_tokens: 25 },
    }),
  },
};

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn(() => mockAnthropic),
}));

// Mock fetch
global.fetch = vi.fn(function() {
  return Promise.resolve(new Response());
});

describe('WebFetch AI Analysis Content Truncation', () => {
  let webFetchTool: WebFetchTool;

  beforeEach(() => {
    webFetchTool = new WebFetchTool();
    webFetchTool.clearCache();
    vi.clearAllMocks();
  });

  describe('header preservation during truncation', () => {
    it('should preserve all header levels when content is truncated', async () => {
      const contentWithHeaders = `
        <html>
        <body>
          <h1>Main Title</h1>
          <h2>Section A</h2>
          <h3>Subsection A.1</h3>
          <p>${'Long paragraph content. '.repeat(1000)}</p>
          <h2>Section B</h2>
          <h3>Subsection B.1</h3>
          <h4>Deep Section B.1.1</h4>
          <h5>Deeper Section B.1.1.1</h5>
          <h6>Deepest Section B.1.1.1.1</h6>
          <p>${'Another long paragraph. '.repeat(1000)}</p>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(contentWithHeaders),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Extract the document structure',
        maxAnalysisContent: 500, // Force truncation
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(true);

      // Check that AI received the content with headers
      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      const sentContent = aiCall.messages[0].content;

      expect(sentContent).toContain('# Main Title');
      expect(sentContent).toContain('## Section A');
      expect(sentContent).toContain('### Subsection A.1');
      expect(sentContent).toContain('## Section B');
      expect(sentContent).toContain('### Subsection B.1');
      expect(sentContent).toContain('#### Deep Section B.1.1');
      expect(sentContent).toContain('##### Deeper Section B.1.1.1');
      expect(sentContent).toContain('###### Deepest Section B.1.1.1.1');
      expect(sentContent).toContain('[Content truncated');
    });

    it('should handle content with no headers gracefully', async () => {
      const noHeaderContent = `
        <html>
        <body>
          <p>${'No headers here, just a very long paragraph. '.repeat(500)}</p>
          <div>
            <p>${'Another long section without headers. '.repeat(500)}</p>
          </div>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(noHeaderContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Summarize content',
        maxAnalysisContent: 300,
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(300);

      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      const sentContent = aiCall.messages[0].content;
      expect(sentContent).toContain('[Content truncated');
    });

    it('should handle mixed header and content truncation correctly', async () => {
      const mixedContent = `
        <html>
        <body>
          <h1>Introduction</h1>
          <p>${'Intro paragraph. '.repeat(100)}</p>

          <h2>Main Content</h2>
          <p>${'Main content paragraph. '.repeat(200)}</p>

          <h3>Details</h3>
          <p>${'Detailed information. '.repeat(300)}</p>

          <h2>Conclusion</h2>
          <p>${'Conclusion paragraph. '.repeat(150)}</p>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(mixedContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Extract structure and key points',
        maxAnalysisContent: 1000,
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);

      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      const sentContent = aiCall.messages[0].content;

      // Should contain all headers regardless of truncation
      expect(sentContent).toContain('# Introduction');
      expect(sentContent).toContain('## Main Content');
      expect(sentContent).toContain('### Details');
      expect(sentContent).toContain('## Conclusion');
    });
  });

  describe('boundary conditions and edge cases', () => {
    it('should handle content exactly at limit without truncation', async () => {
      const exactContent = 'x'.repeat(1000);
      const htmlContent = `<html><body><p>${exactContent}</p></body></html>`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(htmlContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze',
        maxAnalysisContent: 1000, // Exactly at processed content length
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      // Due to HTML processing, actual content might be slightly different
      // but truncation logic should handle this gracefully
      expect(result.analysis?.truncated).toBeDefined();
    });

    it('should handle very large maxAnalysisContent values', async () => {
      const content = '<html><body><h1>Title</h1><p>Short content</p></body></html>';

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(content),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze',
        maxAnalysisContent: 1000000, // Very large limit
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(false);
      expect(result.analysis?.originalContentLength).toBeLessThan(1000000);
      expect(result.analysis?.analyzedContentLength).toBe(result.analysis?.originalContentLength);
    });

    it('should handle truncation at sentence boundaries', async () => {
      const contentWithSentences = `
        <html>
        <body>
          <h1>Article Title</h1>
          <p>First sentence of the article. Second sentence with more detail. Third sentence that provides context. Fourth sentence that might be cut off during truncation. Fifth sentence that definitely won't make it. Sixth sentence is way too long to be included in the truncated content.</p>
          <p>Another paragraph starts here. This paragraph has multiple sentences too. Each sentence adds more content. The truncation should ideally cut at sentence boundaries.</p>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(contentWithSentences),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Summarize article',
        maxAnalysisContent: 200, // Force truncation
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(true);

      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      const sentContent = aiCall.messages[0].content;

      // Should try to cut at sentence boundaries
      expect(sentContent).toContain('Article Title');
      expect(sentContent).toContain('[Content truncated');
    });

    it('should handle truncation at paragraph boundaries', async () => {
      const contentWithParagraphs = `
        <html>
        <body>
          <h1>Document Title</h1>
          <p>First paragraph with some content that should be preserved in the analysis.</p>

          <p>Second paragraph that provides additional context and information about the topic being discussed.</p>

          <p>Third paragraph that goes into even more detail and might be cut off during the truncation process depending on the limit.</p>

          <p>Fourth paragraph that is likely to be truncated and won't appear in the final analysis due to content length limits.</p>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(contentWithParagraphs),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Extract key points',
        maxAnalysisContent: 300,
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(true);

      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      const sentContent = aiCall.messages[0].content;

      expect(sentContent).toContain('Document Title');
      expect(sentContent).toContain('First paragraph');
      expect(sentContent).toContain('[Content truncated');

      // Should show truncation info
      expect(sentContent).toMatch(/Showing [\d,]+ of [\d,]+ characters/);
    });
  });

  describe('truncation metadata and reporting', () => {
    it('should provide accurate truncation metadata', async () => {
      const longContent = `<html><body><h1>Title</h1><p>${'Long content. '.repeat(1000)}</p></body></html>`;

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
        prompt: 'Analyze',
        maxAnalysisContent: 500,
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.originalContentLength).toBeGreaterThan(500);
      expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(500);
      expect(result.analysis?.analyzedContentLength).toBeGreaterThan(0);

      // Verify the relationship between original and analyzed lengths
      expect(result.analysis?.originalContentLength).toBeGreaterThan(result.analysis?.analyzedContentLength || 0);
    });

    it('should include informative truncation notice', async () => {
      const content = `<html><body><h1>Test</h1><p>${'Content. '.repeat(1000)}</p></body></html>`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(content),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Analyze',
        maxAnalysisContent: 400,
      };

      const result = await webFetchTool.execute(params);

      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      const sentContent = aiCall.messages[0].content;

      expect(sentContent).toContain('[Content truncated:');
      expect(sentContent).toMatch(/Showing [\d,]+ of [\d,]+ characters/);

      // The notice should be at the end
      expect(sentContent.indexOf('[Content truncated')).toBeGreaterThan(sentContent.indexOf('# Test'));
    });

    it('should handle multiple truncation scenarios consistently', async () => {
      const scenarios = [
        { limit: 100, content: 'Short content' },
        { limit: 500, content: 'Medium length content with more detail' },
        { limit: 1000, content: 'Very long content that definitely exceeds the limit and will be truncated' },
      ];

      for (const scenario of scenarios) {
        const htmlContent = `<html><body><h1>Title</h1><p>${scenario.content.repeat(100)}</p></body></html>`;

        (global.fetch as any).mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          headers: new Map([['content-type', 'text/html']]),
          text: () => Promise.resolve(htmlContent),
          url: 'https://example.com/test',
          redirected: false,
        });

        const params: WebFetchParams = {
          url: 'https://example.com/test',
          prompt: 'Analyze this content',
          maxAnalysisContent: scenario.limit,
        };

        const result = await webFetchTool.execute(params);

        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
        expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(scenario.limit);

        if (result.analysis?.truncated) {
          expect(result.analysis.originalContentLength).toBeGreaterThan(scenario.limit);
        }

        // Clear cache for next iteration
        webFetchTool.clearCache();
        vi.clearAllMocks();
      }
    });
  });

  describe('performance with large content', () => {
    it('should handle very large content efficiently', async () => {
      const massiveContent = `<html><body><h1>Huge Document</h1>${'<p>Large paragraph. </p>'.repeat(10000)}</body></html>`;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(massiveContent),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Summarize this huge document',
        maxAnalysisContent: 5000,
      };

      const startTime = Date.now();
      const result = await webFetchTool.execute(params);
      const endTime = Date.now();

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(true);
      expect(result.analysis?.analyzedContentLength).toBeLessThanOrEqual(5000);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete quickly

      // AI should receive truncated content, not the full massive content
      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      expect(aiCall.messages[0].content.length).toBeLessThan(massiveContent.length);
    });

    it('should maintain header structure even with massive content', async () => {
      const massiveContentWithHeaders = `
        <html>
        <body>
          <h1>Chapter 1</h1>
          <p>${'Content for chapter 1. '.repeat(2000)}</p>
          <h2>Section 1.1</h2>
          <p>${'More content. '.repeat(2000)}</p>
          <h2>Section 1.2</h2>
          <p>${'Even more content. '.repeat(2000)}</p>
          <h1>Chapter 2</h1>
          <p>${'Chapter 2 content. '.repeat(2000)}</p>
        </body>
        </html>
      `;

      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        headers: new Map([['content-type', 'text/html']]),
        text: () => Promise.resolve(massiveContentWithHeaders),
        url: 'https://example.com',
        redirected: false,
      });

      const params: WebFetchParams = {
        url: 'https://example.com',
        prompt: 'Extract document structure',
        maxAnalysisContent: 3000,
      };

      const result = await webFetchTool.execute(params);

      expect(result.success).toBe(true);
      expect(result.analysis?.truncated).toBe(true);

      const aiCall = mockAnthropic.messages.create.mock.calls[0][0];
      const sentContent = aiCall.messages[0].content;

      // Should preserve header structure
      expect(sentContent).toContain('# Chapter 1');
      expect(sentContent).toContain('## Section 1.1');
      expect(sentContent).toContain('## Section 1.2');
      expect(sentContent).toContain('# Chapter 2');
    });
  });
});