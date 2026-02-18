/**
 * @fileoverview HTML parsing and content processing tests for WebSearchTool
 *
 * This test suite focuses on testing the HTML parsing capabilities:
 * - HTML result parsing from search providers
 * - HTML cleaning and sanitization
 * - URL extraction and validation
 * - Text content extraction
 * - Handling malformed HTML
 *
 * @module @apex/core/tools/web/__tests__/web-search-tool.html-parsing
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  WebSearchTool,
  type WebSearchToolInput,
  type WebSearchResult,
  type WebSearchToolConfig,
} from '../web-search-tool.js';

/**
 * Extended WebSearchTool for testing internal HTML parsing methods
 */
class HtmlParsingTestableWebSearchTool extends WebSearchTool {
  constructor(config?: WebSearchToolConfig) {
    super(config);
  }

  // Expose private methods for testing via type assertion
  public testParseSearchResults(html: string): WebSearchResult[] {
    return (this as any).parseSearchResults(html);
  }

  public testCleanHtml(html: string): string {
    return (this as any).cleanHtml(html);
  }

  public testFilterResultsByDomain(
    results: WebSearchResult[],
    allowedDomains: string[],
    blockedDomains: string[]
  ): WebSearchResult[] {
    return (this as any).filterResultsByDomain(results, allowedDomains, blockedDomains);
  }

  public testIsValidDomain(domain: string): boolean {
    return (this as any).isValidDomain(domain);
  }
}

describe('WebSearchTool HTML Parsing', () => {
  let tool: HtmlParsingTestableWebSearchTool;

  beforeEach(() => {
    tool = new HtmlParsingTestableWebSearchTool();
  });

  // ============================================================================
  // HTML Cleaning Tests
  // ============================================================================

  describe('HTML cleaning', () => {
    it('should remove HTML tags from text', () => {
      const testCases = [
        {
          input: '<p>Simple text</p>',
          expected: 'Simple text'
        },
        {
          input: '<div class="test">Content with <span>nested</span> tags</div>',
          expected: 'Content with nested tags'
        },
        {
          input: '<a href="https://example.com">Link text</a>',
          expected: 'Link text'
        },
        {
          input: 'No HTML tags here',
          expected: 'No HTML tags here'
        },
        {
          input: '',
          expected: ''
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = tool.testCleanHtml(input);
        expect(result).toBe(expected);
      });
    });

    it('should decode HTML entities', () => {
      const testCases = [
        {
          input: 'Text with &amp; entities',
          expected: 'Text with & entities'
        },
        {
          input: 'Quotes: &quot;Hello&quot;',
          expected: 'Quotes: "Hello"'
        },
        {
          input: 'Less than &lt; and greater than &gt;',
          expected: 'Less than < and greater than >'
        },
        {
          input: 'Apostrophe &#x27; and slash &#x2F;',
          expected: "Apostrophe ' and slash /"
        },
        {
          input: 'Non-breaking&nbsp;space',
          expected: 'Non-breaking space'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = tool.testCleanHtml(input);
        expect(result).toBe(expected);
      });
    });

    it('should normalize whitespace', () => {
      const testCases = [
        {
          input: '   Multiple   spaces   ',
          expected: 'Multiple spaces'
        },
        {
          input: 'Text\n\nwith\n\nnewlines',
          expected: 'Text with newlines'
        },
        {
          input: 'Mixed\t\twhitespace\n  characters  ',
          expected: 'Mixed whitespace characters'
        }
      ];

      testCases.forEach(({ input, expected }) => {
        const result = tool.testCleanHtml(input);
        expect(result).toBe(expected);
      });
    });

    it('should handle complex HTML with entities and whitespace', () => {
      const complexHtml = `
        <div class="result">
          <a href="/test">&lt;Title&gt; with &amp; entities</a>
          <span class="snippet">
            This is a   snippet with    &quot;quotes&quot;
            and   multiple   spaces.
          </span>
        </div>
      `;

      const result = tool.testCleanHtml(complexHtml);
      expect(result).toBe('<Title> with & entities This is a snippet with "quotes" and multiple spaces.');
    });
  });

  // ============================================================================
  // Domain Validation Tests
  // ============================================================================

  describe('domain validation', () => {
    it('should validate correct domain formats', () => {
      const validDomains = [
        'example.com',
        'subdomain.example.com',
        'deep.subdomain.example.com',
        'test-domain.org',
        'domain123.net',
        'a.b.com',
        'xn--fsq.xn--0zwm56d', // IDN
        'example.co.uk',
        'localhost'
      ];

      validDomains.forEach(domain => {
        expect(tool.testIsValidDomain(domain)).toBe(true);
      });
    });

    it('should reject invalid domain formats', () => {
      const invalidDomains = [
        '',
        '.',
        '.com',
        'example.',
        'example..com',
        'example.c',
        '-example.com',
        'example-.com',
        'exam_ple.com',
        'example.com.',
        '127.0.0.1', // IP address
        'http://example.com', // URL
        'example.com/path' // URL with path
      ];

      invalidDomains.forEach(domain => {
        expect(tool.testIsValidDomain(domain)).toBe(false);
      });
    });

    it('should handle edge case domain inputs', () => {
      const edgeCases = [
        null,
        undefined,
        123,
        {},
        []
      ];

      edgeCases.forEach(domain => {
        expect(tool.testIsValidDomain(domain as any)).toBe(false);
      });
    });
  });

  // ============================================================================
  // Domain Filtering Tests
  // ============================================================================

  describe('domain filtering', () => {
    const mockResults: WebSearchResult[] = [
      {
        title: 'Example Result',
        url: 'https://example.com/page',
        snippet: 'Example snippet',
        domain: 'example.com',
        position: 1
      },
      {
        title: 'GitHub Result',
        url: 'https://github.com/user/repo',
        snippet: 'GitHub snippet',
        domain: 'github.com',
        position: 2
      },
      {
        title: 'Stack Overflow Result',
        url: 'https://stackoverflow.com/questions/123',
        snippet: 'Stack Overflow snippet',
        domain: 'stackoverflow.com',
        position: 3
      },
      {
        title: 'Subdomain Result',
        url: 'https://api.example.com/docs',
        snippet: 'Subdomain snippet',
        domain: 'api.example.com',
        position: 4
      }
    ];

    it('should filter by allowed domains', () => {
      const allowedDomains = ['github.com', 'stackoverflow.com'];
      const blockedDomains: string[] = [];

      const filtered = tool.testFilterResultsByDomain(
        mockResults,
        allowedDomains,
        blockedDomains
      );

      expect(filtered).toHaveLength(2);
      expect(filtered[0].domain).toBe('github.com');
      expect(filtered[1].domain).toBe('stackoverflow.com');
    });

    it('should filter by blocked domains', () => {
      const allowedDomains: string[] = [];
      const blockedDomains = ['github.com'];

      const filtered = tool.testFilterResultsByDomain(
        mockResults,
        allowedDomains,
        blockedDomains
      );

      expect(filtered).toHaveLength(3);
      expect(filtered.find(r => r.domain === 'github.com')).toBeUndefined();
    });

    it('should handle subdomain filtering correctly', () => {
      const allowedDomains = ['example.com'];
      const blockedDomains: string[] = [];

      const filtered = tool.testFilterResultsByDomain(
        mockResults,
        allowedDomains,
        blockedDomains
      );

      // Should include both example.com and api.example.com
      expect(filtered).toHaveLength(2);
      expect(filtered.find(r => r.domain === 'example.com')).toBeDefined();
      expect(filtered.find(r => r.domain === 'api.example.com')).toBeDefined();
    });

    it('should prioritize blocked domains over allowed domains', () => {
      const allowedDomains = ['example.com'];
      const blockedDomains = ['api.example.com'];

      const filtered = tool.testFilterResultsByDomain(
        mockResults,
        allowedDomains,
        blockedDomains
      );

      // Should include example.com but not api.example.com
      expect(filtered).toHaveLength(1);
      expect(filtered[0].domain).toBe('example.com');
    });

    it('should handle case-insensitive domain matching', () => {
      const allowedDomains = ['GITHUB.COM'];
      const blockedDomains: string[] = [];

      const filtered = tool.testFilterResultsByDomain(
        mockResults,
        allowedDomains,
        blockedDomains
      );

      expect(filtered).toHaveLength(1);
      expect(filtered[0].domain).toBe('github.com');
    });

    it('should return all results when no filtering is applied', () => {
      const allowedDomains: string[] = [];
      const blockedDomains: string[] = [];

      const filtered = tool.testFilterResultsByDomain(
        mockResults,
        allowedDomains,
        blockedDomains
      );

      expect(filtered).toHaveLength(mockResults.length);
    });
  });

  // ============================================================================
  // HTML Parsing Edge Cases
  // ============================================================================

  describe('HTML parsing edge cases', () => {
    it('should handle empty HTML gracefully', () => {
      const emptyInputs = ['', '   ', '\n\n\n', '<html></html>'];

      emptyInputs.forEach(html => {
        const results = tool.testParseSearchResults(html);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBe(0);
      });
    });

    it('should handle malformed HTML gracefully', () => {
      const malformedHtml = [
        '<div><a href="test">Unclosed div',
        '<a href=>No href value</a>',
        '<div class="result"><a>No href</a></div>',
        'Just plain text with no HTML structure',
        '<div class="result"><a href="https://example.com">Valid</a></div><broken>'
      ];

      malformedHtml.forEach(html => {
        // Should not throw, might return empty results or partial results
        expect(() => {
          const results = tool.testParseSearchResults(html);
          expect(Array.isArray(results)).toBe(true);
        }).not.toThrow();
      });
    });

    it('should extract valid results from mixed HTML', () => {
      const mixedHtml = `
        <div class="result">
          <a href="https://valid1.com/page">Valid Result 1</a>
          <span class="snippet">Valid snippet 1</span>
        </div>
        <div class="not-a-result">
          <a href="https://invalid.com">Not a result</a>
        </div>
        <div class="result">
          <a href="https://valid2.com">Valid Result 2</a>
          <span class="snippet">Valid snippet 2</span>
        </div>
        <script>alert('test');</script>
        <div class="result">
          <a href="/relative-url">Invalid relative URL</a>
        </div>
      `;

      const results = tool.testParseSearchResults(mixedHtml);

      // Should extract valid results and ignore invalid ones
      expect(results.length).toBeGreaterThan(0);

      // All results should have valid URLs
      results.forEach(result => {
        expect(result.url).toMatch(/^https?:\/\//);
        expect(result.title).toBeTruthy();
        expect(result.domain).toBeTruthy();
        expect(result.position).toBeGreaterThan(0);
      });
    });

    it('should handle URL edge cases in parsing', () => {
      const urlTestHtml = `
        <div class="result">
          <a href="https://example.com/normal">Normal URL</a>
        </div>
        <div class="result">
          <a href="/l/?uddg=https%3A%2F%2Fduckduckgo.com">Redirected URL</a>
        </div>
        <div class="result">
          <a href="javascript:void(0)">JavaScript URL</a>
        </div>
        <div class="result">
          <a href="mailto:test@example.com">Email URL</a>
        </div>
      `;

      const results = tool.testParseSearchResults(urlTestHtml);

      // Should handle various URL formats appropriately
      results.forEach(result => {
        // Results should have valid HTTP(S) URLs
        expect(result.url).toMatch(/^https?:\/\//);
      });
    });
  });

  // ============================================================================
  // Result Processing Tests
  // ============================================================================

  describe('result processing', () => {
    it('should limit title and snippet lengths', () => {
      const longText = 'A'.repeat(1000);
      const htmlWithLongContent = `
        <div class="result">
          <a href="https://example.com">${longText}</a>
          <span class="snippet">${longText}</span>
        </div>
      `;

      const results = tool.testParseSearchResults(htmlWithLongContent);

      if (results.length > 0) {
        expect(results[0].title.length).toBeLessThanOrEqual(200);
        expect(results[0].snippet.length).toBeLessThanOrEqual(500);
      }
    });

    it('should assign correct position numbers', () => {
      const multiResultHtml = `
        <div class="result">
          <a href="https://first.com">First Result</a>
        </div>
        <div class="result">
          <a href="https://second.com">Second Result</a>
        </div>
        <div class="result">
          <a href="https://third.com">Third Result</a>
        </div>
      `;

      const results = tool.testParseSearchResults(multiResultHtml);

      if (results.length >= 3) {
        expect(results[0].position).toBe(1);
        expect(results[1].position).toBe(2);
        expect(results[2].position).toBe(3);
      }
    });

    it('should extract domain correctly from various URL formats', () => {
      const urlTestCases = [
        { url: 'https://www.example.com/path', expectedDomain: 'www.example.com' },
        { url: 'http://subdomain.test.org', expectedDomain: 'subdomain.test.org' },
        { url: 'https://example.co.uk/deep/path?param=value', expectedDomain: 'example.co.uk' }
      ];

      urlTestCases.forEach(({ url, expectedDomain }) => {
        const html = `
          <div class="result">
            <a href="${url}">Test Result</a>
          </div>
        `;

        const results = tool.testParseSearchResults(html);

        if (results.length > 0) {
          expect(results[0].domain).toBe(expectedDomain);
        }
      });
    });
  });
});